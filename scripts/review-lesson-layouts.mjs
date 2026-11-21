// Local visual-review fixture. Uses exported lesson content, never login sessions or API writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { build } from 'esbuild';
import { chromium } from 'playwright';
const option = name => process.argv.find(x=>x.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const snapshot = JSON.parse(await fs.readFile(path.resolve(option('snapshot') || '../live/html-render-layout-review-snapshot.json'),'utf8'));
const out = path.resolve(option('out') || '../html-audit/visual-review');
await fs.mkdir(out,{recursive:true});
const cssName = (await fs.readdir('dist/public/assets')).find(x=>/^index-.*\.css$/.test(x));
const css = await fs.readFile(`dist/public/assets/${cssName}`);
const script = (await build({bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',loader:{'.png':'dataurl'},define:{'process.env.NODE_ENV':'"production"'},stdin:{loader:'tsx',resolveDir:process.cwd(),contents:`
import React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';import{LessonHtml}from'./client/src/components/course/LessonHtml';
const root=createRoot(document.getElementById('mount'));window.renderLesson=(html,language='en')=>flushSync(()=>root.render(<LessonHtml html={html} language={language}/>));
let index=0;const select=document.getElementById('lessons');const language=document.getElementById('languages');const rows=${JSON.stringify(snapshot.contents.map(({id,title})=>({id,title}))).replace(/</g,'\\u003c')};
rows.forEach((row,i)=>{const o=document.createElement('option');o.value=i;o.textContent=(i+1)+'. '+row.title;select.append(o)});
const load=async()=>{index=Number(select.value);const row=await fetch('/lesson/'+index+'/'+language.value).then(r=>r.json());window.renderLesson(row.content,language.value);document.getElementById('review-title').textContent=(index+1)+' / '+rows.length+' — '+row.title;window.scrollTo(0,0)};
select.onchange=load;language.onchange=load;document.getElementById('prev').onclick=()=>{select.value=Math.max(0,index-1);load()};document.getElementById('next').onclick=()=>{select.value=Math.min(rows.length-1,index+1);load()};load();
`}})).outputFiles[0].contents;
const languages=[...new Set(['en',...snapshot.translations.map(x=>x.language)])].sort();
const pageHtml=`<!doctype html><html><head><link rel="stylesheet" href="/app.css"><style>body{margin:0;background:#f6f8fb}nav{position:relative;padding:12px;display:flex;flex-wrap:wrap;gap:8px;background:white;border-bottom:1px solid #ddd}nav button,nav select{border:1px solid #aaa;padding:8px;border-radius:6px}nav select{max-width:55vw}#review-title{max-width:1100px;margin:16px auto;font:600 16px Arial}#mount{max-width:1000px;margin:auto;background:white;padding:18px;box-sizing:border-box}@media(max-width:700px){#mount{padding:8px}#review-title{padding:8px}}</style></head><body><nav><button id="prev">Previous lesson</button><select id="lessons" aria-label="Lesson"></select><select id="languages" aria-label="Language">${languages.map(x=>`<option ${x==='en'?'selected':''}>${x}</option>`).join('')}</select><button id="next">Next lesson</button></nav><h1 id="review-title"></h1><main id="mount"></main><script type="module" src="/fixture.js"></script></body></html>`;
const server=http.createServer((req,res)=>{const parts=req.url.split('/');if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(script)}else if(req.url==='/app.css'){res.setHeader('Content-Type','text/css');res.end(css)}else if(parts[1]==='lesson'){const row=snapshot.contents[Number(parts[2])];const translation=parts[3]==='en'?null:snapshot.translations.find(x=>x.content_id===row.id&&x.language===parts[3]);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...row,...translation}));}else{res.setHeader('Content-Type','text/html');res.end(pageHtml)}});
await new Promise(r=>server.listen(Number(option('port')||4196),'127.0.0.1',r));
console.log(`Review fixture http://127.0.0.1:${server.address().port}`);
if(process.argv.includes('--capture')){
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1100,height:1000}});
const origin=`http://127.0.0.1:${server.address().port}`;
await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
await page.goto(origin);await page.waitForFunction(()=>window.renderLesson);
const report=[];
for(let i=0;i<snapshot.contents.length;i++){
 const row=snapshot.contents[i];const item={index:i+1,id:row.id,title:row.title,views:[]};
 for(const [name,width]of[['desktop',1100],['mobile',390]]){
  await page.setViewportSize({width,height:1000});
  await page.evaluate(({row,i})=>{document.getElementById('review-title').textContent=(i+1)+' — '+row.title;window.renderLesson(row.content,'en')},{row,i});
  const capturePath=path.join(out,`${String(i+1).padStart(3,'0')}-${name}.png`);
  const exists=await fs.stat(capturePath).then(x=>x.size>0).catch(()=>false);
  if(!exists || (name==='mobile' && process.argv.includes('--recapture-mobile'))) await page.screenshot({path:capturePath,fullPage:true,timeout:60000,animations:'disabled'});
  const metrics=await page.locator('[data-testid="lesson-html"]').evaluate(el=>{const r=el.shadowRoot;const nodes=[...r.querySelectorAll('td,th')];const visible=nodes.filter(n=>n.getBoundingClientRect().width>0);return {pageOverflow:document.documentElement.scrollWidth>innerWidth+1,empty:el.getBoundingClientRect().height<40,tableCells:visible.length,narrowTableCells:visible.filter(n=>n.getBoundingClientRect().width<45&&n.textContent.trim().length>10).map(n=>({text:n.textContent.slice(0,50),width:n.getBoundingClientRect().width})),tables:[...r.querySelectorAll('[data-lesson-table]')].map(n=>({width:n.clientWidth,scroll:n.scrollWidth})),height:el.getBoundingClientRect().height}});
  item.views.push({name,width,...metrics});
 }
 report.push(item);await fs.writeFile(path.join(out,'inventory.json'),JSON.stringify(report,null,2));if((i+1)%25===0)console.log(JSON.stringify({captured:i+1}));
}
await fs.writeFile(path.join(out,'inventory.json'),JSON.stringify(report,null,2));await browser.close();
console.log(JSON.stringify({lessons:report.length,views:report.length*2,findings:report.filter(x=>x.views.some(v=>v.pageOverflow||v.empty||v.narrowTableCells.length)).length}));
if(!process.argv.includes('--serve'))server.close();
}
