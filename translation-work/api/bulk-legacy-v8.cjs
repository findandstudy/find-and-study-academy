// Resumes existing drafts. Only missing/invalid rows are sent; one shared budget ledger.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const root=process.env.ACADEMY_WORK_DIR||'/var/lib/academy-translations',out=root+'/outputs',r=require(root+'/translate.cjs');
const retry=true,engine=require(root+'/translate-repair-v8.cjs'),stateFile=root+'/bulk-legacy-v8-state.json';
const model='gpt-4.1-mini-2025-04-14',policy='academy-visible-strings-v5';
const repairIdentity=j=>crypto.createHash('sha256').update(JSON.stringify({jobHash:j.jobHash,model,policy:retry?'academy-visible-strings-repair-v8':policy})).digest('hex');
const identity=j=>crypto.createHash('sha256').update(JSON.stringify({jobHash:j.jobHash,model,policy})).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));const write=(p,v)=>{fs.writeFileSync(p+'.tmp',JSON.stringify(v,null,2)+'\n',{mode:0o600});fs.renameSync(p+'.tmp',p)};
const safe=s=>typeof s==='string'&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s)&&!s.includes('__FAS_KEEP_');
function valid(job,strings){r.validate(job,{strings:strings.map((text,index)=>({index,text}))});if(!strings.every(safe))throw Error('Invalid control character or placeholder');return strings}
function salvage(part,rejected){
 const fields=r.outputTexts(rejected.response).fields;if(!fields||Object.keys(fields).length!==part.strings.length)throw Error('Malformed rejected dictionary');
 return part.strings.map((source,i)=>{try{let text=fields['s'+i];if(typeof text!=='string')return null;const tokens=r.masked(source,i).tokens;tokens.forEach((token,n)=>{const marker='__FAS_KEEP_'+i+'_'+n+'__';if(text.split(marker).length!==2)throw Error('Invalid token');text=text.replace(marker,()=>token)});return valid({strings:[source]},[text])[0]}catch{return null}});
}
const exec=(file,args)=>cp.execFileSync(file,args,{cwd:'/var/www/academy.findandstudy.com',encoding:'utf8',maxBuffer:32*1024*1024});
function freshPlan(tag){const snapshot=root+'/bulk-snapshot-'+tag+'.json',plan=root+'/bulk-plan-'+tag+'.json';exec('node',[root+'/export-catalog.cjs',snapshot]);exec('python3',[root+'/build_catalog_jobs.py',snapshot,plan]);return {snapshot,plan:read(plan)}}
async function main(){
 const lock=root+'/bulk-worker.lock',fd=fs.openSync(lock,'wx',0o600);fs.writeSync(fd,String(process.pid));
 const config=read(root+'/config.json');if(config.approvedBudgetUSD!==100||config.model!==model)throw Error('Budget/model guard failed');config.concurrency=4;config.maxJobsPerRun=1000;config.maxStringsPerRequest=25;
 let state=fs.existsSync(stateFile)?read(stateFile):{version:1,cycles:[],held:[]};state.status='running';state.pid=process.pid;state.startedAt=new Date().toISOString();write(stateFile,state);
 const holds=read(root+'/bulk-holds.json');const heldKeys=new Set(holds.map(h=>h.id+':'+h.language));
 try{
 const first=freshPlan('legacy-initial-'+Date.now()),legacyPlan=read(root+'/legacy-bulk-v8-jobs.json'),manifest=read(root+'/legacy-bulk-v8-jobs.json.repair-manifest.json'),snapshot=read(first.snapshot),sources=new Map(snapshot.contents.map(i=>[i.id,i]));const candidates=legacyPlan.jobs.filter(j=>{const source=sources.get(j.id);return source&&r.jobDigest(Object.fromEntries(['title','description','content'].map(k=>[k,source[k]??null])))===j.sourceHash&&!heldKeys.has(j.id+':'+j.language)});state.initialJobs=candidates.length;write(stateFile,state);
 for(let offset=0;offset<candidates.length;offset+=25){
  const group=candidates.slice(offset,offset+25),tasks=[],parts=[];
  for(const j of group){
   const key=identity(j),file=out+'/'+key+'.json';
   if(fs.existsSync(file)){try{const old=read(file);valid(j,old.strings);continue}catch(e){state.held.push({id:j.id,language:j.language,reason:'Existing complete draft needs manual review: '+e.message});continue}}
   for(let start=0;start<j.strings.length;start+=25){
    const part={strings:j.strings.slice(start,start+25)},chunk=out+'/chunks/'+key+'-'+start+'.json';
    if(fs.existsSync(chunk)){try{const old=read(chunk);if(old.jobHash!==j.jobHash||old.start!==start)throw Error('identity');valid(part,old.strings);continue}catch(e){state.held.push({id:j.id,language:j.language,start,reason:'Existing chunk needs manual review: '+e.message});continue}}
    let values=part.strings.map(()=>null);const rejected=out+'/rejected/'+key+'-'+start+'.json';
    if(fs.existsSync(rejected)){try{const old=read(rejected);if(old.jobHash===j.jobHash&&old.start===start&&JSON.stringify(old.sourceStrings)===JSON.stringify(part.strings))values=salvage(part,old)}catch{}}
    const indices=values.flatMap((v,i)=>v===null?[i]:[]),item={j,key,start,part,chunk,values,indices};
    if(indices.length){const job={version:1,kind:'repair',id:j.id+':'+start+':'+indices.join(','),title:j.title,language:j.language,sourceHash:j.sourceHash,strings:indices.map(i=>part.strings[i])};job.jobHash=r.jobDigest(job);item.repair=job;tasks.push(job)}parts.push(item);
   }
  }
  if(tasks.length)await engine.run({jobs:tasks},config,out);
  let recovered=0;
  for(const p of parts){try{
   if(p.repair){const resultFile=out+'/'+repairIdentity(p.repair)+'.json';if(!fs.existsSync(resultFile))throw Error('Repair request rejected; preserved for review');const result=read(resultFile);valid(p.repair,result.strings);p.indices.forEach((idx,k)=>p.values[idx]=result.strings[k])}
   valid(p.part,p.values);fs.writeFileSync(p.chunk,JSON.stringify({jobHash:p.j.jobHash,model,policy,start:p.start,strings:p.values,manual:false,bulkRepair:true,usage:{input_tokens:0,output_tokens:0}}),{flag:'wx',mode:0o600});recovered++;
  }catch(e){state.held.push({id:p.j.id,language:p.j.language,start:p.start,reason:e.message})}}
  let complete=0;
  for(const j of group){const key=identity(j),file=out+'/'+key+'.json';if(fs.existsSync(file))continue;try{const strings=[];for(let start=0;start<j.strings.length;start+=25){const c=read(out+'/chunks/'+key+'-'+start+'.json');if(c.jobHash!==j.jobHash||c.start!==start)throw Error('Checkpoint identity');strings.push(...c.strings)}valid(j,strings);fs.writeFileSync(file,JSON.stringify({...j,model,policy,strings,bulkRepair:true}),{flag:'wx',mode:0o600});complete++}catch{}}
  const tag=Date.now(),current=freshPlan(tag),bundle=root+'/bulk-legacy-batch-'+tag+'.json';const groupPlan=root+'/legacy-group-'+tag+'.json',groupManifest=root+'/legacy-group-manifest-'+tag+'.json',hashes=new Set(group.map(j=>j.jobHash));write(groupPlan,{version:1,jobs:group});write(groupManifest,{version:1,rows:manifest.rows.filter(m=>hashes.has(m.jobHash))});
  const prepared=exec('python3',[root+'/prepare_legacy_bundle.py',current.snapshot,groupPlan,groupManifest,out,bundle,'--limit','200']);const b=read(bundle);
  const report={tag,offset,repairedChunks:recovered,completedDrafts:complete,apiRepairJobs:tasks.length,prepared,at:new Date().toISOString()};
  if((b.rows||[]).length){report.dryRun=exec('node',[root+'/publish_legacy_bundle.cjs',bundle]);report.applied=exec('node',[root+'/publish_legacy_bundle.cjs',bundle,'--apply']);report.verified=exec('node',[root+'/publish_legacy_bundle.cjs',bundle,'--verify-public']);}
  state.cycles.push(report);state.processedJobs=Math.min(offset+25,candidates.length);state.accountedUSD=read(out+'/budget-ledger.json').chargedUSD;write(stateFile,state);console.log(JSON.stringify(report));
 }
 const final=freshPlan('final-'+Date.now());state.repairedRows=state.cycles.reduce((n,c)=>n+(c.verified?JSON.parse(c.verified).rows:0),0);state.remainingRepairs=candidates.length-state.repairedRows;state.status=state.remainingRepairs?'needs-review':'legacy-queue-complete';state.finishedAt=new Date().toISOString();write(stateFile,state);
 }catch(e){state.status='stopped-on-error';state.error=e.message;write(stateFile,state);throw e}finally{fs.closeSync(fd);fs.unlinkSync(lock)}
}
module.exports={salvage,valid,identity};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
