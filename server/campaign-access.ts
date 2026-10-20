import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import createRateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool as sharedPool } from './db';
import type { Pool } from 'pg';
const pool = sharedPool as unknown as Pool;
import { publicSignupSchema } from '@shared/signup-validation';
import type { RecordEmailRegistration } from './email-attribution';

declare module 'express-session' { interface SessionData { academyDeviceId?:string; pendingDeviceUser?:string; pendingDeviceUntil?:number; } }
const verificationHash=(s:string)=>crypto.createHmac('sha256',process.env.SESSION_SECRET||'development-only').update(s).digest('hex');
const hash=(s:string)=>crypto.createHash('sha256').update(s).digest('hex');
export const normalizePromo=(s:string)=>s.trim().toUpperCase();
const promo=z.string().trim().min(6).max(64).regex(/^[A-Za-z0-9-]+$/).transform(normalizePromo);
const campaignPreviewSchema=z.object({promoCode:promo}).strict();
const campaignPreviewRateLimit=createRateLimit({windowMs:60*1000,limit:30,standardHeaders:true,legacyHeaders:false,message:{success:false,code:'REQUEST_LIMIT_REACHED',message:'REQUEST_LIMIT_REACHED'}});
const signupSchema=publicSignupSchema.extend({promoCode:promo,verificationCode:z.string().regex(/^\d{6}$/)});
const campaignSchema=z.object({code:promo,label:z.string().trim().min(2).max(120),expiresAt:z.string().datetime({offset:true}).refine(s=>Date.parse(s)>Date.now()),maxUses:z.number().int().min(1).max(100000),accessDays:z.number().int().min(1).max(3650)}).strict();
class Failure extends Error { constructor(public status:number,public code:string){super(code)} }
const fail=(status:number,code:string):never=>{throw new Failure(status,code)};
async function tx<T>(fn:(c:any)=>Promise<T>):Promise<T>{const c=await pool.connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}
const endpoint=(fn:(req:Request,res:Response)=>Promise<any>):RequestHandler=>async(req,res)=>{try{await fn(req,res)}catch(e){if(e instanceof Failure)return void res.status(e.status).json({success:false,code:e.code,message:e.code});if(e instanceof z.ZodError)return void res.status(400).json({success:false,code:'INVALID_INPUT',message:'INVALID_INPUT'});if((e as any)?.code==='23505')return void res.status(409).json({success:false,code:'ALREADY_REGISTERED',message:'Email already registered'});console.error('[campaign]',(e as any)?.code||'operation failed');res.status(500).json({success:false,code:'REQUEST_FAILED',message:'REQUEST_FAILED'})}};
async function campaign(c:any,code:string){const r=await c.query('SELECT * FROM academy_campaigns WHERE code_hash=$1 FOR UPDATE',[hash(normalizePromo(code))]);const a=r.rows[0];if(!a||!a.enabled||new Date(a.expires_at).getTime()<=Date.now())fail(400,'PROMO_INVALID_OR_EXPIRED');const n=await c.query('SELECT count(*)::int AS n FROM academy_campaign_members WHERE campaign_id=$1',[a.id]);if(n.rows[0].n>=a.max_uses)fail(409,'PROMO_LIMIT_REACHED');return a}
async function audit(c:any,userId:string,operation:string,details:object){await c.query('INSERT INTO analytics_metrics (id,metric_type,user_id,metric_value,timestamp) VALUES ($1,$2,$3,$4,now())',[crypto.randomUUID(),'admin_action',userId,JSON.stringify({operation,...details})])}
const deviceSecret=(req:Request)=>{const v=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('academy_device='))?.slice(15);return v&&/^[a-f0-9]{64}$/.test(v)?v:null};
const deviceLabel=(req:Request)=>{const ua=req.headers['user-agent']||'';return `${/Firefox/i.test(ua)?'Firefox':/Edg/i.test(ua)?'Edge':/Chrome/i.test(ua)?'Chrome':/Safari/i.test(ua)?'Safari':'Browser'} · ${/Android/i.test(ua)?'Android':/iPhone|iPad/i.test(ua)?'iOS':/Windows/i.test(ua)?'Windows':/Mac/i.test(ua)?'macOS':'Other'}`};
// A device means a browser profile, not an IP address. Clearing cookies creates a new device.
async function claimDeviceInternal(req:Request,res:Response,userId:string,replaceId?:string){
 const secret=deviceSecret(req)||crypto.randomBytes(32).toString('hex');
 const result=await tx(async c=>{
  const u=(await c.query('SELECT id,role,status FROM users WHERE id=$1 FOR UPDATE',[userId])).rows[0];
  if(!u||u.status!=='active')fail(403,'ACCOUNT_PENDING');
  if(u.role!=='agent')return {id:null,devices:[]};
  const membership=(await c.query('SELECT access_until FROM academy_campaign_members WHERE user_id=$1',[userId])).rows[0];
  if(!membership)return {id:null,devices:[]};
  if(new Date(membership.access_until).getTime()<=Date.now())fail(403,'ACCESS_EXPIRED');
  const devices=(await c.query('SELECT id,label,last_seen,secret_hash FROM academy_devices WHERE user_id=$1 AND revoked_at IS NULL ORDER BY created_at',[userId])).rows;
  const existing=devices.find((d:any)=>d.secret_hash===hash(secret));
  if(existing){await c.query('UPDATE academy_devices SET last_seen=now() WHERE id=$1',[existing.id]);return {id:existing.id,devices:[]}}
  if(replaceId){if(!devices.some((d:any)=>d.id===replaceId))fail(409,'DEVICE_LIST_CHANGED');await c.query('UPDATE academy_devices SET revoked_at=now() WHERE id=$1 AND user_id=$2',[replaceId,userId])}
  else if(devices.length>=2)return {id:null,devices:devices.map(({id,label,last_seen}:any)=>({id,label,lastSeen:last_seen}))};
  const id=crypto.randomUUID();await c.query('INSERT INTO academy_devices (id,user_id,secret_hash,label) VALUES ($1,$2,$3,$4)',[id,userId,hash(secret),deviceLabel(req)]);return {id,devices:[]};
 });
 if(result.devices.length){req.session.pendingDeviceUser=userId;req.session.pendingDeviceUntil=Date.now()+5*60*1000;await new Promise<void>((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));res.status(409).json({success:false,code:'DEVICE_LIMIT',devices:result.devices});return false}
 // Regenerate at authentication to prevent session fixation; carry no unauthenticated fields forward.
 await new Promise<void>((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
 req.session.userId=userId;if(result.id)req.session.academyDeviceId=result.id;
 res.cookie('academy_device',secret,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:180*86400000,path:'/'});return true;
}
export async function claimAcademyDevice(req:Request,res:Response,userId:string,replaceId?:string){try{return await claimDeviceInternal(req,res,userId,replaceId)}catch(e){if(e instanceof Failure){res.status(e.status).json({success:false,code:e.code,message:e.code});return false}throw e}}
export async function enforceAcademyAccess(req:Request,res:Response,next:NextFunction){try{
 const id=req.session?.userId;if(!id)return next();
 const u=(await pool.query('SELECT role FROM users WHERE id=$1',[id])).rows[0];if(u?.role!=='agent')return next();
 const m=(await pool.query('SELECT access_until FROM academy_campaign_members WHERE user_id=$1',[id])).rows[0];
 if(!m)return next();
 if(new Date(m.access_until).getTime()<=Date.now())return void res.status(403).json({success:false,code:'ACCESS_EXPIRED'});
 // Adopt pre-deployment sessions under the same two-device lock, without widening their privileges.
 if(!req.session.academyDeviceId){if(!await claimAcademyDevice(req,res,id))return;await new Promise<void>((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()))}
 const d=(await pool.query('SELECT id FROM academy_devices WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL',[req.session.academyDeviceId,id])).rows[0];
 if(!d)return void res.status(401).json({success:false,code:'DEVICE_REVOKED'});next();
 }catch(e){console.error('[device] access check failed');res.status(503).json({success:false,code:'ACCESS_CHECK_UNAVAILABLE'})}}
export function registerCampaignAccess(app:Express,requireAuth:RequestHandler,requireAdmin:RequestHandler,rateLimit:RequestHandler,recordEmailRegistration?:RecordEmailRegistration){
 app.post('/api/public/campaign-preview',(_req,res,next)=>{res.set('Cache-Control','no-store');next()},campaignPreviewRateLimit,endpoint(async(req,res)=>{
  const v=campaignPreviewSchema.safeParse(req.body);if(!v.success)return fail(400,'PROMO_INVALID_OR_EXPIRED');
  // Preview never reserves access or touches the email verification and registration flow.
  const r=await pool.query(`SELECT c.access_days,c.expires_at,c.enabled,c.max_uses,
   (SELECT count(*)::int FROM academy_campaign_members m WHERE m.campaign_id=c.id) AS registrations
   FROM academy_campaigns c WHERE c.code_hash=$1`,[hash(v.data.promoCode)]);
  const a=r.rows[0];if(!a||!a.enabled||new Date(a.expires_at).getTime()<=Date.now()||a.registrations>=a.max_uses)fail(400,'PROMO_INVALID_OR_EXPIRED');
  res.json({success:true,campaign:{accessDays:a.access_days,expiresAt:new Date(a.expires_at).toISOString(),deviceLimit:2,emailVerificationRequired:true,administratorApprovalRequired:true}});
 }));
 app.get('/api/admin/campaigns',requireAuth,requireAdmin,endpoint(async(req,res)=>{
  const r=await pool.query(`SELECT c.id,c.label,c.expires_at,c.max_uses,c.access_days,c.enabled,c.created_at,
   count(m.user_id)::int AS registrations,count(m.user_id) FILTER(WHERE u.status<>'active')::int AS pending,
   count(m.user_id) FILTER(WHERE EXISTS(SELECT 1 FROM progresses p WHERE p.user_id=m.user_id))::int AS started
   FROM academy_campaigns c LEFT JOIN academy_campaign_members m ON m.campaign_id=c.id LEFT JOIN users u ON u.id=m.user_id GROUP BY c.id ORDER BY c.created_at DESC`);
  res.json({success:true,campaigns:r.rows});
 }));
 app.post('/api/admin/campaigns',requireAuth,requireAdmin,endpoint(async(req,res)=>{
  const v=campaignSchema.parse(req.body),id=crypto.randomUUID();await tx(async c=>{await c.query('INSERT INTO academy_campaigns (id,code_hash,label,expires_at,max_uses,access_days,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)',[id,hash(v.code),v.label,v.expiresAt,v.maxUses,v.accessDays,req.session.userId]);await audit(c,req.session.userId!,'campaign_created',{campaignId:id,label:v.label,maxUses:v.maxUses,accessDays:v.accessDays})});
  res.status(201).json({success:true,id,code:v.code,signupUrl:`/signup?promo=${encodeURIComponent(v.code)}`});
 }));
 app.patch('/api/admin/campaigns/:id',requireAuth,requireAdmin,endpoint(async(req,res)=>{
  const id=z.string().uuid().parse(req.params.id),v=z.object({enabled:z.boolean()}).strict().parse(req.body);await tx(async c=>{const r=await c.query('UPDATE academy_campaigns SET enabled=$2 WHERE id=$1 RETURNING id',[id,v.enabled]);if(!r.rowCount)fail(404,'NOT_FOUND');await audit(c,req.session.userId!,'campaign_toggled',{campaignId:id,enabled:v.enabled})});res.json({success:true});
 }));
 app.post('/api/signup/email-code',rateLimit,endpoint(async(req,res)=>{
  const v=z.object({email:z.string().trim().toLowerCase().email().max(254),promoCode:promo}).strict().parse(req.body);
  const code=String(crypto.randomInt(100000,1000000));
  // Reservation is short-lived; sending never consumes a campaign registration.
  await tx(async c=>{const a=await campaign(c,v.promoCode);const prior=(await c.query('SELECT sent_at FROM academy_email_challenges WHERE email=$1 FOR UPDATE',[v.email])).rows[0];if(prior&&Date.now()-new Date(prior.sent_at).getTime()<60000)fail(429,'WAIT_BEFORE_RESEND');await c.query('INSERT INTO academy_email_challenges (email,campaign_id,code_hash,expires_at) VALUES ($1,$2,$3,now()+interval \'10 minutes\') ON CONFLICT(email) DO UPDATE SET campaign_id=EXCLUDED.campaign_id,code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,attempts=0,sent_at=now()',[v.email,a.id,verificationHash(v.email+':'+code)])});
  const {sendSmtpEmail}=await import('./smtp-email');
  const sent=await sendSmtpEmail({to:v.email,subject:'Academy — Email verification',html:`<p>Your Academy verification code: <strong>${code}</strong></p><p>Valid for 10 minutes. If you did not request this, ignore this email.</p>`});
  if(!sent)fail(503,'EMAIL_DELIVERY_FAILED');res.json({success:true});
 }));
 const campaignSignup=endpoint(async(req,res)=>{
  const v=signupSchema.parse(req.body),password=await bcrypt.hash(v.password,10),userId='agent-'+crypto.randomUUID(),agencyId='agency-'+crypto.randomUUID();
  // Increment failed verification attempts outside the registration transaction so rollback cannot reset them.
  const check=await pool.query('UPDATE academy_email_challenges SET attempts=attempts+1 WHERE email=$1 AND attempts<5 AND expires_at>now() RETURNING code_hash,campaign_id',[v.email]);
  const ch=check.rows[0];if(!ch||ch.code_hash!==verificationHash(v.email+':'+v.verificationCode))fail(400,'EMAIL_CODE_INVALID');
  await tx(async c=>{const a=await campaign(c,v.promoCode);if(a.id!==ch.campaign_id)fail(400,'EMAIL_CODE_INVALID');
   const verified=(await c.query('DELETE FROM academy_email_challenges WHERE email=$1 AND code_hash=$2 AND expires_at>now() RETURNING email',[v.email,ch.code_hash])).rows[0];if(!verified)fail(400,'EMAIL_CODE_INVALID');
   await c.query('INSERT INTO agencies (id,name,status,primary_contact_name,primary_contact_email,contact_email,country,contact_phone) VALUES ($1,$2,$3,$4,$5,$5,$6,$7)',[agencyId,v.agencyName,'pending',v.name,v.email,v.country,v.phone]);
   await c.query('INSERT INTO users (id,username,password,name,email,role,status,agency_id,country,phone,language_preference) VALUES ($1,$2,$3,$4,$2,$5,$6,$7,$8,$9,$10)',[userId,v.email,password,v.name,'agent','inactive',agencyId,v.country,v.phone,v.languagePreference]);
   await c.query('INSERT INTO academy_campaign_members (user_id,campaign_id,access_until) VALUES ($1,$2,now()+$3*interval \'1 day\')',[userId,a.id,a.access_days]);
  });
  try { await recordEmailRegistration?.(userId,v.emailAttributionToken); } catch { /* Optional analytics cannot reject a committed account. */ }
  res.status(201).json({success:true,pending:true,message:'Your verified application is awaiting administrator approval.'});
 });
 app.post('/api/signup',(req,res,next)=>{if(!req.body?.promoCode)return next();return rateLimit(req,res,()=>campaignSignup(req,res,next));});
 app.post('/api/auth/replace-device',rateLimit,endpoint(async(req,res)=>{
  const user=req.session.pendingDeviceUser;if(!user||!req.session.pendingDeviceUntil||req.session.pendingDeviceUntil<Date.now())fail(401,'LOGIN_REQUIRED');
  const id=z.string().uuid().parse(req.body.deviceId);if(!await claimAcademyDevice(req,res,user!,id))return;
  await new Promise<void>((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));res.json({success:true});
 }));
 app.get('/api/account/devices',requireAuth,endpoint(async(req,res)=>{const r=await pool.query('SELECT id,label,created_at,last_seen FROM academy_devices WHERE user_id=$1 AND revoked_at IS NULL ORDER BY created_at',[req.session.userId]);res.json({success:true,devices:r.rows,currentId:req.session.academyDeviceId})}));
 app.delete('/api/admin/users/:id/devices',requireAuth,requireAdmin,endpoint(async(req,res)=>{await tx(async c=>{const target=await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[req.params.id]);if(!target.rowCount)fail(404,'NOT_FOUND');await c.query('UPDATE academy_devices SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[req.params.id]);await audit(c,req.session.userId!,'devices_reset',{userId:req.params.id})});res.json({success:true})}));
}
