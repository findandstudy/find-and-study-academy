import 'dotenv/config';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import type {Pool} from 'pg';
import {pool} from './db';
import {PRIVATE_ROOT,OUTPUTS,readSource,scanSources,readTranslation,budgetSummary} from './translation-control';
import {hash,sourceHash,sourceValue,manifest,reconstruct,reuseFragments,validateResult} from './translation-control-core';
const database=pool as Pool,require=createRequire(import.meta.url);
const runner=require(process.cwd()+'/server/academy-translation-runner.cjs');
function config(){const c=JSON.parse(fs.readFileSync(PRIVATE_ROOT+'/ui-config.json','utf8'));if(c.approvedBudgetUSD!==100||c.model!=='gpt-4.1-mini-2025-04-14'||c.inputUSDPerMillionTokens!==0.4||c.outputUSDPerMillionTokens!==1.6||c.keyFile!=='/root/.config/findandstudy-academy/translation.env')throw Error('CONFIG_REVIEW_REQUIRED');return {...c,concurrency:1,maxJobsPerRun:1,maxStringsPerRequest:25};}
function clearOwnedDeadLock(){const file=OUTPUTS+'/run.lock';if(!fs.existsSync(file))return;try{const lock=JSON.parse(fs.readFileSync(file,'utf8'));if(lock.owner!=='academy-translation-worker'||!Number.isSafeInteger(lock.pid)||lock.pid<2)return;try{process.kill(lock.pid,0);}catch(e:any){if(e.code==='ESRCH')fs.unlinkSync(file);}}catch{}}
export async function processOne(fetcher?:typeof fetch,testing?:{configuration:any;outputs:string}){
 if(testing&&process.env.ACADEMY_TRANSLATION_TEST!=='1')throw Error('TEST_OVERRIDE_FORBIDDEN');
 const ioDir=testing?.outputs||OUTPUTS;
 const enabled=(await database.query('SELECT enabled FROM academy_translation_runtime WHERE id=1')).rows[0]?.enabled;if(!enabled)return false;
 await database.query(`UPDATE academy_translation_jobs j SET state='locked',updated_at=now() FROM academy_translation_targets t WHERE j.kind=t.kind AND j.source_id=t.source_id AND j.language=t.language AND t.locked AND j.state='queued'`);
 const j=(await database.query(`UPDATE academy_translation_jobs SET state='processing',attempts=attempts+1,updated_at=now() WHERE id=(SELECT j.id FROM academy_translation_jobs j JOIN academy_translation_targets t ON t.kind=j.kind AND t.source_id=j.source_id AND t.language=j.language JOIN academy_translation_sources s ON s.kind=j.kind AND s.source_id=j.source_id WHERE j.state='queued' AND j.not_before<=now() AND NOT t.locked AND s.eligible ORDER BY j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED) RETURNING *`)).rows[0];if(!j)return false;
 try{
 const source=await readSource(j.kind,j.source_id);if(!source||sourceHash(j.kind,source)!==j.source_hash){await database.query("UPDATE academy_translation_jobs SET state='superseded',updated_at=now() WHERE id=$1",[j.id]);return true;}
 if(!source.title?.trim())throw Error('MISSING_SOURCE_TITLE');const sourceSnapshot=sourceValue(j.kind,source),m=manifest(j.kind,sourceSnapshot);
 const base=j.base_translation?{title:j.base_translation.title,description:j.base_translation.description,...(j.kind==='quiz'?{questions:JSON.parse(j.base_translation.questions)}:{content:j.base_translation.content})}:null;
 const reuse=reuseFragments(j.kind,j.previous_snapshot,base,sourceSnapshot),indices=reuse.map((text,i)=>text===null?i:-1).filter(i=>i>=0),strings=indices.map(i=>m.fields[i].text);
 let completed:string[]=[];
 if(strings.length){const budget=testing?{accountedUSD:JSON.parse(fs.readFileSync(ioDir+'/budget-ledger.json','utf8')).chargedUSD,remainingUSD:100-JSON.parse(fs.readFileSync(ioDir+'/budget-ledger.json','utf8')).chargedUSD}:budgetSummary();if(budget.accountedUSD===null)throw Error('BUDGET_UNAVAILABLE');if(budget.remainingUSD===0)throw Error('BUDGET_LIMIT');
 const apiJob:any={kind:j.kind,id:j.source_id,title:source.title,language:j.language,sourceHash:j.source_hash,strings,fieldPaths:indices.map(i=>m.fields[i].path)};apiJob.jobHash=runner.jobDigest(apiJob);const c=testing?.configuration||config();if(!testing)clearOwnedDeadLock();
 await runner.run({jobs:[apiJob]},c,ioDir,fetcher);
 // Resolve only the exact validated checkpoint produced for this job and policy.
 const matches=fs.readdirSync(ioDir).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).map(n=>{try{return JSON.parse(fs.readFileSync(ioDir+'/'+n,'utf8'));}catch{return null;}}).filter(d=>d?.jobHash===apiJob.jobHash&&d?.model===c.model&&d?.policy==='academy-queue-visible-strings-v1');
 if(matches.length!==1)throw Error('VALIDATION_REVIEW_REQUIRED');completed=runner.validate(apiJob,{strings:matches[0].strings.map((text:string,index:number)=>({index,text}))});}
 const all=reuse.map(x=>x??'');indices.forEach((index,i)=>all[index]=completed[i]);const draft=validateResult(j.kind,sourceSnapshot,reconstruct(j.kind,sourceSnapshot,all));
 const fresh=await readSource(j.kind,j.source_id);if(!fresh||sourceHash(j.kind,fresh)!==j.source_hash){await database.query("UPDATE academy_translation_jobs SET state='superseded',updated_at=now() WHERE id=$1",[j.id]);return true;}
 await database.query("UPDATE academy_translation_jobs SET draft=$2,state='ready',error=NULL,updated_at=now() WHERE id=$1 AND state='processing'",[j.id,JSON.stringify(draft)]);
 }catch(e:any){const msg=String(e?.message||'PROCESSING_FAILED');const budget=/budget limit|BUDGET_LIMIT/i.test(msg);const busy=e?.code==='EEXIST';const uncertain=/RECONCILE_REQUIRED|reservation retained/i.test(msg);const state=budget?'budget_wait':busy?'queued':'failed';const code=uncertain?'RECONCILE_REQUIRED':budget?'BUDGET_LIMIT':busy?'SHARED_BUDGET_BUSY':/^[A-Z_]+$/.test(msg)?msg:'TRANSLATION_REVIEW_REQUIRED';await database.query(`UPDATE academy_translation_jobs SET state=$2,error=$3,not_before=now()+interval '60 seconds',updated_at=now() WHERE id=$1 AND state='processing'`,[j.id,state,code]);}
 return true;
}
async function main(){
 if(process.argv.includes('--migrate')){await database.query(fs.readFileSync(process.cwd()+'/server/translation-control.sql','utf8'));console.log('TRANSLATION_SCHEMA_READY');await pool.end();return;}
 const owner=await database.connect();if(!(await owner.query("SELECT pg_try_advisory_lock(hashtext('academy.translation.worker')) AS locked")).rows[0].locked)throw Error('WORKER_ALREADY_RUNNING');owner.on('error',()=>process.exit(1));
 if(!(await database.query('SELECT baseline_complete FROM academy_translation_runtime WHERE id=1')).rows[0]?.baseline_complete){await scanSources(true);await database.query('UPDATE academy_translation_runtime SET baseline_complete=true WHERE id=1');console.log('TRANSLATION_BASELINE_ADOPTED');}
 clearOwnedDeadLock();await database.query("UPDATE academy_translation_jobs SET state='queued',updated_at=now() WHERE state='processing'");
 if(process.argv.includes('--baseline')){owner.release();await pool.end();return;}
 const heartbeat=setInterval(()=>void database.query('UPDATE academy_translation_runtime SET heartbeat=now() WHERE id=1').catch(()=>{}),15000);let busy=false,lastScan=0;
 const tick=async()=>{if(busy)return;busy=true;try{if(Date.now()-lastScan>30000){await scanSources();lastScan=Date.now();}for(let i=0;i<4;i++)if(!await processOne())break;await database.query('UPDATE academy_translation_runtime SET heartbeat=now(),last_error=NULL WHERE id=1');}catch{await database.query("UPDATE academy_translation_runtime SET last_error='WORKER_REVIEW_REQUIRED' WHERE id=1").catch(()=>{});}finally{busy=false;}};
 await tick();const timer=setInterval(()=>void tick(),5000);
 const stop=()=>{clearInterval(timer);clearInterval(heartbeat);const wait=setInterval(()=>{if(!busy){clearInterval(wait);owner.release();void pool.end().then(()=>process.exit());}},250);};process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
if(!process.env.ACADEMY_TRANSLATION_TEST)void main().catch(()=>{console.error('Translation worker could not start; inspect private configuration.');process.exitCode=1;});
