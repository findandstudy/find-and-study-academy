const fs=require('fs'),path=require('path'),r=require('/var/lib/academy-translations/translate-ui.cjs');
const root='/var/lib/academy-translations',plan=JSON.parse(fs.readFileSync(root+'/ui-jobs.json')),source=JSON.parse(fs.readFileSync(root+'/ui-source.json'));
const expected=new Map(plan.jobs.map(j=>[j.jobHash,j])),catalog={};
for(const name of fs.readdirSync(root+'/outputs').filter(n=>n.endsWith('.json'))){const out=JSON.parse(fs.readFileSync(root+'/outputs/'+name));const job=expected.get(out.jobHash);if(!job)continue;if(out.kind!=='ui'||out.model!=='gpt-4.1-mini-2025-04-14'||out.policy!=='academy-visible-strings-v5')throw Error('UI output identity mismatch');r.validate(job,{strings:out.strings.map((text,index)=>({index,text}))});catalog[job.language]=Object.fromEntries(source.strings.map((s,i)=>[s,out.strings[i]]));}
if(Object.keys(catalog).length!==23)throw Error('UI languages incomplete: '+Object.keys(catalog).join(','));
for(const d of Object.values(catalog))if(Object.keys(d).length!==source.strings.length)throw Error('Dictionary coverage mismatch');
const destination=process.argv[2];if(!destination)throw Error('Destination required');fs.writeFileSync(destination,JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({languages:Object.keys(catalog).length,stringsPerLanguage:source.strings.length,totalStrings:Object.keys(catalog).length*source.strings.length,allProtectedTokensValidated:true}));
