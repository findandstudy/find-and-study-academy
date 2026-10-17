const fs=require('fs'),cp=require('child_process'),root='/var/lib/academy-translations';
const read=()=>JSON.parse(fs.readFileSync(root+'/bulk-state.json'));
const alive=pid=>{try{process.kill(pid,0);return true}catch{return false}};
(async()=>{while(true){const s=read();if(s.status==='running'){if(!alive(s.pid))throw Error('Original worker exited unexpectedly; inspect state before resuming');await new Promise(resolve=>setTimeout(resolve,15000));continue}if(s.status==='stopped-on-error')throw Error('Original worker stopped on error; no automatic retry');if(fs.existsSync(root+'/bulk-worker.lock')||fs.existsSync(root+'/outputs/run.lock')){await new Promise(resolve=>setTimeout(resolve,15000));continue}break}
 const result=cp.spawnSync(process.execPath,[root+'/bulk-repair-v2.cjs'],{env:{...process.env,ACADEMY_REPAIR_POLICY:'v6'},stdio:'inherit'});if(result.status!==0)throw Error('Second repair pass stopped; inspect bulk-state-v6.json');console.log('Both guarded bulk passes finished; source/legacy review may remain');
})().catch(e=>{console.error(e.message);process.exitCode=1});
