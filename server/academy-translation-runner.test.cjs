'use strict';
// All requests below are injected mocks. No network or real credential is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const runner = require('./academy-translation-runner.cjs');
const POLICY = 'academy-queue-visible-strings-v1';
const sha = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-budget-offline-test-'));
  const keyFile = path.join(root, 'offline-fixture.env');
  fs.writeFileSync(keyFile, 'OPENAI_API_KEY=sk-offline-fixture-only\n', {mode:0o600});
  const outputs = path.join(root, 'outputs');
  fs.mkdirSync(outputs, {mode:0o700});
  const config = {approvedBudgetUSD:100, inputUSDPerMillionTokens:.4, outputUSDPerMillionTokens:1.6,
    model:'gpt-4.1-mini-2025-04-14', pricingSource:'https://platform.openai.com/docs/pricing',
    pricingVerifiedDate:'2026-10-17', maxOutputTokens:128, maxJobsPerRun:1, keyFile, concurrency:1};
  const job = {kind:'content', id:'offline-fixture', title:'Study abroad', language:'tr', sourceHash:'fixture', strings:['Study abroad'], fieldPaths:['title']};
  job.jobHash = runner.jobDigest(job);
  const ledgerFile = path.join(outputs, 'budget-ledger.json');
  const writeLedger = value => fs.writeFileSync(ledgerFile, JSON.stringify(value));
  return {root, outputs, config, job, ledgerFile, writeLedger, cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}

test('a missing canonical ledger is never silently initialized', async () => {
  const f=fixture(); let requests=0;
  try {
    await assert.rejects(runner.run({jobs:[f.job]}, f.config, f.outputs, async()=>{requests++;}), /Shared budget ledger is missing/);
    assert.equal(requests,0);
    assert.equal(fs.existsSync(f.ledgerFile),false);
    assert.equal(fs.existsSync(path.join(f.outputs,'run.lock')),false);
  } finally {f.cleanup();}
});

test('an invalid accounting number fails closed before an API request', async () => {
  const f=fixture(); let requests=0;
  try {
    f.writeLedger({chargedUSD:'2.5',entries:[]}); const original=fs.readFileSync(f.ledgerFile,'utf8');
    await assert.rejects(runner.run({jobs:[f.job]},f.config,f.outputs,async()=>{requests++;}),/Invalid budget ledger/);
    assert.equal(requests,0);assert.equal(fs.readFileSync(f.ledgerFile,'utf8'),original);
  } finally {f.cleanup();}
});

test('100 USD already accounted prevents even one additional request', async () => {
  const f=fixture(); let requests=0;
  try {
    f.writeLedger({chargedUSD:100,entries:[]}); const original=fs.readFileSync(f.ledgerFile,'utf8');
    await assert.rejects(runner.run({jobs:[f.job]},f.config,f.outputs,async()=>{requests++;}),/Approved budget limit reached before request/);
    assert.equal(requests,0);assert.equal(fs.readFileSync(f.ledgerFile,'utf8'),original);
  } finally {f.cleanup();}
});

test('an unresolved reservation is retained and blocks a duplicate request', async () => {
  const f=fixture(); let requests=0;
  try {
    const identity=sha({jobHash:f.job.jobHash,model:f.config.model,policy:POLICY})+'-0';
    f.writeLedger({chargedUSD:10,entries:[{identity,status:'reserved',reservedUSD:10}]});
    const original=fs.readFileSync(f.ledgerFile,'utf8');
    await assert.rejects(runner.run({jobs:[f.job]},f.config,f.outputs,async()=>{requests++;}),/RECONCILE_REQUIRED/);
    assert.equal(requests,0);assert.equal(fs.readFileSync(f.ledgerFile,'utf8'),original);
  } finally {f.cleanup();}
});

test('an ambiguous transport failure keeps its conservative reservation', async () => {
  const f=fixture();let requests=0;
  try {
    f.writeLedger({chargedUSD:2,entries:[]});
    await assert.rejects(runner.run({jobs:[f.job]},f.config,f.outputs,async()=>{requests++;throw Error('offline transport fixture');}),/reservation retained/);
    const ledger=JSON.parse(fs.readFileSync(f.ledgerFile,'utf8'));
    assert.equal(requests,1);assert.equal(ledger.entries.length,1);assert.equal(ledger.entries[0].status,'reserved');
    assert.ok(ledger.chargedUSD>2);assert.ok(ledger.chargedUSD<=100);
  } finally {f.cleanup();}
});

test('a validated checkpoint resumes without recharging, even at the budget cap', async () => {
  const f=fixture();let requests=0;
  try {
    f.writeLedger({chargedUSD:100,entries:[]});
    const identity=sha({jobHash:f.job.jobHash,model:f.config.model,policy:POLICY});
    fs.writeFileSync(path.join(f.outputs,identity+'.json'),JSON.stringify({jobHash:f.job.jobHash,model:f.config.model,policy:POLICY,strings:['Yurt dışında eğitim']}));
    const original=fs.readFileSync(f.ledgerFile,'utf8');
    const result=await runner.run({jobs:[f.job]},f.config,f.outputs,async()=>{requests++;});
    assert.equal(requests,0);assert.equal(result.chargedUSD,100);assert.equal(fs.readFileSync(f.ledgerFile,'utf8'),original);
  } finally {f.cleanup();}
});

test('another active writer lock is never removed by a failed competing run', async () => {
  const f=fixture();let requests=0;
  try {
    const lock=path.join(f.outputs,'run.lock');fs.writeFileSync(lock,'existing owner');
    await assert.rejects(runner.run({jobs:[f.job]},f.config,f.outputs,async()=>{requests++;}),{code:'EEXIST'});
    assert.equal(requests,0);assert.equal(fs.readFileSync(lock,'utf8'),'existing owner');
  } finally {f.cleanup();}
});


test('a charged chunk without its checkpoint cannot be billed a second time', async () => {
 const f=fixture();let requests=0;
 try {
  const identity=sha({jobHash:f.job.jobHash,model:f.config.model,policy:POLICY})+'-0';
  f.writeLedger({chargedUSD:1,entries:[{identity,status:'charged',actualUSD:.01}]});
  const before=fs.readFileSync(f.ledgerFile,'utf8');
  await assert.rejects(runner.run({jobs:[f.job]},f.config,f.outputs,async()=>{requests++;}),/RECONCILE_REQUIRED/);
  assert.equal(requests,0);assert.equal(fs.readFileSync(f.ledgerFile,'utf8'),before);
  assert.equal(fs.existsSync(path.join(f.outputs,'run.lock')),false);
 } finally {f.cleanup();}
});

test('retained charged chunks rebuild a combined checkpoint at the cap without an API request', async () => {
 const f=fixture();let requests=0;
 try {
  const identity=sha({jobHash:f.job.jobHash,model:f.config.model,policy:POLICY});
  f.writeLedger({chargedUSD:100,entries:[{identity:identity+'-0',status:'charged',actualUSD:.01}]});
  const before=fs.readFileSync(f.ledgerFile,'utf8');fs.mkdirSync(path.join(f.outputs,'chunks'));
  fs.writeFileSync(path.join(f.outputs,'chunks',identity+'-0.json'),JSON.stringify({jobHash:f.job.jobHash,model:f.config.model,policy:POLICY,start:0,strings:['Yurt dışında eğitim'],usage:{input_tokens:3,output_tokens:4}}));
  const result=await runner.run({jobs:[f.job]},f.config,f.outputs,async()=>{requests++;});
  assert.equal(requests,0);assert.equal(result.completed,1);
  assert.equal(fs.readFileSync(f.ledgerFile,'utf8'),before);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.outputs,identity+'.json'))).strings,['Yurt dışında eğitim']);
 } finally {f.cleanup();}
});

test('semantic review has a distinct identity and retains paired current values', () => {
 const f=fixture();try {
  const review={...f.job,operation:'semantic-review-v1',reviewTranslations:['Yanlış anlam']};
  review.jobHash=runner.jobDigest(review);
  assert.notEqual(review.jobHash,f.job.jobHash);
  const body=runner.payload(review,f.config),input=JSON.parse(body.input);
  assert.equal(input.fields.s0,'Study abroad');assert.equal(input.currentTranslations.s0,'Yanlış anlam');
  assert.match(body.instructions,/study versus work permits/);assert.match(body.instructions,/Use only the supplied source/);
  assert.throws(()=>runner.payload({...review,reviewTranslations:[]},f.config),/count mismatch/);
 }finally{f.cleanup();}
});

test('punctuation cannot replace a heading while multilingual text remains valid',()=>{
 assert.throws(()=>runner.validate({strings:['Who Hungary Fits Best']},{strings:[{index:0,text:'}'}]}),/Non-text output/);
 assert.deepEqual(runner.validate({strings:['Quality']},{strings:[{index:0,text:'品質'}]}),['品質']);
 assert.deepEqual(runner.validate({strings:[', an']},{strings:[{index:0,text:'،'}]}),['،']);
 assert.throws(()=>runner.validate({strings:[', report the']},{strings:[{index:0,text:','}]}),/Non-text output/);
});

test('legacy masked requests expose token meaning without trapping generation',()=>{
 const f=fixture();try{
  const body=runner.payload({...f.job,strings:['A track record since the 1980s','About 1 in 7 students']},f.config),p=body.text.format.schema.properties.fields.properties;
  const input=JSON.parse(body.input);assert.deepEqual(input.protectedValues.s1,{'__FAS_KEEP_1_0__':'1','__FAS_KEEP_1_1__':'7'});
  assert.equal(p.s0.pattern,'\\S');assert.equal(p.s1.pattern,'\\S');
 }finally{f.cleanup();}
});

test('literal review exposes source ratios and preserves post-response number checks',async()=>{
 const f=fixture();try{
  const job={...f.job,strings:['About 1 in 7 students'],operation:'semantic-review-v1',reviewTranslations:['1 içinde 7 öğrenci']};job.jobHash=runner.jobDigest(job);const c={...f.config,literalProtectedValues:true};
  const payload=runner.payload(job,c),input=JSON.parse(payload.input);assert.equal(input.fields.s0,'About 1 in 7 students');assert.deepEqual(input.protectedValues,{});assert.equal(payload.text.format.schema.properties.fields.properties.s0.pattern,'\\S');
  f.writeLedger({chargedUSD:32,entries:[]});const result=await runner.run({jobs:[job]},c,f.outputs,async()=>({ok:true,json:async()=>({status:'completed',usage:{input_tokens:20,output_tokens:20},output:[{content:[{type:'output_text',text:JSON.stringify({fields:{s0:"Yaklaşık her 7 öğrenciden 1'i"}})}]}]})}));assert.equal(result.completed,1);
  assert.throws(()=>runner.validate(job,{strings:[{index:0,text:'Yaklaşık her 8 öğrenciden 1'}]}),/Protected numbers/);
 }finally{f.cleanup();}
});

test('equivalent localized digits and grouping normalize without changing amounts or links',()=>{
 const normal=(source,text,language='bn')=>runner.normalizeEquivalentNumbers({strings:[source],language},{strings:[{index:0,text}]}).strings[0].text;
 assert.equal(normal('30 hours in the 1980s','১৯৮০-এর দশকে ৩০ ঘণ্টা'),'1980-এর দশকে 30 ঘণ্টা');
 assert.equal(normal('Top 1,000 universities','As 1.000 melhores universidades','pt'),'As 1,000 melhores universidades');
 assert.equal(normal('Top 1,000 universities','Les 1\u202f000 meilleures universités','fr'),'Les 1,000 meilleures universités');
 assert.equal(normal('The fee is 1,000.50','Ücret 1.000,50','tr'),'Ücret 1,000.50');
 assert.equal(normal('Code 001','Code 1','fr'),'Code 1');
 assert.throws(()=>runner.validate({strings:['Code 001']},{strings:[{index:0,text:normal('Code 001','Code 1','fr')}]}),/Protected numbers/);
 assert.equal(normal('Pay 500','Pague 5000','pt'),'Pague 5000');
 assert.equal(normal('Visit https://example.com/123 and pay 30','Посетите https://example.com/123 и оплатите ۳۰','fa'),'Посетите https://example.com/123 и оплатите 30');
 assert.equal(normal('1 out of 7 students','7 öğrenciden 1 öğrenci','tr'),'7 öğrenciden 1 öğrenci');
});

test('natural translated numeric forms need explicit source-number evidence',()=>{
 const check=(source,text)=>runner.validate({strings:[source]},{strings:[{index:0,text}]});
 assert.doesNotThrow(()=>check('One student in seven','7名中1名の学生'));
 assert.doesNotThrow(()=>check('Applications close in August 2026','締め切りは2026年8月です'));
 assert.doesNotThrow(()=>check('On 10 October 2017','2017年10月10日'));
 assert.doesNotThrow(()=>check('a failed year adds a year of fees','낙제 시 추가 1년 등록금이 부과됩니다.'));
 assert.doesNotThrow(()=>check('September – January; mid-February; February intakes','9月–1月；2月中旬；2月入学'));
 assert.doesNotThrow(()=>check('Oct – Jan; Feb – May; July – Aug','10月–1月；2月–5月；7月–8月'));
 assert.doesNotThrow(()=>check('first-year students, second semester; twin or triple rooms','1학년, 2학기; 2인실 또는 3인실'));
 assert.doesNotThrow(()=>check('one and a half times the nominal length','规定时长的1.5倍'));
 assert.throws(()=>check('one and a half times the nominal length','规定时长的1.6倍'),/Protected numbers/);
 assert.throws(()=>check('May students work?','5名の学生が働けます'),/Protected numbers/);
 assert.throws(()=>check('March forward','3歩進む'),/Protected numbers/);
 assert.throws(()=>check('Pay a fee','支払いは1です'),/Protected numbers/);
 assert.throws(()=>check('May students work?','5名の学生が働けます'),/Protected numbers/);
 assert.throws(()=>check('Seven students','8名の学生'),/Protected numbers/);
 assert.throws(()=>check('Pay 30','31を支払う'),/Protected numbers/);
 assert.throws(()=>check('Visit https://example.com/one','Visit https://example.com/one and pay 1'),/Protected numbers/);
});

test('semantic review chunks keep source/current pairs aligned and reuse the shared ledger', async () => {
 const f=fixture();try {
  const job={...f.job,strings:['First source','Second source','Third source'],operation:'semantic-review-v1',reviewTranslations:['Birinci','İkinci','Üçüncü']};job.jobHash=runner.jobDigest(job);
  f.writeLedger({chargedUSD:32,entries:[]});let requests=0;
  const result=await runner.run({jobs:[job]},{...f.config,maxStringsPerRequest:2},f.outputs,async(_url,options)=>{
   const body=JSON.parse(options.body),input=JSON.parse(body.input),curr=Object.values(input.currentTranslations);
   assert.deepEqual(curr,requests===0?['Birinci','İkinci']:['Üçüncü']);requests++;
   const fields=Object.fromEntries(curr.map((value,i)=>['s'+i,value]));
   return {ok:true,json:async()=>({status:'completed',usage:{input_tokens:20,output_tokens:20},output:[{content:[{type:'output_text',text:JSON.stringify({fields})}]}]})};
  });
  assert.equal(requests,2);assert.equal(result.completed,1);const ledger=JSON.parse(fs.readFileSync(f.ledgerFile));
  assert.equal(ledger.entries.length,2);assert.ok(ledger.entries.every(e=>e.status==='charged'));assert.ok(ledger.chargedUSD>32&&ledger.chargedUSD<33);
  const before=fs.readFileSync(f.ledgerFile,'utf8');await runner.run({jobs:[job]},f.config,f.outputs,()=>{throw Error('Must reuse');});assert.equal(fs.readFileSync(f.ledgerFile,'utf8'),before);
 }finally{f.cleanup();}
});
