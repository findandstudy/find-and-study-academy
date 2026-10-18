const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),path=require('path');
const app='/var/www/academy.findandstudy.com',root='/var/lib/academy-translations/signup-refine-20261018';
const guards={'client/src/pages/Signup.tsx':'47a9f214ce71fd7c207f0f0c4165846fd9aa3d23','client/src/components/layouts/AuthCard.tsx':'f6b5f7a4b4fa2004a8483db273770703d42d3cb3'},added='client/src/lib/signup-steps.json',files=[...Object.keys(guards),added],ref='efaeddcc15a683e3e6f7dd9cee6a9b4c10aacddb';
fs.mkdirSync(root,{recursive:true});for(const [p,sha] of Object.entries(guards)){const b=fs.readFileSync(app+'/'+p);if(crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex')!==sha)throw Error('Source changed '+p);}
if(fs.existsSync(app+'/'+added))throw Error('New target already exists');
for(const p of files){fs.mkdirSync(path.dirname(root+'/stage/'+p),{recursive:true});cp.execFileSync('curl',['-fLsS','https://raw.githubusercontent.com/findandstudy/find-and-study-academy/'+ref+'/'+p,'-o',root+'/stage/'+p]);}
const copy=JSON.parse(fs.readFileSync(root+'/stage/'+added));if(Object.keys(copy).length!==23||Object.values(copy).some(x=>x.length!==3||x.some(y=>!y.trim())))throw Error('Incomplete step labels');
if(!process.argv.includes('--apply')){console.log('REFINE_DRY_RUN_OK: source guards, 23 languages');process.exit();}
if(fs.existsSync(root+'/before.tgz'))throw Error('Backup exists');
cp.execFileSync('tar',['-czf',root+'/before.tgz','dist',...Object.keys(guards)],{cwd:app});
try{for(const p of files)fs.copyFileSync(root+'/stage/'+p,app+'/'+p);cp.execFileSync('npm',['run','check'],{cwd:app,stdio:'inherit'});cp.execFileSync('npm',['run','build'],{cwd:app,stdio:'inherit'});console.log('SIGNUP_REFINE_DEPLOY_OK');}catch(e){fs.rmSync(app+'/'+added,{force:true});cp.execFileSync('tar',['-xzf',root+'/before.tgz'],{cwd:app});throw e;}
