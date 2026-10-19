import type { Express, RequestHandler } from 'express';
import crypto from 'crypto';
import { storage } from './storage';
import { pool } from './db';
import { completionSchema, completionState, agencyCountryCode, validEmail, validCompletionValue as valid } from '@shared/profile-completion';

// Only session identity is trusted. No submitted user, role or agency IDs are used.
export function registerProfileCompletion(app: Express, requireAuth: RequestHandler) {
 const allowed = new Set(['/me','/me/language','/me/completion','/login','/logout','/auth/replace-device']);
 app.use('/api', async (req,res,next)=>{
  if (!req.session?.userId || allowed.has(req.path)) return next();
  try {
   const user=await storage.getUser(req.session.userId);
   if (!user || user.role!=='agent') return next();
   const agency=user.agencyId?await storage.getAgencyById(user.agencyId):undefined;
   const state=completionState(user,agency);
   if (state.required) return res.status(403).json({success:false,code:'PROFILE_COMPLETION_REQUIRED',...state});
   next();
  } catch { res.status(503).json({success:false,code:'PROFILE_COMPLETION_UNAVAILABLE'}); }
 });
 app.get('/api/me/completion',requireAuth,async(req,res)=>{
  try {
   const user=await storage.getUser(req.session.userId!);
   if (!user) return res.sendStatus(401);
   const agency=user.agencyId?await storage.getAgencyById(user.agencyId):undefined;
   res.set('Cache-Control','no-store');
   res.json({...completionState(user,agency),emailNeedsReview:!validEmail(user.email),profile:{
    name:user.name||'',email:user.email||'',agencyName:agency?.name||user.companyName||'',
    country:agencyCountryCode(agency?.country)||(valid('country',user.country)?user.country:''),
    phone:valid('phone',user.phone)?user.phone:agency?.contactPhone||agency?.phone||'',
    agencyNameLocked:!!agency&&valid('agencyName',agency.name),
    countryLocked:!!agencyCountryCode(agency?.country)
   }});
  } catch {res.status(503).json({success:false,code:'PROFILE_COMPLETION_UNAVAILABLE'});}
 });
 app.put('/api/me/completion',requireAuth,async(req,res)=>{
  const parsed=completionSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({success:false,code:'INVALID_COMPLETION',fields:parsed.error.issues.map(x=>x.path[0])});
  let c: any;
  try {
   c=await pool.connect();
   await c.query('BEGIN');
   const u=(await c.query('SELECT id,name,email,role,status,agency_id AS "agencyId",country,phone FROM users WHERE id=$1 FOR UPDATE',[req.session.userId])).rows[0];
   if(!u||u.role!=='agent'||u.status!=='active'){await c.query('ROLLBACK');return res.sendStatus(403);}
   if(!validEmail(u.email)){await c.query('ROLLBACK');return res.status(409).json({success:false,code:'EMAIL_REVIEW_REQUIRED'});}
   let a=u.agencyId?(await c.query('SELECT id,name,country,contact_email AS "contactEmail",primary_contact_email AS "primaryContactEmail",contact_phone AS "contactPhone",phone FROM agencies WHERE id=$1 FOR UPDATE',[u.agencyId])).rows[0]:undefined;
   const v=parsed.data;
   if(!a){
    // Existing active user is already approved. Never attach them to another
    // agency by matching its name: create their own record atomically instead.
    const id='agency-'+crypto.randomUUID();
    a=(await c.query('INSERT INTO agencies(id,name,status,country,contact_email,contact_phone,primary_contact_name,primary_contact_email) VALUES($1,$2,$3,$4,$5,$6,$7,$5) RETURNING id,name,country,contact_email AS "contactEmail",contact_phone AS "contactPhone"',[id,v.agencyName,'active',v.country,u.email,v.phone,v.name])).rows[0];
   }else{
    // Preserve already valid shared agency information when a member completes
    // their personal profile. Locking prevents concurrent members overwriting it.
    a=(await c.query('UPDATE agencies SET name=$2,country=$3,contact_email=$4,contact_phone=$5 WHERE id=$1 RETURNING id,name,country,contact_email AS "contactEmail",contact_phone AS "contactPhone"',[
     a.id,valid('agencyName',a.name)?a.name:v.agencyName,agencyCountryCode(a.country)?a.country:v.country,
     validEmail(a.contactEmail)?a.contactEmail:validEmail(a.primaryContactEmail)?a.primaryContactEmail:u.email,
     valid('phone',a.contactPhone)?a.contactPhone:valid('phone',a.phone)?a.phone:v.phone
    ])).rows[0];
   }
   const updated={...u,name:v.name,agencyId:a.id,country:valid('country',u.country)?u.country:v.country,phone:v.phone};
   const state=completionState(updated,a);
   if(state.required)throw new Error('Incomplete result');
   await c.query('UPDATE users SET name=$2,country=$3,phone=$4,agency_id=$5 WHERE id=$1',[u.id,updated.name,updated.country,updated.phone,a.id]);
   await c.query('COMMIT');
   res.json({success:true,required:false});
  }catch{if(c)await c.query('ROLLBACK').catch(()=>{});res.status(500).json({success:false,code:'COMPLETION_SAVE_FAILED'});}
  finally{c?.release();}
 });
}
