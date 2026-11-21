'use strict';
const fs=require('node:fs'),os=require('node:os');
// Docker PID namespaces are independent. An absent local PID says nothing
// about a lock created by another container or an older unscoped runner.
function clearOwnedDeadLock(file,{hostname=os.hostname(),isAlive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code!=='ESRCH';}}}={}){
 if(!fs.existsSync(file))return'absent';
 try{
  const before=fs.lstatSync(file);if(!before.isFile()||before.isSymbolicLink())return'retained';
  const raw=fs.readFileSync(file,'utf8'),lock=JSON.parse(raw);
  if(lock.owner!=='academy-translation-worker'||lock.hostname!==hostname||!Number.isSafeInteger(lock.pid)||lock.pid<2||isAlive(lock.pid))return'retained';
  const current=fs.lstatSync(file);if(current.ino!==before.ino||current.dev!==before.dev||fs.readFileSync(file,'utf8')!==raw)return'retained';
  fs.unlinkSync(file);return'removed';
 }catch{return'retained';}
}
module.exports={clearOwnedDeadLock};
