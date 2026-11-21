// Visual and layout checks for the two real screenshot regressions in every locale.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import{chromium}from'playwright';
const snapshot=JSON.parse(await fs.readFile('../live/html-render-layout-review-snapshot.json','utf8'));
const out=path.resolve('../html-audit/language-layout-review');await fs.mkdir(out,{recursive:true});
const languages=[...new Set(['en',...snapshot.translations.map(x=>x.language)])].sort();
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1100,height:1000}});const origin='http://127.0.0.1:4198';
await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await page.goto(origin);await page.waitForFunction(()=>window.renderLesson);
const report=[];
try{for(const language of languages){for(const id of ['4922ede0-7650-47a4-b4d2-c1030678cc34','f7aba37e-a737-4cff-a1fe-62f05757203d']){
 const source=snapshot.contents.find(x=>x.id===id);const row=language==='en'?source:snapshot.translations.find(x=>x.content_id===id&&x.language===language);assert.ok(row);
 const lesson=id===source.id&&source.title.includes('Azerbaijan')?'az':'de';
 for(const[view,width]of[['desktop',1100],['mobile',390]]){
  await page.setViewportSize({width,height:1000});await page.evaluate(({row,language})=>{window.renderLesson(row.content,language);document.getElementById('review-title').textContent=language+' — '+row.title;scrollTo(0,0)},{row,language});
  const result=await page.locator('[data-testid="lesson-html"]').evaluate(el=>{const r=el.shadowRoot;const facts=r.querySelector('[aria-label="Quick facts"]');return{pageOverflow:document.documentElement.scrollWidth>innerWidth+1,direction:getComputedStyle(r.querySelector('body')).direction,language:r.querySelector('html').lang,blank:el.getBoundingClientRect().height<100,factsBackground:facts?getComputedStyle(facts).backgroundImage:null,narrowTableCells:[...r.querySelectorAll('td,th')].filter(n=>n.getBoundingClientRect().width>0&&n.getBoundingClientRect().width<45&&n.textContent.trim().length>10).length}});
  assert.equal(result.pageOverflow,false);assert.equal(result.blank,false);assert.equal(result.narrowTableCells,0);assert.equal(result.language,language);assert.equal(result.direction,['ar','fa','ur'].includes(language)?'rtl':'ltr');if(lesson==='az')assert.ok(result.factsBackground&&result.factsBackground!=='none');
  await page.screenshot({path:path.join(out,`${language}-${lesson}-${view}.png`),fullPage:false});
  if(lesson==='de'){
   await page.locator('[data-testid="lesson-html"] table').first().evaluate(el=>scrollTo(0,scrollY+el.getBoundingClientRect().top-60));
   await page.screenshot({path:path.join(out,`${language}-${lesson}-${view}-table.png`),fullPage:false});
  }
  report.push({language,lesson,view,...result});
 }
}}
await fs.writeFile(path.join(out,'report.json'),JSON.stringify({views:report.length,languages,passed:true,results:report},null,2));console.log(JSON.stringify({views:report.length,languages,passed:true,apiRequests:0}));}finally{await browser.close()}
