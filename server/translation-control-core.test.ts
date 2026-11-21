import {strict as a} from 'node:assert';
import {test} from 'node:test';
import {sourceValue,sourceHash,manifest,reconstruct,validateResult,reuseFragments,budgetLedgerSummary} from './translation-control-core';
const content={title:'Study 2026',description:'Visit https://example.com',content:'<p title="a > b">Hello &amp; welcome <a href="https://example.com?q=2">Apply 25</a></p><!-- keep --><script>private("do not translate")</script>'};
test('HTML tags, quoted attributes, URLs, comments and scripts survive translation',()=>{const m=manifest('content',content),out=reconstruct('content',content,m.fields.map(f=>'TR '+f.text));a.equal(validateResult('content',content,out),out);a.ok(out.content.includes('title="a > b"'));a.ok(out.content.includes('<script>private("do not translate")</script>'));a.ok(out.content.includes('href="https://example.com?q=2"'));a.ok(out.content.includes('Hello &amp; welcome'));});
test('Protected numbers and placeholders cannot be edited during review',()=>{const out=reconstruct('content',content,manifest('content',content).fields.map(f=>f.text));out.title='Study 2027';a.throws(()=>validateResult('content',content,out));});
test('Native numeric date and cardinal forms require matching source facts',()=>{
 const source={title:'Course',description:null,content:'<p>One in seven students</p><p>Apply in August 2026</p>'};
 a.doesNotThrow(()=>validateResult('content',source,{...source,content:'<p>7名中1名の学生</p><p>2026年8月に申請</p>'}));
 a.throws(()=>validateResult('content',source,{...source,content:'<p>8名中1名の学生</p><p>2026年8月に申請</p>'}));
});
test('Unexpected markup cannot enter a text fragment',()=>{const out=reconstruct('content',content,manifest('content',content).fields.map(f=>f.text));out.content=out.content.replace('Hello','<img src=x onerror=alert(1)>Hello');a.throws(()=>validateResult('content',content,out));});
test('source-aligned article slots survive natural omission without losing HTML or review alignment',()=>{
 const source={title:'Options',description:null,content:'<p><strong>Foundation</strong>, a<strong>university</strong>.</p>'};
 const strings=['Seçenekler','Hazırlık',',','üniversite'],out=reconstruct('content',source,strings);
 a.equal(validateResult('content',source,out),out);
 a.deepEqual(manifest('content',out,source).fields.map(f=>f.text),strings);
 a.deepEqual(reuseFragments('content',source,out,source),strings);
 a.throws(()=>validateResult('content',source,{...out,content:out.content.replace('<strong>üniversite</strong>','<em>üniversite</em>')}));
 a.throws(()=>validateResult('content',source,{...out,title:','}));
 a.throws(()=>validateResult('content',source,{...out,content:out.content.replace('Hazırlık',',')}));
});
test('Only changed fragments need API translation',()=>{const before={title:'Title',description:null,content:'<p>First</p><p>Second</p>'},translated={title:'Başlık',description:null,content:'<p>Birinci</p><p>İkinci</p>'},after={...before,content:'<p>First</p><p>Changed</p>'};a.deepEqual(reuseFragments('content',before,translated,after),['Başlık','Birinci',null]);});
test('Ambiguous repeated fragments are not reused incorrectly',()=>{const before={title:'Title',description:null,content:'<p>Repeat</p><p>Repeat</p>'},translated={title:'Başlık',description:null,content:'<p>Bir</p><p>İki</p>'};a.deepEqual(reuseFragments('content',before,translated,before),['Başlık',null,null]);});
const quiz={title:'Quiz',description:null,questions:[{id:'q1',type:'mcq',text:'Question 1',options:['Option 1','Option 2'],answerIndex:1,explanation:'Because 2'},{id:'q1',type:'boolean',text:'Question 2',answer:true}]};
test('Quiz parser IDs, options, explanations and original grading survive',()=>{const source=sourceValue('quiz',quiz),out=reconstruct('quiz',source,manifest('quiz',source).fields.map(f=>'TR '+f.text));validateResult('quiz',source,out);a.equal(out.questions[1].id,'q1__duplicate_2');a.equal(out.questions[0].options.length,2);a.ok(out.questions[0].explanation);a.ok(!('answerIndex' in out.questions[0]));});
test('Reordered question IDs are rejected',()=>{const source=sourceValue('quiz',quiz),out=reconstruct('quiz',source,manifest('quiz',source).fields.map(f=>f.text));out.questions.reverse();a.throws(()=>validateResult('quiz',source,out));});
test('Source hashes ignore unrelated metadata and detect grading/content changes',()=>{a.equal(sourceHash('content',content),sourceHash('content',{...content,status:'published',order:5}));a.notEqual(sourceHash('quiz',quiz),sourceHash('quiz',{...quiz,questions:[{...quiz.questions[0],answerIndex:0},quiz.questions[1]]}));});
test('C0 control characters in drafts are rejected',()=>{const out=reconstruct('content',content,manifest('content',content).fields.map(f=>f.text));out.title+='\0';a.throws(()=>validateResult('content',content,out));});
test('Missing or unreadable ledger stays unavailable and does not disclose filesystem errors',()=>{
 for(const [code,reason]of [['ENOENT','LEDGER_MISSING'],['EACCES','LEDGER_UNREADABLE'],['EIO','LEDGER_UNREADABLE']] as const){
  const result=budgetLedgerSummary(()=>{throw Object.assign(new Error('private filesystem detail'),{code});});
  a.equal(result.reason,reason);a.equal(result.error,'BUDGET_UNAVAILABLE');a.equal(result.accountedUSD,null);a.equal(result.remainingUSD,null);a.ok(!JSON.stringify(result).includes('private'));
 }
});
test('Invalid JSON, accounting and ledger entries receive safe distinct diagnostics',()=>{
 const cases=[['{','LEDGER_INVALID_JSON'],['null','LEDGER_INVALID_ACCOUNTING'],['{"chargedUSD":"3.2","entries":[]}','LEDGER_INVALID_ACCOUNTING'],['{"chargedUSD":-1,"entries":[]}','LEDGER_INVALID_ACCOUNTING'],['{"chargedUSD":1e999,"entries":[]}','LEDGER_INVALID_ACCOUNTING'],['{"chargedUSD":2.5}','LEDGER_INVALID_ENTRIES']] as const;
 for(const [raw,reason]of cases){const result=budgetLedgerSummary(()=>raw);a.equal(result.reason,reason);a.equal(result.error,'BUDGET_UNAVAILABLE');a.equal(result.remainingUSD,null);}
});
test('Accounted charges include reservations and are never reconstructed or refunded by diagnostics',()=>{
 const raw=JSON.stringify({chargedUSD:18.3,entries:[{status:'charged',actualUSD:.3},{status:'reserved',reservedUSD:18}]});
 const result=budgetLedgerSummary(()=>raw);a.equal(result.accountedUSD,18.3);a.equal(result.remainingUSD,81.7);a.equal(result.error,undefined);a.equal(JSON.parse(raw).chargedUSD,18.3);
});
test('Exhausted or exceeded shared budget remains zero available without rewriting accounting',()=>{
 for(const chargedUSD of [100,100.5]){const result=budgetLedgerSummary(()=>JSON.stringify({chargedUSD,entries:[]}));a.equal(result.accountedUSD,chargedUSD);a.equal(result.remainingUSD,0);a.equal(result.error,undefined);}
});
