// Real PostgreSQL integration tests in an isolated, disposable schema. SMTP is stubbed.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),crypto=require('crypto');
const {createRequire}=require('module');const req=createRequire(process.cwd()+'/package.json');
const {Pool}=req('pg'),ts=req('typescript'),express=req('express'),session=req('express-session'),{z}=req('zod');
req('dotenv').config({quiet:true});
const schema='campaign_test_'+crypto.randomBytes(8).toString('hex');
const adminPool=new Pool({connectionString:process.env.DATABASE_URL});let pool,server,passed=0;
const codes=new Map();
function load(file,stubs={}){const m={exports:{}};const text=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;vm.runInNewContext(text,{exports:m.exports,module:m,require:n=>stubs[n]??req(n),process,console,Buffer,setTimeout,clearTimeout},{filename:file});return m.exports}
(async()=>{try{
 await adminPool.query('CREATE SCHEMA '+schema);pool=new Pool({connectionString:process.env.DATABASE_URL,options:'-c search_path='+schema});
 await pool.query(`CREATE TABLE users(id varchar PRIMARY KEY,username text UNIQUE,password text,name text,email text UNIQUE,role text,status text,agency_id text,country text,phone text,language_preference text);
 CREATE TABLE agencies(id varchar PRIMARY KEY,name text,status text,primary_contact_name text,primary_contact_email text,country text,contact_phone text);
 CREATE TABLE progresses(user_id text);CREATE TABLE analytics_metrics(id text,metric_type text,user_id text,metric_value text,timestamp timestamptz);`);
 await pool.query(fs.readFileSync(path.join(process.cwd(),'migrations/20261017_campaign_access.sql'),'utf8'));
 await pool.query("INSERT INTO users(id,role,status) VALUES ('admin','admin','active'),('agent','agent','active')");
 const base=z.object({name:z.string(),email:z.string().toLowerCase(),password:z.string().min(8),agencyName:z.string(),country:z.string(),phone:z.string(),languagePreference:z.string().default('en')}).strict();
 const mod=load(path.join(process.cwd(),'server/campaign-access.ts'),{'./db':{pool},'@shared/signup-validation':{publicSignupSchema:base},'./smtp-email':{sendSmtpEmail:async v=>{codes.set(v.to,v.html.match(/<strong>(\d+)<\/strong>/)[1]);return true}}});
 const app=express();app.use(express.json());app.use(session({secret:'isolated-test-secret',resave:false,saveUninitialized:false}));
 const auth=(q,s,n)=>q.headers['x-test-admin']==='yes'?(q.session.userId='admin',n()):s.sendStatus(401);
 mod.registerCampaignAccess(app,auth,auth,(q,s,n)=>n());
 app.post('/test/login',async(q,s)=>{if(await mod.claimAcademyDevice(q,s,'agent'))q.session.save(()=>s.json({success:true}))});
 app.get('/test/protected',mod.enforceAcademyAccess,(q,s)=>s.json({success:true}));
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port;
 async function call(route,body,headers={},method='POST'){const r=await fetch(url+route,{method,headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});let data;try{data=await r.json()}catch{}return {status:r.status,data,cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')}}
 function check(name,fn){fn();passed++;console.log('PASS',name)}
 let r=await call('/api/admin/campaigns',undefined,{},'GET');check('admin auth',()=>assert.equal(r.status,401));
 r=await call('/api/admin/campaigns',{code:'SHARED3000',label:'Test',expiresAt:new Date(Date.now()+86400000).toISOString(),maxUses:1,accessDays:180},{'x-test-admin':'yes'});check('create shared campaign',()=>assert.equal(r.status,201));const campaignId=r.data.id;
 const emails=['a@example.invalid','b@example.invalid'];for(const email of emails){r=await call('/api/signup/email-code',{email,promoCode:'SHARED3000'});assert.equal(r.status,200)}
 const signup=email=>({name:'Test User',email,password:'fixture12345',agencyName:'Test Agency',country:'TR',phone:'+905551234567',languagePreference:'en',promoCode:'SHARED3000',verificationCode:codes.get(email)});
 r=await call('/api/signup',{...signup(emails[0]),verificationCode:'000000'});check('wrong verification code rejected',()=>assert.equal(r.status,400));
 const rr=await Promise.all(emails.map(email=>call('/api/signup',signup(email))));check('last campaign slot atomic',()=>assert.deepEqual(rr.map(x=>x.status).sort(),[201,409]));
 const count=(await pool.query('SELECT (SELECT count(*)::int FROM agencies) AS agencies,(SELECT count(*)::int FROM academy_campaign_members) AS members')).rows[0];check('rejected signup leaves no orphan',()=>assert.deepEqual(count,{agencies:1,members:1}));
 r=await call('/api/admin/campaigns/'+campaignId,{enabled:false},{'x-test-admin':'yes'},'PATCH');check('pause campaign',()=>assert.equal(r.status,200));
 check('pause keeps existing access',()=>assert.equal((rr.find(x=>x.status===201)).data.pending,true));
 r=await call('/api/signup/email-code',{email:'c@example.invalid',promoCode:'SHARED3000'});check('paused redemption denied',()=>assert.equal(r.status,400));
 const d1=await call('/test/login',{}),d2=await call('/test/login',{}),d3=await call('/test/login',{});check('two devices allowed third blocked',()=>{assert.equal(d1.status,200);assert.equal(d2.status,200);assert.equal(d3.status,409);assert.equal(d3.data.devices.length,2)});
 const replace=await call('/api/auth/replace-device',{deviceId:d3.data.devices[0].id},{cookie:d3.cookie});check('verified login device replacement',()=>assert.equal(replace.status,200));
 r=await call('/test/protected',undefined,{cookie:d1.cookie},'GET');check('removed device session rejected',()=>assert.equal(r.status,401));
 r=await call('/test/protected',undefined,{cookie:replace.cookie},'GET');check('replacement session works',()=>assert.equal(r.status,200));
 const member=(await pool.query('SELECT user_id FROM academy_campaign_members')).rows[0];await pool.query("UPDATE users SET status='active' WHERE id=$1",[member.user_id]);await pool.query("UPDATE academy_campaign_members SET access_until=now()-interval '1 day' WHERE user_id=$1",[member.user_id]);
 const fakeReq={headers:{},session:{}};const fakeRes={status(n){this.n=n;return this},json(v){this.v=v}};await mod.claimAcademyDevice(fakeReq,fakeRes,member.user_id);check('expired access blocked',()=>assert.equal(fakeRes.n,403));
 const total=(await pool.query('SELECT count(*)::int AS n FROM academy_campaign_members')).rows[0].n;check('existing redemption retained when campaign paused',()=>assert.equal(total,1));
 console.log('ALL',passed,'CHECKS PASSED; no real email sent');
 }finally{if(server)await new Promise(r=>server.close(r));if(pool)await pool.end();await adminPool.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await adminPool.end()}})().catch(e=>{console.error('TEST FAILED',e.message);process.exitCode=1});
