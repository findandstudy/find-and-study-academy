const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),path=require('path');
const app='/var/www/academy.findandstudy.com', root='/var/lib/academy-translations/signup-wizard-20261018';
const files={'client/src/pages/Signup.tsx':'ec726fe9a7f9235bf38eb4a0c7438624c59aa7fc','client/src/components/layouts/AuthCard.tsx':'a3878e4bf0fcff24967ba311aa016a430f212bcb'};
const ref='384483512a3e7198e8273624694011887ac8f83d';
fs.mkdirSync(root,{recursive:true});
for(const [p,sha] of Object.entries(files)){const b=fs.readFileSync(app+'/'+p);const actual=crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');if(actual!==sha)throw Error('Source changed: '+p);fs.mkdirSync(path.dirname(root+'/stage/'+p),{recursive:true});cp.execFileSync('curl',['-fLsS','https://raw.githubusercontent.com/findandstudy/find-and-study-academy/'+ref+'/'+p,'-o',root+'/stage/'+p]);}
if(!process.argv.includes('--apply')){console.log('WIZARD_DRY_RUN_OK: 2 source hashes verified');process.exit();}
if(fs.existsSync(root+'/before.tgz'))throw Error('Backup exists, inspect before retry');
cp.execFileSync('tar',['-czf',root+'/before.tgz','dist',...Object.keys(files)],{cwd:app});
try{for(const p of Object.keys(files))fs.copyFileSync(root+'/stage/'+p,app+'/'+p);cp.execFileSync('npm',['run','check'],{cwd:app,stdio:'inherit'});cp.execFileSync('npm',['run','build'],{cwd:app,stdio:'inherit'});console.log('WIZARD_DEPLOY_OK');}catch(e){cp.execFileSync('tar',['-xzf',root+'/before.tgz'],{cwd:app});throw e;}
