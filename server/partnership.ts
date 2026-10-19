import type { Express, RequestHandler } from 'express';
import crypto from 'crypto';
import { pool } from './db';
import { storage } from './storage';
const pg:any = pool;
const stages = ['submitted','review','needs_info','contract','onboarding','approved','rejected'];
const text=(v:unknown,min:number,max:number)=>typeof v==='string'&&v.trim().length>=min&&v.trim().length<=max;
const safe=(a:any)=>{if(!a)return null;const {internal_note,approved_by,...publicFields}=a;return publicFields;};
export function registerPartnership(app:Express,auth:RequestHandler,admin:RequestHandler){
 async function agent(req:any,res:any){const user=await storage.getUser(req.session?.userId);if(!user||user.role!=='agent'||user.status!=='active'||!user.agencyId){res.status(403).json({code:'FORBIDDEN'});return null;}return user;}
 app.get('/api/partnership',auth,async(req,res)=>{try{const u=await agent(req,res);if(!u)return;const a=(await pg.query('SELECT * FROM partnership_applications WHERE agency_id=$1',[u.agencyId])).rows[0];const events=a?(await pg.query('SELECT id,action,from_status,to_status,public_note,created_at FROM partnership_events WHERE application_id=$1 ORDER BY created_at,id',[a.id])).rows:[];res.set('Cache-Control','no-store').json({application:safe(a),events});}catch{res.status(503).json({code:'UNAVAILABLE'});}});
 app.post('/api/partnership',auth,async(req,res)=>{
  req.body=req.body&&typeof req.body==='object'&&!Array.isArray(req.body)?req.body:{};
  if(!text(req.body.destinations,2,1000)||!text(req.body.experience,10,3000))return res.status(400).json({code:'INVALID_INPUT'});
  let c:any;try{const u=await agent(req,res);if(!u)return;c=await pg.connect();await c.query('BEGIN');
   const locked=(await c.query('SELECT id,agency_id,status,role FROM users WHERE id=$1 FOR UPDATE',[u.id])).rows[0];if(!locked||locked.role!=='agent'||locked.status!=='active'||locked.agency_id!==u.agencyId){await c.query('ROLLBACK');return res.status(409).json({code:'AGENCY_CHANGED'});}
   const agency=(await c.query('SELECT id,name FROM agencies WHERE id=$1 FOR UPDATE',[u.agencyId])).rows[0];if(!agency){await c.query('ROLLBACK');return res.status(409).json({code:'AGENCY_CHANGED'});}
   const existing=(await c.query('SELECT * FROM partnership_applications WHERE agency_id=$1 FOR UPDATE',[agency.id])).rows[0];
   if(existing&&existing.status!=='needs_info'){await c.query('ROLLBACK');return res.status(409).json({code:'ALREADY_APPLIED'});}
   if(existing&&req.body.version!==existing.version){await c.query('ROLLBACK');return res.status(409).json({code:'STALE_VERSION'});}
   const a=existing?(await c.query("UPDATE partnership_applications SET destinations=$2,experience=$3,status='submitted',version=version+1,updated_at=now() WHERE id=$1 RETURNING *",[existing.id,req.body.destinations.trim(),req.body.experience.trim()])).rows[0]:(await c.query('INSERT INTO partnership_applications(id,agency_id,submitted_by,agency_name,destinations,experience) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[crypto.randomUUID(),agency.id,u.id,agency.name,req.body.destinations.trim(),req.body.experience.trim()])).rows[0];
   await c.query('INSERT INTO partnership_events(id,application_id,actor_id,action,from_status,to_status,admin_detail) VALUES($1,$2,$3,$4,$5,$6,$7)',[crypto.randomUUID(),a.id,u.id,existing?'resubmit':'submit',existing?.status??null,'submitted',JSON.stringify({destinations:a.destinations,experience:a.experience})]);await c.query('COMMIT');res.status(existing?200:201).json({application:safe(a)});
  }catch{if(c)await c.query('ROLLBACK');res.status(503).json({code:'UNAVAILABLE'});}finally{c?.release();}
 });
 app.get('/api/admin/partnerships',auth,admin,async(_req,res)=>{try{const applications=(await pg.query('SELECT p.*,u.name AS applicant_name,u.email AS applicant_email FROM partnership_applications p LEFT JOIN users u ON u.id=p.submitted_by ORDER BY p.updated_at DESC,p.id')).rows;res.set('Cache-Control','no-store').json({applications});}catch{res.status(503).json({code:'UNAVAILABLE'});}});
 app.get('/api/admin/partnerships/:id/events',auth,admin,async(req,res)=>{try{res.set('Cache-Control','no-store').json({events:(await pg.query('SELECT e.*,u.name AS actor_name FROM partnership_events e LEFT JOIN users u ON u.id=e.actor_id WHERE application_id=$1 ORDER BY e.created_at,e.id',[req.params.id])).rows});}catch{res.status(503).json({code:'UNAVAILABLE'});}});
 app.patch('/api/admin/partnerships/:id',auth,admin,async(req,res)=>{
  const b=req.body&&typeof req.body==='object'&&!Array.isArray(req.body)?req.body:{};const actions=['review','needs_info','contract','onboarding','approve','reject','update'];
  if(!actions.includes(b.action)||!Number.isInteger(b.version)||!text(b.reason,2,1000)||!text(b.publicNote??'',b.action==='needs_info'?2:0,1000)||!text(b.internalNote??'',0,3000)||!text(b.contractReference??'',0,300)||(b.contractStatus!==undefined&&!['pending','sent','signed'].includes(b.contractStatus))||['trainingDone','meetingDone','portalReady'].some(k=>b[k]!==undefined&&typeof b[k]!=='boolean'))return res.status(400).json({code:'INVALID_INPUT'});
  let c:any;try{c=await pg.connect();await c.query('BEGIN');const a=(await c.query('SELECT * FROM partnership_applications WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!a){await c.query('ROLLBACK');return res.sendStatus(404);}if(a.version!==b.version){await c.query('ROLLBACK');return res.status(409).json({code:'STALE_VERSION'});}if(a.status==='approved'){await c.query('ROLLBACK');return res.status(409).json({code:'ALREADY_APPROVED'});}
   const next:Record<string,string[]>={review:['submitted','needs_info','rejected'],needs_info:['submitted','review','contract','onboarding'],contract:['review'],onboarding:['contract'],approve:['onboarding'],reject:stages.filter(s=>s!=='approved'),update:['review','contract','onboarding']};if(!next[b.action].includes(a.status)){await c.query('ROLLBACK');return res.status(409).json({code:'INVALID_TRANSITION'});}
   const contract=b.contractStatus??a.contract_status;const training=b.trainingDone??a.training_done;const meeting=b.meetingDone??a.meeting_done;const portal=b.portalReady??a.portal_ready;const reference=b.contractReference===undefined?a.contract_reference:b.contractReference.trim();
   if((contract!==a.contract_status&& !['contract','onboarding'].includes(a.status))||(['trainingDone','meetingDone','portalReady'].some(k=>b[k]!==undefined)&&a.status!=='onboarding')){await c.query('ROLLBACK');return res.status(409).json({code:'INVALID_TRANSITION'});}
   if((contract==='signed'&&!reference)||(b.action==='onboarding'&&contract!=='signed')||(b.action==='approve'&&!(a.contract_status==='signed'&&a.training_done&&a.meeting_done&&a.portal_ready&&contract==='signed'&&training&&meeting&&portal))){await c.query('ROLLBACK');return res.status(409).json({code:'PREREQUISITES_REQUIRED'});}
   if(b.action==='approve'){
    // Final approval must use previously saved prerequisites, not silently alter them.
    if(contract!==a.contract_status||reference!==a.contract_reference||training!==a.training_done||meeting!==a.meeting_done||portal!==a.portal_ready){await c.query('ROLLBACK');return res.status(409).json({code:'PREREQUISITES_REQUIRED'});}
    const actor=(await c.query('SELECT role,status FROM users WHERE id=$1 FOR UPDATE',[req.session!.userId])).rows[0];
    if(!actor||actor.role!=='admin'||actor.status!=='active'){await c.query('ROLLBACK');return res.status(403).json({code:'FORBIDDEN'});}
    const agency=(await c.query('SELECT status FROM agencies WHERE id=$1 FOR UPDATE',[a.agency_id])).rows[0];
    const members=(await c.query("SELECT id FROM users WHERE agency_id=$1 AND role='agent' AND status='active' LIMIT 1",[a.agency_id])).rows;
    if(!agency||agency.status!=='active'||!members.length){await c.query('ROLLBACK');return res.status(409).json({code:'AGENCY_CHANGED'});}
   }
   const status=b.action==='update'?a.status:b.action==='approve'?'approved':b.action==='reject'?'rejected':b.action;
   const result=(await c.query('UPDATE partnership_applications SET status=$2,contract_status=$3,contract_reference=$4,training_done=$5,meeting_done=$6,portal_ready=$7,public_note=$8,internal_note=$9,version=version+1,updated_at=now(),approved_by=CASE WHEN $2=\'approved\' THEN $10 ELSE approved_by END,approved_at=CASE WHEN $2=\'approved\' THEN now() ELSE approved_at END WHERE id=$1 RETURNING *',[a.id,status,contract,reference,training,meeting,portal,b.publicNote?.trim()??a.public_note,b.internalNote?.trim()??a.internal_note,req.session!.userId])).rows[0];
   await c.query('INSERT INTO partnership_events(id,application_id,actor_id,action,from_status,to_status,public_note,admin_detail) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[crypto.randomUUID(),a.id,req.session!.userId,b.action,a.status,status,b.publicNote?.trim()??'',JSON.stringify({reason:b.reason.trim(),before:{contractStatus:a.contract_status,contractReference:a.contract_reference,training:a.training_done,meeting:a.meeting_done,portal:a.portal_ready,internalNote:a.internal_note},after:{contractStatus:contract,contractReference:reference,training,meeting,portal,internalNote:result.internal_note}})]);
   await c.query('INSERT INTO analytics_metrics(id,user_id,metric_type,metric_value) VALUES($1,$2,$3,$4)',[crypto.randomUUID(),req.session!.userId,'admin_action',JSON.stringify({operation:'partnership_'+b.action,applicationId:a.id,from:a.status,to:status,reason:b.reason.trim(),version:result.version})]);await c.query('COMMIT');res.json({application:result});
  }catch{if(c)await c.query('ROLLBACK');res.status(503).json({code:'UNAVAILABLE'});}finally{c?.release();}
 });
}
