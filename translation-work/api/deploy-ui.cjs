const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const root='/var/lib/academy-translations',app='/var/www/academy.findandstudy.com',stage=root+'/ui-stage',backup=root+'/ui-backup-20261017',guards=JSON.parse(fs.readFileSync(root+'/ui-deploy-guards.json'));
for(const [p,hash] of Object.entries(guards)){if(crypto.createHash('sha256').update(fs.readFileSync(app+'/'+p)).digest('hex')!==hash)throw Error('Source changed: '+p)}
for(const p of ['client/src/lib/academy-ui.ts','client/src/lib/academy-ui-catalog.json'])if(fs.existsSync(app+'/'+p))throw Error('New target exists: '+p);
const targets=[...Object.keys(guards),'client/src/lib/academy-ui.ts','client/src/lib/academy-ui-catalog.json'];
for(const p of targets)if(!fs.existsSync(stage+'/'+p))throw Error('Staged file missing: '+p);
const catalog=JSON.parse(fs.readFileSync(stage+'/client/src/lib/academy-ui-catalog.json'));if(Object.keys(catalog).length!==23)throw Error('Incomplete catalog');
if(!process.argv.includes('--apply')){console.log(JSON.stringify({mode:'dry-run',sourceGuardsPassed:true,files:targets.length,languages:23}));process.exit()}
fs.mkdirSync(backup,{recursive:true});if(fs.existsSync(backup+'/dist-before.tgz'))throw Error('Backup already exists; inspect before retry');
cp.execFileSync('tar',['-czf',backup+'/dist-before.tgz','dist'],{cwd:app});
for(const p of Object.keys(guards)){fs.mkdirSync(path.dirname(backup+'/'+p),{recursive:true});fs.copyFileSync(app+'/'+p,backup+'/'+p)}
try{for(const p of targets)fs.copyFileSync(stage+'/'+p,app+'/'+p);cp.execFileSync('npm',['run','check'],{cwd:app,stdio:'inherit'});cp.execFileSync('npm',['run','build'],{cwd:app,stdio:'inherit'});console.log(JSON.stringify({mode:'applied',files:targets.length,languages:23,typecheckPassed:true,buildPassed:true,backup}));}
catch(e){for(const p of Object.keys(guards))fs.copyFileSync(backup+'/'+p,app+'/'+p);for(const p of targets.filter(p=>!guards[p]))if(fs.existsSync(app+'/'+p))fs.unlinkSync(app+'/'+p);cp.execFileSync('tar',['-xzf',backup+'/dist-before.tgz'],{cwd:app});throw Error('Deployment rolled back after validation/build failed')}
