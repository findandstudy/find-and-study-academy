const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{clearOwnedDeadLock}=require('./translation-worker-lock.cjs');
test('foreign-container and legacy locks survive a locally missing PID',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'academy-lock-')),file=path.join(dir,'run.lock');let probes=0;
 try{for(const hostname of['other-container',undefined]){const value={owner:'academy-translation-worker',pid:8123,...(hostname?{hostname}:{})};const raw=JSON.stringify(value);fs.writeFileSync(file,raw);assert.equal(clearOwnedDeadLock(file,{hostname:'this-container',isAlive:()=>{probes++;return false;}}),'retained');assert.equal(fs.readFileSync(file,'utf8'),raw);}assert.equal(probes,0);}finally{fs.rmSync(dir,{recursive:true});}
});
test('only a proven dead owner in the same namespace can release its lock',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'academy-lock-')),file=path.join(dir,'run.lock');
 try{fs.writeFileSync(file,JSON.stringify({owner:'academy-translation-worker',hostname:'same',pid:123}));assert.equal(clearOwnedDeadLock(file,{hostname:'same',isAlive:()=>true}),'retained');assert.equal(clearOwnedDeadLock(file,{hostname:'same',isAlive:()=>false}),'removed');assert.equal(fs.existsSync(file),false);assert.equal(clearOwnedDeadLock(file),'absent');}finally{fs.rmSync(dir,{recursive:true});}
});
test('malformed, replaced and symbolic lock files are retained',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'academy-lock-')),file=path.join(dir,'run.lock');
 try{fs.writeFileSync(file,'{');assert.equal(clearOwnedDeadLock(file),'retained');fs.writeFileSync(file,JSON.stringify({owner:'academy-translation-worker',hostname:'same',pid:123}));assert.equal(clearOwnedDeadLock(file,{hostname:'same',isAlive:()=>{fs.writeFileSync(file,'new-owner');return false;}}),'retained');assert.equal(fs.readFileSync(file,'utf8'),'new-owner');fs.unlinkSync(file);fs.writeFileSync(path.join(dir,'target'),'{}');fs.symlinkSync(path.join(dir,'target'),file);assert.equal(clearOwnedDeadLock(file),'retained');}finally{fs.rmSync(dir,{recursive:true});}
});
