// Read-only export of learning sources and translation presence. No user/session data.
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const req=createRequire(process.cwd()+'/package.json');req('dotenv').config({quiet:true});const {Client}=req('pg');
async function main(){
 const output=process.argv[2];if(!output)throw Error('Supply a private output JSON path');
 const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
 try{
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const contents=await c.query("SELECT id,type,title,description,content,status FROM contents WHERE status='published' AND type='lesson' ORDER BY id");
  const quizzes=await c.query("SELECT id,title,description,questions,status FROM quizzes WHERE status='active' ORDER BY id");
  const lessons=await c.query('SELECT content_id AS id,language,status FROM content_translations');
  const quizTranslations=await c.query('SELECT quiz_id AS id,language,status FROM quiz_translations');
  if(!contents.rows.length||!quizzes.rows.length)throw Error('Empty catalog export');
  const data={version:1,exportedAt:new Date().toISOString(),contents:contents.rows,quizzes:quizzes.rows,lessonTranslations:lessons.rows,quizTranslations:quizTranslations.rows};
  fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true,mode:0o700});fs.writeFileSync(output,JSON.stringify(data),{mode:0o600,flag:'wx'});
  await c.query('COMMIT');console.log(JSON.stringify({state:'private-read-only-snapshot',lessons:data.contents.length,quizzes:data.quizzes.length}));
 }catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
