const fs=require('fs'),cp=require('child_process'),crypto=require('crypto');
const app='/var/www/academy.findandstudy.com',root='/var/lib/academy-translations',dir=root+'/interface-review-20261018',out=root+'/outputs';
process.chdir(app);fs.mkdirSync(dir,{recursive:true,mode:0o700});
const runner=require(app+'/server/academy-translation-runner.cjs'),hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(app+'/'+p,'utf8')),flatten=(x,p='')=>Object.fromEntries(Object.entries(x).flatMap(([k,v])=>typeof v==='string'?[[p+k,v]]:Object.entries(flatten(v,p+k+'.'))));
async function main(){
 const auditBundle=dir+'/audit.cjs';cp.execFileSync(app+'/node_modules/.bin/esbuild',['server/interface-translation-audit.ts','--bundle','--platform=node','--format=cjs','--outfile='+auditBundle],{stdio:'ignore'});
 const audit=require(auditBundle).interfaceAudit(),english=flatten(read('client/src/i18n/locales/en/common.json')),config=JSON.parse(fs.readFileSync(root+'/ui-config.json','utf8'));
 if(config.approvedBudgetUSD!==100||config.model!=='gpt-4.1-mini-2025-04-14'||config.keyFile!=='/root/.config/findandstudy-academy/translation.env'||config.inputUSDPerMillionTokens!==0.4||config.outputUSDPerMillionTokens!==1.6)throw Error('CONFIG_REVIEW_REQUIRED');
 const jobs=[],inventory=[],files={};
 for(const row of audit.rows){const keys=[...new Set(row.missing)];if(!keys.length)continue;const file='client/src/i18n/locales/'+row.language+'/common.json',original=read(file);files[row.language]={file,hash:hash(original),original};
  for(const key of keys)if(!english[key])throw Error('SOURCE_KEY_MISSING: '+key);
  // Deduplicate identical labels within each language; one translated value can fill several keys.
  const strings=[...new Set(keys.map(k=>english[k]))],job={kind:'interface-review',id:20261018,language:row.language,title:'Academy administrative and agent interface labels; review-only, no publication',sourceHash:hash({keys,english:keys.map(k=>english[k]),base:hash(original)}),strings};job.jobHash=runner.jobDigest(job);jobs.push(job);inventory.push({language:row.language,keys,indices:keys.map(k=>strings.indexOf(english[k]))});
 }
 const plan={jobs};const snapshot={version:1,createdAt:new Date().toISOString(),requiresReview:true,sourceEnglishHash:hash(english),inventory,files,plan};
 const snapFile=dir+'/source.json';if(fs.existsSync(snapFile)){if(hash(JSON.parse(fs.readFileSync(snapFile)).plan)!==hash(plan))throw Error('SOURCE_CHANGED_REVIEW_REQUIRED');}else fs.writeFileSync(snapFile,JSON.stringify(snapshot,null,2),{mode:0o600});
 if(!process.argv.includes('--run')){console.log(JSON.stringify({mode:'plan',languages:jobs.length,missingEntries:inventory.reduce((n,x)=>n+x.keys.length,0),uniqueStrings:jobs.reduce((n,x)=>n+x.strings.length,0),paidRequests:0}));return;}
 const result=await runner.run(plan,{...config,maxJobsPerRun:30,maxStringsPerRequest:25,concurrency:4},out);console.log(JSON.stringify(result));
 const records=[],draftFiles={};for(const item of inventory){const job=jobs.find(j=>j.language===item.language),identity=hash({jobHash:job.jobHash,model:config.model,policy:'academy-queue-visible-strings-v1'}),file=out+'/'+identity+'.json';if(!fs.existsSync(file))throw Error('DRAFT_INCOMPLETE: '+item.language);const draft=JSON.parse(fs.readFileSync(file));runner.validate(job,{strings:draft.strings.map((text,index)=>({index,text}))});const target=structuredClone(files[item.language].original);for(let i=0;i<item.keys.length;i++){const key=item.keys[i],parts=key.split('.');let node=target;for(const p of parts.slice(0,-1))node=node[p]??={};const last=parts.at(-1);if(node[last])throw Error('EXISTING_VALUE_PROTECTED');node[last]=draft.strings[item.indices[i]];records.push({language:item.language,key,source:english[key],translation:node[last]});}draftFiles[item.language]=target;}
 const ledger=JSON.parse(fs.readFileSync(out+'/budget-ledger.json')),review={version:1,state:'AWAITING_USER_REVIEW',published:false,createdAt:new Date().toISOString(),records,draftFiles,sourceGuards:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,{file:v.file,hash:v.hash}])),sourceEnglishHash:hash(english),budget:{capUSD:100,accountedUSD:ledger.chargedUSD,actualUSD:ledger.entries.reduce((n,e)=>n+(e.actualUSD||0),0),remainingUSD:100-ledger.chargedUSD}};
 fs.writeFileSync(dir+'/review.json',JSON.stringify(review,null,2),{mode:0o600});fs.copyFileSync(dir+'/review.json',app+'/dist/public/interface-review-transfer-20261018.json');console.log(JSON.stringify({state:review.state,published:false,entries:records.length,languages:inventory.length,budget:review.budget}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
