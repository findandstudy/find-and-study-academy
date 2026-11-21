// Private exported curriculum + real React components, mocked writes only.
// Never creates live attempts, sends messages, or issues real certificates.
import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import{build}from'esbuild';import{chromium}from'playwright';
const option=n=>process.argv.find(x=>x.startsWith(`--${n}=`))?.slice(n.length+3);
const out=path.resolve(option('out')||'../assessment-visual-review');await fs.mkdir(out,{recursive:true});
const snapshot=JSON.parse(await fs.readFile(out+'/live-assessment-snapshot.json','utf8'));
const cssFile=(await fs.readdir('dist/public/assets')).find(x=>/^index-.*\.css$/.test(x));const css=await fs.readFile('dist/public/assets/'+cssFile);
const script=(await build({bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',loader:{'.png':'dataurl'},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated-fixture-writes',setup(b){
 b.onResolve({filter:/^@\/store\/(auth|data)$/},a=>({path:a.path,namespace:'fixture'}));
 b.onResolve({filter:/^@\/lib\/api$/},a=>({path:a.path,namespace:'fixture'}));
 b.onResolve({filter:/^@\/hooks\/use-toast$/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'ts',contents:a.path.endsWith('auth')?`export const useAuthStore=()=>({user:{id:'visual-test-user',name:'SYNTHETIC TEST RECIPIENT',role:'agent'}});`:a.path.endsWith('data')?`export const useDataStore=()=>({addAttempt:a=>window.savedAttempts.push(a)});`:a.path.includes('use-toast')?`export const useToast=()=>({toast:t=>window.toasts.push(t)});`:`export async function submitAttempt(input){window.submitRequests++;await new Promise(r=>setTimeout(r,window.submitDelay||0));if(window.failSubmission)return{success:false,message:'QUIZ_UNAVAILABLE'};const q=window.fixture.quiz;const correct=q.questions.filter(q=>input.answers[q.id]===(q.type==='boolean'?q.answer:q.answerIndex)).length;const attempt=window.forceGrade||{id:'synthetic-attempt',userId:'visual-test-user',quizId:q.id,correct,incorrect:q.questions.length-correct,scorePercent:Math.round(correct/q.questions.length*100),date:'2026-11-21'};return{success:true,attempt,...(q.isFinal&&attempt.scorePercent>=q.passPercent?{certificate:{id:'synthetic-cert',code:'SYNTHETIC-NOT-VALID',scorePercent:attempt.scorePercent,issuedAt:'2026-11-21'}}:{})};}export async function verifyCertificate(){if(window.fixture.screen==='verify-error')throw Error('Synthetic network failure');return window.fixture.screen==='verify-invalid'?{success:false}:{success:true,certificate:window.fixture.certificate};}` }));
}}],stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';import{QueryClientProvider}from'@tanstack/react-query';
import i18n from'./client/src/i18n';import{queryClient}from'./client/src/lib/queryClient';import{QuizModal}from'./client/src/components/course/QuizModal';import Certificates from'./client/src/pages/agent/Certificates';import Verify from'./client/src/pages/VerifyCertificate';import{generateCertificatePDF,generateBadgePNG}from'./client/src/lib/pdf';
import{countryLabel,courseText}from'./client/src/i18n/course-labels';import{certificateText}from'./client/src/lib/certificate-text';
const root=createRoot(document.getElementById('mount'));let revision=0;
window.savedAttempts=[];window.toasts=[];window.submitRequests=0;
window.renderCase=async data=>{window.fixture=data;window.savedAttempts=[];window.toasts=[];window.submitRequests=0;window.forceGrade=null;window.failSubmission=false;window.submitDelay=0;
await i18n.changeLanguage(data.language);document.documentElement.classList.toggle('dark',!!data.dark);
queryClient.clear();queryClient.setQueryData(['/api/courses'],{courses:[]});queryClient.setQueryData(['/api/public/countries'],{countries:data.countries});queryClient.setQueryData(['/api/certificates'],{success:true,certificates:data.screen==='cert-empty'?[]:data.certificates||[data.certificate]});
window.fetch=async url=>new Response(JSON.stringify(url.includes('countries')?{countries:data.countries}:url.includes('courses')?{courses:[]}:url.includes('certificates')?{certificates:[data.certificate]}:{success:true}),{headers:{'Content-Type':'application/json'}});
window.history.replaceState({},'',data.screen.startsWith('verify')?'/?code=SYNTHETIC-NOT-VALID':'/');
const child=data.screen==='quiz'?<QuizModal quiz={data.quiz} onClose={()=>{window.quizClosed=true;flushSync(()=>root.render(null))}} onComplete={passed=>{window.completion=passed;flushSync(()=>root.render(null))}}/>:data.screen.startsWith('verify')?<Verify/>:<main className="mx-auto max-w-6xl p-4"><Certificates/></main>;
flushSync(()=>root.render(<QueryClientProvider client={queryClient}><React.Fragment key={++revision}>{child}</React.Fragment></QueryClientProvider>));
};
window.inspectQuiz=()=>{const findings=[];const buttons=[...document.querySelectorAll('[data-testid^=button-question-]')];for(let i=0;i<buttons.length;i++){flushSync(()=>buttons[i].click());for(const e of document.querySelectorAll('[data-testid^=button-answer],#quiz-question-text,[data-testid=quiz-title],[data-testid=question-navigation]')){const r=e.getBoundingClientRect();if(e.scrollWidth>e.clientWidth+3||r.left < -1||r.right>innerWidth+1)findings.push({question:i,testid:e.dataset.testid||e.id,client:e.clientWidth,scroll:e.scrollWidth});}}const artifacts=document.body.innerText.match(/&(?:nbsp|amp|lt|gt);/g);if(artifacts)findings.push({artifacts});return{questions:buttons.length,findings};};
window.measureTitle=title=>{const boxes=[];certificateText({addImage:(url,format,x,y,width,height)=>boxes.push({x,y,width,height})},title,140,18);return boxes;};
window.answerAll=correct=>{for(let i=0;i<window.fixture.quiz.questions.length;i++){const q=window.fixture.quiz.questions[i];flushSync(()=>document.querySelector('[data-testid=button-question-'+i+']').click());const value=q.type==='boolean'?(correct?q.answer:!q.answer):(correct?q.answerIndex:(q.answerIndex+1)%q.options.length);flushSync(()=>document.querySelector('[data-testid=button-answer-'+value+']').click());}};
window.generatePdf=(data)=>generateCertificatePDF({code:'SYNTHETIC-NOT-VALID',scorePercent:88,issuedAt:'2026-11-21T12:00:00Z'}, {name:data.name}, {title:data.title},{name:data.agency});window.generateBadge=data=>generateBadgePNG({name:data.name},'SYNTHETIC-NOT-VALID');window.localizedCourse=(language,country)=>countryLabel(language,country.code,country.name)+' — '+courseText(language,0);
`}})).outputFiles[0].contents;
const server=http.createServer((req,res)=>{if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(script)}else if(req.url==='/app.css'){res.setHeader('Content-Type','text/css');res.end(css)}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/app.css"></head><body><div id="mount"></div><script type="module" src="/fixture.js"></script></body></html>')}});
await new Promise(r=>server.listen(Number(option('port')||4201),'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;console.log(origin);
if(process.argv.includes('--serve-only'))await new Promise(()=>{});
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1100,height:900},acceptDownloads:true});await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await page.goto(origin);await page.waitForFunction(()=>window.renderCase);
const failures=[],inventory=[],pdfSamples=[];let renderedQuestions=0;
const certificate=country=>({id:'synthetic-'+country.id,userId:'visual-test-user',courseId:'course-'+country.id,code:'SYNTHETIC-NOT-VALID',scorePercent:88,issuedAt:'2026-11-21T12:00:00Z',user:{name:'SYNTHETIC TEST RECIPIENT'},course:{id:'course-'+country.id,title:country.name+' — Agent Training'},agency:{name:'SYNTHETIC EDUCATION CONSULTANCY'}});
const metrics=()=>page.evaluate(()=>{const visible=[...document.querySelectorAll('[data-testid^="button-answer"], [data-testid="question-navigation"], [data-testid="quiz-title"], [data-testid="quiz-results"], main button,main h3')].filter(e=>e.getBoundingClientRect().width);return{pageOverflow:document.documentElement.scrollWidth>innerWidth+2,overflow:visible.filter(e=>e.scrollWidth>e.clientWidth+3).map(e=>({testid:e.dataset.testid||e.tagName,text:e.textContent.slice(0,100),client:e.clientWidth,scroll:e.scrollWidth})),clipped:visible.filter(e=>e.getBoundingClientRect().left < -1||e.getBoundingClientRect().right>innerWidth+1).map(e=>e.dataset.testid||e.tagName),closeOverlap:(()=>{const d=document.querySelector('[role=dialog]'),b=d?.querySelector('header .inline-flex'),c=d?.querySelector(':scope > button:last-child');if(!b||!c)return false;const x=b.getBoundingClientRect(),y=c.getBoundingClientRect();return x.left<y.right&&x.right>y.left&&x.top<y.bottom&&x.bottom>y.top;})(),dialogHeight:document.querySelector('[role=dialog]')?.clientHeight}});
const capture=async(language,screen,width,extra={})=>{const data={language,screen,countries:snapshot.countries,certificate:certificate(snapshot.countries.find(c=>c.code==='HU')||snapshot.countries[0]),...extra};await page.setViewportSize({width,height:900});await page.evaluate(data=>window.renderCase(data),data);await page.waitForTimeout(70);const result=await metrics();if(result.pageOverflow||result.overflow.length||result.clipped.length||result.closeOverlap)failures.push({language,screen,width,...result});const file=`${language}-${screen}-${width}${extra.dark?'-dark':''}.png`;await page.screenshot({path:out+'/'+file,fullPage:true,animations:'disabled'});inventory.push({language,screen,width,file,...result});return data;};
try{
if(!process.argv.includes('--interaction-only'))for(const language of snapshot.languages){
 const quizzes=snapshot.localized[language];const longest=quizzes.filter(q=>!q.isFinal).sort((a,b)=>Math.max(...b.questions.map(q=>q.text.length+(q.options?.join('').length||0)))-Math.max(...a.questions.map(q=>q.text.length+(q.options?.join('').length||0))))[0];
 const final=quizzes.find(q=>q.isFinal);
 for(const width of [1100,360]){
  await capture(language,'quiz',width,{quiz:longest});await fs.rename(out+`/${language}-quiz-${width}.png`,out+`/${language}-mini-${width}.png`);inventory[inventory.length-1].file=`${language}-mini-${width}.png`;inventory[inventory.length-1].screen='mini';
  await capture(language,'quiz',width,{quiz:final});await fs.rename(out+`/${language}-quiz-${width}.png`,out+`/${language}-final-${width}.png`);inventory[inventory.length-1].file=`${language}-final-${width}.png`;inventory[inventory.length-1].screen='final';
  await capture(language,'certificates',width,{certificates:snapshot.countries.filter(c=>quizzes.some(q=>q.isFinal&&q.countryId===c.id)).map(certificate)});
  for(const screen of ['verify-valid','verify-invalid','verify-error','cert-empty'])await capture(language,screen,width);
 }
 // Walk every question in every localized active assessment at the narrow width.
 if(!process.argv.includes('--screens-only'))for(const quiz of quizzes){
  await page.evaluate(data=>window.renderCase(data),{language,screen:'quiz',quiz,countries:snapshot.countries});
  const m=await page.evaluate(()=>window.inspectQuiz());renderedQuestions+=m.questions;if(m.findings.length)failures.push({language,quizId:quiz.id,...m});
 }
 console.log(JSON.stringify({language,renderedQuestions,failures:failures.length}));
}

if(process.argv.includes('--interaction-only')){
 const samples={en:['Alexandra International Education Consultant','International Education and Study Abroad Consultancy'],tr:['İpek Çağlayan','Öğrenci Danışmanlık'],ar:['محمد عبد الرحمن','مؤسسة التعليم الدولي'],fr:['Éléonore François','Conseil en études internationales'],ru:['Александра Иванова','Международное образование'],fa:['محمد رضایی','مشاوره آموزش بین‌المللی'],zh:['王晓明','国际教育咨询'],hi:['आरव शर्मा','अंतरराष्ट्रीय शिक्षा परामर्श'],es:['María Fernández','Asesoría de educación internacional'],id:['Putri Wulandari','Konsultan Pendidikan Internasional'],ur:['محمد عبدالرحمن','بین الاقوامی تعلیمی مشاورت'],tk:['Gülşat Ýazmyradowa','Halkara bilim maslahat merkezi'],ky:['Айгүл Жумабаева','Эл аралык билим берүү'],kk:['Әсел Қасымова','Халықаралық білім беру'],uz:['Gulnoza O‘ktamova','Xalqaro ta’lim maslahati'],tg:['Меҳрона Саидова','Машварати таҳсили байналмилалӣ'],bn:['আরিফ রহমান','আন্তর্জাতিক শিক্ষা পরামর্শ'],pt:['João Gonçalves','Consultoria de Educação Internacional'],ne:['आरव शर्मा','अन्तर्राष्ट्रिय शिक्षा परामर्श'],vi:['Nguyễn Thị Hương','Tư vấn giáo dục quốc tế'],ko:['김민수','국제 유학 교육 센터'],uk:['Олександра Шевченко','Міжнародна освітня консультація'],it:['Giulia D’Angelo','Consulenza per l’istruzione internazionale']};
 for(const language of snapshot.languages){
  const qs=snapshot.localized[language], mini=qs.find(q=>!q.isFinal), final=qs.find(q=>q.isFinal);
  for(const [kind,quiz]of[['mini',mini],['final',final]])for(const success of [true,false]){
   await page.setViewportSize({width:360,height:640});await page.evaluate(data=>window.renderCase(data),{language,screen:'quiz',quiz,countries:snapshot.countries});
   await page.evaluate(success=>window.answerAll(success),success);
   await page.locator('[data-testid=button-submit-quiz]').click();await page.locator('[data-testid=quiz-results]').waitFor();
   const m=await metrics();if(m.pageOverflow||m.overflow.length||m.clipped.length||m.closeOverlap)failures.push({language,kind,success,...m});
   const score=await page.locator('[data-testid=quiz-score]').innerText();if(score!==(success?'100%':'0%'))failures.push({language,kind,success,score});
   const file=`${language}-${kind}-${success?'passed':'failed'}-360.png`;await page.screenshot({path:out+'/'+file,fullPage:true,animations:'disabled'});inventory.push({language,screen:kind+(success?'-passed':'-failed'),width:360,file,...m});
  }
  const countries=snapshot.countries.filter(c=>qs.some(q=>q.isFinal&&q.countryId===c.id));const titles=[];
  for(const country of countries){const title=await page.evaluate(({language,country})=>window.localizedCourse(language,country),{language,country});const boxes=await page.evaluate(title=>window.measureTitle(title),title);if(boxes.some(b=>b.x<25||b.x+b.width>272||b.y<130||b.y+b.height>152))failures.push({language,title,boxes});titles.push(title);}
  const title=titles.sort((a,b)=>b.length-a.length)[0];const [name,agency]=samples[language];
  const dp=page.waitForEvent('download');await page.evaluate(data=>window.generatePdf(data),{name,agency,title});await(await dp).saveAs(out+`/certificate-${language}.pdf`);
  const bp=page.waitForEvent('download');await page.evaluate(data=>window.generateBadge(data),{name});await(await bp).saveAs(out+`/badge-${language}.png`);pdfSamples.push({language,name,agency,title,courseTitlesMeasured:titles.length});
  // Dark-mode long answers and result colors.
  await capture(language,'quiz',360,{quiz:final,dark:true});await fs.rename(out+`/${language}-quiz-360-dark.png`,out+`/${language}-final-dark-360.png`);inventory[inventory.length-1].file=`${language}-final-dark-360.png`;
  console.log(JSON.stringify({interactionLanguage:language,failures:failures.length}));
 }
 // A stale/local answer key must not override the server's grade.
 const quiz=snapshot.localized.en.find(q=>!q.isFinal);
 await page.evaluate(data=>window.renderCase(data),{language:'en',screen:'quiz',quiz,countries:snapshot.countries});
 await page.evaluate(()=>{window.answerAll(true);window.forceGrade={id:'server-attempt',userId:'visual-test-user',quizId:window.fixture.quiz.id,correct:0,incorrect:window.fixture.quiz.questions.length,scorePercent:0};window.submitDelay=100;});
 await page.locator('[data-testid=button-submit-quiz]').click();await page.locator('[data-testid=quiz-results]').waitFor();
 if(await page.locator('[data-testid=quiz-score]').innerText()!=='0%')failures.push({test:'server-grade-authoritative'});
 await page.locator('[data-testid=button-close-results]').click();if(await page.evaluate(()=>window.completion)!==false)failures.push({test:'server-pass-state-authoritative'});
 await page.evaluate(data=>window.renderCase(data),{language:'en',screen:'quiz',quiz:{...quiz,questions:[]},countries:snapshot.countries});if(!await page.getByRole('alert').isVisible())failures.push({test:'empty-quiz-safe'});
 await page.keyboard.press('Escape');await page.waitForTimeout(200);if(await page.locator('[role=dialog]').count())failures.push({test:'keyboard-escape-close'});
 await page.evaluate(data=>window.renderCase(data),{language:'en',screen:'quiz',quiz,countries:snapshot.countries});await page.evaluate(()=>{window.answerAll(true);window.failSubmission=true;});await page.locator('[data-testid=button-submit-quiz]').click();await page.waitForTimeout(30);if(await page.locator('[data-testid=quiz-results]').count()||await page.evaluate(()=>window.savedAttempts.length))failures.push({test:'failed-submission-not-persisted'});
 await page.evaluate(()=>{window.failSubmission=false;window.submitDelay=100;document.querySelector('[data-testid=button-submit-quiz]').click();document.querySelector('[data-testid=button-submit-quiz]').click();});await page.locator('[data-testid=quiz-results]').waitFor();if(await page.evaluate(()=>window.submitRequests)!==2)failures.push({test:'duplicate-submit-lock'});
 await fs.writeFile(out+'/interaction-report.json',JSON.stringify({at:new Date().toISOString(),languages:snapshot.languages,inventory,pdfSamples,failures,liveWrites:0,emailsSent:0,paidRequests:0},null,2));
}
}finally{await fs.writeFile(out+(process.argv.includes('--interaction-only')?'/interaction-layout-report.json':process.argv.includes('--screens-only')?'/screen-report-country-fix.json':'/layout-report.json'),JSON.stringify({at:new Date().toISOString(),languages:snapshot.languages,inventory,renderedQuestions,failures,liveWrites:0,emailsSent:0,paidRequests:0},null,2));await browser.close();server.close();}
