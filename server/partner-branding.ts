import type {Express,RequestHandler} from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import {pool} from './db';
import {storage} from './storage';
import {composeLogo,digest,localAsset,localAssetPath,materialInfo,normalizeLogo,validPlacement,imageOptions} from './partner-brand-core';
const pg:any=pool,dir=path.resolve(process.env.ACADEMY_BRAND_DIR||'private/agency-branding');
const uuid=(s:any)=>typeof s==='string'&&/^[a-f0-9-]{36}$/i.test(s);
let active=0;const attempts=new Map<string,{at:number,n:number}>();
const bounded:RequestHandler=(req,res,next)=>{if(active>=2)return void res.status(429).json({code:'BUSY'});active++;let done=false;const release=()=>{if(!done){done=true;active--}};res.once('finish',release);res.once('close',release);next()};
const limit:RequestHandler=(req,res,next)=>{const id=(req as any).user.id,now=Date.now();for(const [k,v] of Array.from(attempts.entries()))if(now-v.at>3600000)attempts.delete(k);const a=attempts.get(id)||{at:now,n:0};if(++a.n>12)return void res.status(429).json({code:'UPLOAD_LIMIT'});attempts.set(id,a);next()};
const wrap=(fn:Function):RequestHandler=>async(req,res)=>{try{res.set('Cache-Control','no-store');await fn(req,res)}catch(e){if(res.headersSent){res.destroy();return}const code=e instanceof Error?e.message:'FAILED';const known=['LOCAL_IMAGE_REQUIRED','INVALID_PATH','IMAGE_TOO_LARGE','PNG_JPG_WEBP_ONLY','LOW_RESOLUTION','INVALID_PLACEMENT'];res.status(known.includes(code)?400:503).json({code:known.includes(code)?code:'UNAVAILABLE'})}};
async function agency(req:any,res:any){const u=req.user;if(!u?.agencyId){res.status(403).json({code:'AGENCY_REQUIRED'});return null}return u.agencyId}
const imageUrl=(c:any)=>(c.contentType||c.type)==='image'?(c.imageUrl||c.documentUrl||''):(c.contentType||c.type)==='video'?(c.videoUrl||c.documentUrl||''):(c.documentUrl||c.imageUrl||c.videoUrl||'');
async function catalogue(){
 const all=await storage.getPartnerFolders();const byId=new Map(all.map(f=>[f.id,f]));
 const visible=(f:any)=>{const seen=new Set();while(f){if(f.status!=='published'||seen.has(f.id))return false;seen.add(f.id);if(!f.parentFolderId)return true;f=byId.get(f.parentFolderId);if(!f)return false}return false};
 const folders=all.filter(visible);const ids=new Set(folders.map(f=>f.id));const contents=(await storage.getContents()).filter((c:any)=>c.status==='published'&&c.folderId&&ids.has(c.folderId));
 const templates=(await pg.query('SELECT content_id,source_hash,x,y,width,height,backdrop,updated_at FROM academy_brand_templates')).rows;
 const map=new Map(templates.map((t:any)=>[t.content_id,t]));return {folders,items:contents.map((c:any)=>({...c,material:materialInfo(c),template:map.get(c.id)||null}))};
}
async function findItem(id:string){const c=await catalogue();return c.items.find((i:any)=>i.id===id)}
export function registerPartnerBranding(app:Express,auth:RequestHandler,admin:RequestHandler){
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:0}}).single('file');
 app.get('/api/brand/catalog',auth,wrap(async(req:any,res:any)=>{const c=await catalogue();res.json(c)}));
 app.get('/api/brand/logo',auth,wrap(async(req:any,res:any)=>{const a=await agency(req,res);if(!a)return;const r=(await pg.query('SELECT l.id,l.cleanup_method,l.warning,l.selected_variant,l.approved_at FROM academy_brand_logos l JOIN academy_brand_current c ON c.logo_id=l.id WHERE c.agency_id=$1',[a])).rows[0];res.json({logo:r?{...r,url:`/api/brand/logo/${r.id}/selected`}:null})}));
 app.post('/api/brand/logo',auth,limit,bounded,(req,res,next)=>upload(req,res,e=>{if(e)return void res.status(400).json({code:'PNG_JPG_WEBP_MAX_5MB'});next()}),wrap(async(req:any,res:any)=>{
  const a=await agency(req,res);if(!a)return;if(!req.file)return res.status(400).json({code:'FILE_REQUIRED'});
  const n=await normalizeLogo(req.file.buffer),id=crypto.randomUUID();await fs.mkdir(dir,{recursive:true,mode:0o700});const original=path.join(dir,id+'-original.png'),cleaned=path.join(dir,id+'-cleaned.png');await fs.writeFile(original,n.original,{mode:0o600});await fs.writeFile(cleaned,n.cleaned,{mode:0o600});
  await pg.query('INSERT INTO academy_brand_logos(id,agency_id,created_by,original_path,cleaned_path,cleanup_method,warning) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,a,req.user.id,original,cleaned,n.method,n.warning]);
  res.status(201).json({id,method:n.method,warning:n.warning,original:`/api/brand/logo/${id}/original`,cleaned:`/api/brand/logo/${id}/cleaned`});
 }));
 app.get('/api/brand/logo/:id/:variant',auth,wrap(async(req:any,res:any)=>{const adminRead=req.user.role==='admin'&&req.params.variant==='selected';const a=adminRead?null:await agency(req,res);if(!a&&!adminRead)return;if(!uuid(req.params.id)||!['original','cleaned','selected'].includes(req.params.variant))return res.sendStatus(404);const l=(adminRead?await pg.query('SELECT * FROM academy_brand_logos WHERE id=$1 AND approved_at IS NOT NULL',[req.params.id]):await pg.query('SELECT * FROM academy_brand_logos WHERE id=$1 AND agency_id=$2',[req.params.id,a])).rows[0];if(!l)return res.sendStatus(404);const v=req.params.variant==='selected'?l.selected_variant:req.params.variant;if(!v)return res.sendStatus(404);res.type('png').send(await fs.readFile(v==='original'?l.original_path:l.cleaned_path))}));
 app.post('/api/brand/logo/:id/approve',auth,wrap(async(req:any,res:any)=>{const a=await agency(req,res);if(!a)return;if(!uuid(req.params.id)||!['original','cleaned'].includes(req.body?.variant))return res.status(400).json({code:'INVALID_CHOICE'});const c=await pg.connect();try{await c.query('BEGIN');const l=(await c.query('UPDATE academy_brand_logos SET selected_variant=$3,approved_at=now() WHERE id=$1 AND agency_id=$2 RETURNING id',[req.params.id,a,req.body.variant])).rows[0];if(!l){await c.query('ROLLBACK');return res.sendStatus(404)}await c.query('INSERT INTO academy_brand_current(agency_id,logo_id) VALUES($1,$2) ON CONFLICT(agency_id) DO UPDATE SET logo_id=EXCLUDED.logo_id',[a,l.id]);await c.query('UPDATE agencies SET logo_url=$2 WHERE id=$1',[a,`/api/brand/logo/${l.id}/selected`]);await c.query('COMMIT');res.json({success:true})}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}));
 app.put('/api/admin/brand/template/:id',auth,admin,bounded,wrap(async(req:any,res:any)=>{if(!validPlacement(req.body))return res.status(400).json({code:'INVALID_PLACEMENT'});const i=await findItem(req.params.id);if(!i)return res.sendStatus(404);const b=await localAsset(imageUrl(i));const m=await sharp(b,imageOptions).metadata();if(!['png','jpeg','webp'].includes(m.format||'')||(m.pages||1)>1)return res.status(400).json({code:'PNG_JPG_WEBP_ONLY'});const p=req.body;await pg.query('INSERT INTO academy_brand_templates(content_id,source_hash,x,y,width,height,backdrop,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(content_id) DO UPDATE SET source_hash=EXCLUDED.source_hash,x=EXCLUDED.x,y=EXCLUDED.y,width=EXCLUDED.width,height=EXCLUDED.height,backdrop=EXCLUDED.backdrop,updated_by=EXCLUDED.updated_by,updated_at=now()',[i.id,digest(b),p.x,p.y,p.width,p.height,p.backdrop,req.user.id]);res.json({success:true,hash:digest(b)})}));
 const render=async(req:any,res:any,preview:boolean)=>{
  const ids=Array.isArray(req.body?.ids)?Array.from(new Set(req.body.ids as string[])):[];if(!ids.length||ids.length>40||ids.some(id=>typeof id!=='string'))return res.status(400).json({code:'SELECT_1_TO_40_FILES'});if(preview&&ids.length!==1)return res.status(400).json({code:'SELECT_ONE_FILE'});
  const branded=req.body?.branded===true;let logo:Buffer|undefined;if(branded){const a=await agency(req,res);if(!a)return;const l=(await pg.query('SELECT l.* FROM academy_brand_current c JOIN academy_brand_logos l ON l.id=c.logo_id AND l.agency_id=c.agency_id WHERE c.agency_id=$1 AND l.approved_at IS NOT NULL',[a])).rows[0];if(!l)return res.status(409).json({code:'APPROVED_LOGO_REQUIRED'});logo=await fs.readFile(l.selected_variant==='cleaned'?l.cleaned_path:l.original_path)}
  const cat=await catalogue();const items=ids.map(id=>cat.items.find((i:any)=>i.id===id));if(items.some(i=>!i))return res.sendStatus(404);
  // Preserve original document/video downloads without loading large files into memory.
  if(!branded&&!preview){
   const files:{abs:string,size:number,name:string}[]=[];let total=0;
   for(const i of items){const url=imageUrl(i);const file=await localAssetPath(url);total+=file.size;if(total>500*1024*1024)return res.status(413).json({code:'ZIP_TOO_LARGE'});const raw=String(i.displayName||i.title||'material').replace(new RegExp('[^\\p{L}\\p{N}._ -]','gu'),'_').replace(/^\.+/,'').slice(0,100);files.push({...file,name:raw+(path.extname(raw)?'':path.extname(url))})}
   if(files.length===1){const f=files[0];res.set('Content-Disposition',`attachment; filename="material${path.extname(f.name)}"; filename*=UTF-8''${encodeURIComponent(f.name)}`);res.type(path.extname(f.name)||'application/octet-stream');const stream=(await import('fs')).createReadStream(f.abs);await new Promise<void>((resolve,reject)=>{stream.on('error',reject);res.once('finish',resolve);res.once('close',()=>{stream.destroy();resolve()});stream.pipe(res)});return}
   const archive=(await import('archiver')).default('zip',{zlib:{level:5}});res.type('zip').set('Content-Disposition','attachment; filename="partner-materials.zip"');archive.on('error',()=>res.destroy());res.once('close',()=>archive.abort());archive.pipe(res);files.forEach((f,index)=>archive.file(f.abs,{name:`${index+1}-${f.name}`}));await archive.finalize();return;
  }
  // Validate every requested file before sending a byte. Never silently omit failed files.
  const outputs:{name:string,data:Buffer}[]=[];let bytes=0;
  for(const i of items){const url=imageUrl(i);const b=await localAsset(url);let data=b;
   if(branded||preview){const m=await sharp(b,imageOptions).metadata();if(!['png','jpeg','webp'].includes(m.format||'')||(m.pages||1)>1)return res.status(409).json({code:'IMAGE_ONLY',id:i.id});if(branded){if(!i.template||i.template.source_hash!==digest(b))return res.status(409).json({code:'TEMPLATE_REQUIRED',id:i.id});data=await composeLogo(b,logo!,i.template,preview)}else data=await sharp(b,imageOptions).rotate().resize({width:1000,height:1000,fit:'inside',withoutEnlargement:true}).png().toBuffer()}
   bytes+=data.length;if(bytes>100*1024*1024)return res.status(413).json({code:'ZIP_TOO_LARGE'});const safe=String(i.displayName||i.title||'material').replace(new RegExp('[^\\p{L}\\p{N}._ -]','gu'),'_').replace(/^\.+/,'').slice(0,100);outputs.push({name:branded?safe.replace(/\.[^.]+$/,'')+'-branded.png':safe+(path.extname(safe)?'':path.extname(url)),data});
  }
  if(preview)return res.type('png').send(outputs[0].data);
  if(outputs.length===1){res.set('Content-Disposition',`attachment; filename="material${branded?'-branded.png':path.extname(outputs[0].name)}"; filename*=UTF-8''${encodeURIComponent(outputs[0].name)}`);return res.type(branded?'png':path.extname(outputs[0].name)||'application/octet-stream').send(outputs[0].data)}
  const archive=(await import('archiver')).default('zip',{zlib:{level:5}});res.type('zip').set('Content-Disposition','attachment; filename="partner-materials.zip"');archive.on('error',()=>res.destroy());archive.pipe(res);outputs.forEach((o,index)=>archive.append(o.data,{name:`${index+1}-${o.name}`}));await archive.finalize();
 };
 app.post('/api/brand/preview',auth,bounded,wrap((req:any,res:any)=>render(req,res,true)));
 app.post('/api/brand/download',auth,bounded,wrap((req:any,res:any)=>render(req,res,false)));
}
