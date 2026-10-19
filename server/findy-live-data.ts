import fs from 'node:fs';
import crypto from 'node:crypto';
import {Pool} from 'pg';
import type {Topic} from './findy-query';
let catalogPool:Pool|undefined;
export function applyCatalogPool(){
 if(!catalogPool){const config=JSON.parse(fs.readFileSync('/root/.config/findandstudy-academy/catalog-readonly.json','utf8'));catalogPool=new Pool({connectionString:config.connectionString,max:2,connectionTimeoutMillis:4000,idleTimeoutMillis:30000,statement_timeout:5000,options:'-c default_transaction_read_only=on'});}
 return catalogPool;
}
export const catalogColumns='program_id,program_name,degree,language,duration,tuition_fee,discounted_fee,currency,fee_type,application_fee,deposit_fee,intakes,program_updated_at,university_id,university_name,country,city,university_updated_at';
export async function catalogDimensions(){const pg=applyCatalogPool();const result=await pg.query('SELECT DISTINCT university_id AS id,university_name AS name,country FROM findy_catalog.programs ORDER BY university_name');return result.rows;}
export async function livePrograms(topic:Topic){
 const clauses:string[]=[];const args:any[]=[];
 const add=(column:string,value:any)=>{args.push(value);clauses.push(`${column}=$${args.length}`);};
 if(topic.country)add('lower(country)',topic.country.toLowerCase());
 if(topic.language)add('lower(language)',topic.language.toLowerCase());
 if(topic.universityId)add('university_id',topic.universityId);
 if(topic.degree)add('lower(degree)',topic.degree.toLowerCase());
 const result=await applyCatalogPool().query(`SELECT ${catalogColumns} FROM findy_catalog.programs ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY university_name,program_name,program_id LIMIT 20001`,args);
 if(result.rows.length>20000)throw Error('Catalogue result too large; narrow filters');return result.rows;
}
export async function liveProgramById(id:number){return (await applyCatalogPool().query(`SELECT ${catalogColumns} FROM findy_catalog.programs WHERE program_id=$1`,[id])).rows[0];}
export async function dailyFindyLimit(pg:any,user:any){if(['admin','staff'].includes(user.role))return 1000; if(user.agencyId){const found=await pg.query("SELECT 1 FROM partnership_applications WHERE agency_id=$1 AND status='approved' LIMIT 1",[user.agencyId]);if(found.rows.length)return 100;}return 20;}
export async function findyUsage(pg:any,user:any){const limit=await dailyFindyLimit(pg,user);const row=(await pg.query("SELECT used,day FROM findy_daily_usage WHERE user_id=$1 AND day=(now() AT TIME ZONE 'Europe/Istanbul')::date",[user.id])).rows[0];return{limit,used:row?.used||0,remaining:Math.max(0,limit-(row?.used||0)),timezone:'Europe/Istanbul'};}
export class FindyLimitError extends Error{constructor(public code:string,public status:number,public usage:any,public retryAfter:number){super(code);}}
export async function reserveFindy(pg:any,user:any,sessionId:string){
 const c=await pg.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['findy:'+user.id]);
 const limit=await dailyFindyLimit(c,user);
 await c.query("INSERT INTO findy_daily_usage(user_id,day) VALUES($1,(now() AT TIME ZONE 'Europe/Istanbul')::date) ON CONFLICT DO NOTHING",[user.id]);
 const r=(await c.query("SELECT *,EXTRACT(EPOCH FROM(now()-last_request)) AS elapsed,lease_until>now() AS busy,date_trunc('minute',now())=minute_start AS same_minute FROM findy_daily_usage WHERE user_id=$1 AND day=(now() AT TIME ZONE 'Europe/Istanbul')::date FOR UPDATE",[user.id])).rows[0];
 const usage={limit,used:r.used,remaining:Math.max(0,limit-r.used),timezone:'Europe/Istanbul'};
 if(r.used>=limit)throw new FindyLimitError('FINDY_DAILY_LIMIT',429,usage,3600);
 if(r.busy||(r.last_request&&Number(r.elapsed)<3)||(r.same_minute&&r.minute_used>=6))throw new FindyLimitError('FINDY_RATE_LIMIT',429,usage,Math.max(3,r.same_minute&&r.minute_used>=6?60:3));
 const token=crypto.randomUUID();await c.query("UPDATE findy_daily_usage SET used=used+1,last_request=now(),lease_token=$2,lease_until=now()+interval '45 seconds',minute_used=CASE WHEN minute_start=date_trunc('minute',now()) THEN minute_used+1 ELSE 1 END,minute_start=date_trunc('minute',now()) WHERE user_id=$1 AND day=(now() AT TIME ZONE 'Europe/Istanbul')::date",[user.id,token]);
 const saved=(await c.query('SELECT topic FROM findy_chat_context WHERE user_id=$1 AND session_id=$2 AND expires_at>now()',[user.id,sessionId])).rows[0]?.topic||{};
 await c.query('COMMIT');return{token,day:r.day,topic:saved as Topic,usage:{...usage,used:r.used+1,remaining:Math.max(0,limit-r.used-1)}};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function finishFindy(pg:any,userId:string,sessionId:string,slot:any,topic:Topic|undefined,refund=false){
 const c=await pg.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['findy:'+userId]);
 await c.query('UPDATE findy_daily_usage SET lease_token=NULL,lease_until=NULL,used=GREATEST(0,used-$4) WHERE user_id=$1 AND day=$2 AND lease_token=$3',[userId,slot.day,slot.token,refund?1:0]);
 if(topic){await c.query("INSERT INTO findy_chat_context(user_id,session_id,topic,expires_at,updated_at) VALUES($1,$2,$3,now()+interval '30 minutes',now()) ON CONFLICT(user_id,session_id) DO UPDATE SET topic=$3,expires_at=now()+interval '30 minutes',updated_at=now()",[userId,sessionId,JSON.stringify(topic)]);
 await c.query('DELETE FROM findy_chat_context WHERE user_id=$1 AND session_id IN (SELECT session_id FROM findy_chat_context WHERE user_id=$1 ORDER BY updated_at DESC OFFSET 10)',[userId]);}
 await c.query('DELETE FROM findy_chat_context WHERE ctid IN (SELECT ctid FROM findy_chat_context WHERE expires_at<now() LIMIT 100)');
 await c.query("DELETE FROM findy_daily_usage WHERE ctid IN (SELECT ctid FROM findy_daily_usage WHERE day<(now() AT TIME ZONE 'Europe/Istanbul')::date-35 LIMIT 100)");
 await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
