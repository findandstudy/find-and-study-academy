// Guarded insert-only publisher. Generation, dry-run, apply and public verification are separate.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),{createRequire}=require('node:module');
const req=createRequire(process.cwd()+'/package.json');req('dotenv').config({quiet:true});const {Client}=req('pg');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');const digest=v=>hash(canonical(v));
function decode(v){for(let n=0;n<4&&typeof v==='string';n++)v=JSON.parse(v);if(!Array.isArray(v))throw Error('Invalid questions');const reserved=new Set(v.map(q=>q.id)),seen=new Set();return v.map((q,i)=>{q={...q};if(seen.has(q.id)){let id=q.id+'__duplicate_'+(i+1);while(reserved.has(id)||seen.has(id))id+='_';q.id=id;}seen.add(q.id);return q;});}
async function main(){
 const file=process.argv[2];if(!file||file.startsWith('--'))throw Error('Private bundle path required');
 const bundle=JSON.parse(fs.readFileSync(file)),apply=process.argv.includes('--apply'),verify=process.argv.includes('--verify-public');
 if(bundle.mode!=='repair-existing-only')throw Error('Repair-only bundle required');if(apply&&verify)throw Error('Separate apply and verify');if(bundle.version!==1||bundle.rows.some(r=>r.kind!=='lesson')||digest(bundle.rows)!==bundle.bundleHash||!bundle.rows.length)throw Error('Invalid bundle');
 const runner=require(path.join(path.dirname(file),'translate.cjs'));const client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();let report={bundleHash:bundle.bundleHash,mode:verify?'verify-public':apply?'apply':'dry-run',inserted:[],skipped:[],backups:[]};
 try{
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  if(apply){const approval=JSON.parse(fs.readFileSync(file+'.dry-run.json'));if(approval.bundleHash!==bundle.bundleHash||approval.mode!=='dry-run')throw Error('Matching successful dry-run required');}
  const cache=new Map();
  for(const row of bundle.rows){
   if(row.kind!=='lesson'||row.jobHash!==runner.jobDigest(row.job)||row.job.jobHash!==row.jobHash||['id','kind','language','sourceHash'].some(k=>row.job[k]!==row[k]))throw Error('Invalid job identity');
   runner.validate(row.job,{strings:row.strings.map((text,index)=>({index,text}))});
   const lesson=row.kind==='lesson',table=lesson?'contents':'quizzes',translationTable=lesson?'content_translations':'quiz_translations',idColumn=lesson?'content_id':'quiz_id';
   const found=await client.query(`SELECT title,description,${lesson?'content':'questions'} FROM ${table} WHERE id=$1 FOR SHARE`,[row.id]);if(found.rows.length!==1)throw Error('Missing source');
   const source=found.rows[0];if(!lesson)source.questions=decode(source.questions);if(digest(source)!==row.sourceHash)throw Error('Source changed '+row.id);
   const t=row.translation;
   if(!lesson){let index=2;if(t.title!==row.strings[0]||t.description!==row.strings[1]||t.questions.length!==source.questions.length)throw Error('Quiz shape mismatch');for(let n=0;n<source.questions.length;n++){const q=source.questions[n],tr=t.questions[n];if(tr.id!==q.id||tr.text!==row.strings[index++])throw Error('Question order changed');if(q.type==='mcq'){if(JSON.stringify(tr.options)!==JSON.stringify(row.strings.slice(index,index+q.options.length)))throw Error('Option order changed');index+=q.options.length;}}if(index!==row.strings.length)throw Error('Extra strings');}
   const identity={kind:row.kind,id:row.id,language:row.language};
   if(verify){
    const key=row.kind+':'+row.language;if(!cache.has(key)){const response=await fetch('https://academy.findandstudy.com/api/public/'+(lesson?'contents':'quizzes')+'?lang='+row.language);if(!response.ok)throw Error('Public HTTP '+response.status);cache.set(key,await response.json());}
    const actual=cache.get(key)[lesson?'contents':'quizzes'].find(i=>i.id===row.id);if(!actual||actual.title!==t.title||actual.description!==t.description)throw Error('Public title/description mismatch');
    if(lesson){if(actual.content!==t.content)throw Error('Public HTML mismatch');}else{const questions=decode(actual.questions);if(questions.length!==source.questions.length)throw Error('Question count mismatch');for(let n=0;n<questions.length;n++){const expected={...source.questions[n],...t.questions[n]};if(digest(questions[n])!==digest(expected))throw Error('Public question/grading mismatch');}}
    report.inserted.push({...identity,allFieldsMatch:true});continue;
   }
   const existing=await client.query('SELECT * FROM content_translations WHERE content_id=$1 AND language=$2 FOR UPDATE',[row.id,row.language]);
   if(existing.rowCount!==1)throw Error('Existing published translation required');
   const old=existing.rows[0];if(old.status!=='published')throw Error('Existing status changed');
   for(const field of ['title','description','content'])if(createHash('sha256').update(old[field]||'').digest('hex')!==row.existingHashes[field])throw Error('Existing translation changed: '+row.id+' '+row.language);
   if(apply){report.backups.push(old);await client.query('UPDATE content_translations SET title=$1,description=$2,content=$3 WHERE id=$4',[t.title,t.description,t.content,old.id]);identity.translationId=old.id;}
   report.inserted.push(identity);
  }
  if(apply)fs.writeFileSync(file+'.applied-'+Date.now()+'.json',JSON.stringify(report,null,2),{mode:0o600,flag:'wx'});
  await client.query(apply?'COMMIT':'ROLLBACK');
  if(!apply)fs.writeFileSync(file+(verify?'.verified.json':'.dry-run.json'),JSON.stringify(report,null,2),{mode:0o600});
  console.log(JSON.stringify({mode:report.mode,rows:report.inserted.length,skipped:report.skipped.length,bundleHash:bundle.bundleHash}));
 }catch(e){await client.query('ROLLBACK');throw e;}finally{await client.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
