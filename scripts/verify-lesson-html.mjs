// Browser regression checks for authored lesson documents. No application login or API writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const repo = process.cwd();
const snapshotFile = process.argv.find(x => x.startsWith('--snapshot='))?.slice(11);
const out = path.resolve(process.argv.find(x => x.startsWith('--out='))?.slice(6) ?? '../html-audit/lesson-isolation');
await fs.mkdir(out, { recursive: true });
const bundle = await build({
  absWorkingDir: repo, bundle: true, write: false, platform: 'browser', format: 'esm', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  stdin: { resolveDir: repo, loader: 'tsx', contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { flushSync } from 'react-dom';
    import { LessonHtml } from './client/src/components/course/LessonHtml';
    const root = createRoot(document.getElementById('mount'));
    window.renderLesson = (html, language='en') => flushSync(() => root.render(<LessonHtml html={html} language={language}/>));
    window.renderOld = html => flushSync(() => root.render(<div dangerouslySetInnerHTML={{__html:html}}/>));
  ` },
});
const css = 'body{margin:0;padding:0;background:rgb(250,250,250);font:16px Arial}.outside{color:rgb(20,40,60)}.prose p{line-height:1.6}.prose h2{font-size:24px;font-weight:700}#mount{max-width:900px;margin:auto}';
const server = http.createServer((req, res) => {
  if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].contents); }
  else if (req.url === '/app.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); }
  else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><link rel="stylesheet" href="/app.css"></head><body><header class="outside">Dashboard navigation</header><main id="mount"></main><script type="module" src="/fixture.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const report = { checks: [], sourcesRendered: 0, translationsRendered: 0, sourceContentChanged: false, externalNetworkAllowed: false, apiRequests: 0, failures: [] };
const checked = (name, evidence) => report.checks.push({ name, passed: true, ...evidence });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await page.goto(origin);
  await page.waitForFunction(() => typeof window.renderLesson === 'function');
  const outside = () => page.evaluate(() => ({ padding: getComputedStyle(document.body).padding, color: getComputedStyle(document.querySelector('.outside')).color, background: getComputedStyle(document.body).backgroundColor }));
  const baseline = await outside();
  const html = '<!doctype html><html><head><style>body{padding:24px;background:red}.outside{color:red}.lesson-card{color:rgb(20,53,145);border:1px solid #ddd;padding:16px}</style></head><body><section class="lesson-card"><h2>Destination training</h2><p>Preserve 1,040 hours and €10,179.85.</p><a href="#terms">Read terms</a><div style="height:900px"></div><h3 id="terms">Terms</h3><iframe title="Training video" src="https://www.youtube.com/embed/placeholder" allowfullscreen></iframe><a target="_blank" href="https://academy.findandstudy.com/">Academy</a><script>window.lessonScriptExecuted=true</script><img src="/missing.png" onerror="window.lessonScriptExecuted=true"></section></body></html>';
  await page.evaluate(html => window.renderOld(html), html);
  assert.notDeepEqual(await outside(), baseline);
  checked('Reproduces existing full-document CSS leakage');
  // The old renderer deliberately contains an unsafe image handler. Start a
  // clean document so an old pending image cannot be attributed to the fix.
  await page.goto(origin);
  await page.waitForFunction(() => typeof window.renderLesson === 'function');
  await page.evaluate(html => window.renderLesson(html), html);
  await page.waitForFunction(() => document.querySelector('[data-testid="lesson-html"]')?.shadowRoot?.textContent.includes('Destination training'));
  assert.deepEqual(await outside(), baseline);
  assert.equal(await page.locator('[data-testid="lesson-html"] .lesson-card').evaluate(el => getComputedStyle(el).color), 'rgb(20, 53, 145)');
  checked('Authored CSS survives and cannot restyle page or navigation');
  assert.equal(await page.evaluate(() => Boolean(window.lessonScriptExecuted)), false);
  assert.equal(await page.locator('[data-testid="lesson-html"] script, [data-testid="lesson-html"] [onerror]').count(), 0);
  assert.equal(await page.locator('[data-testid="lesson-html"] iframe').getAttribute('src'), 'https://www.youtube.com/embed/placeholder');
  assert.match(await page.locator('[data-testid="lesson-html"] a[target="_blank"]').getAttribute('rel'), /noopener/);
  checked('Scripts and event handlers removed; safe video and external links retained');
  const targetBefore = await page.locator('[data-testid="lesson-html"] #terms').evaluate(el => el.getBoundingClientRect().top);
  await page.locator('[data-testid="lesson-html"] a[href="#terms"]').click();
  const targetAfter = await page.locator('[data-testid="lesson-html"] #terms').evaluate(el => el.getBoundingClientRect().top);
  assert.ok(targetAfter < targetBefore && targetAfter >= 0 && targetAfter < 900);
  checked('Lesson table-of-contents links scroll to the correct local target');
  await page.evaluate(() => window.renderLesson('<h2>دليل الدراسة</h2><p>معلومات التسجيل</p>', 'ar'));
  assert.equal(await page.locator('[data-testid="lesson-html"] p').evaluate(el => getComputedStyle(el).direction), 'rtl');
  assert.equal(await page.locator('[data-testid="lesson-html"] h2').evaluate(el => getComputedStyle(el).fontSize), '24px');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  assert.equal(await page.locator('[data-testid="lesson-html"]').evaluate(el => el.shadowRoot.querySelector('div').classList.contains('dark')), true);
  checked('Plain lessons keep typography, RTL direction and theme changes');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.renderLesson('<h2>Mobile training</h2><table style="width:1200px"><tr><td>Wide course table</td></tr></table>'));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.ok(await page.locator('[data-testid="lesson-html"] table').evaluate(el => el.closest('.prose').scrollWidth > el.closest('.prose').clientWidth));
  checked('Wide tables remain scrollable without widening a mobile page');

  if (snapshotFile) {
    const snapshot = JSON.parse(await fs.readFile(path.resolve(snapshotFile), 'utf8'));
    report.snapshotAt = snapshot.at;
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const row of [...snapshot.contents.map(x => ({ ...x, language: 'en', isSource: true })), ...snapshot.translations]) {
      const result = await page.evaluate(({ html, language }) => {
        const before = { padding: getComputedStyle(document.body).padding, color: getComputedStyle(document.querySelector('.outside')).color };
        window.renderLesson(html || '', language);
        const host = document.querySelector('[data-testid="lesson-html"]');
        const root = host.shadowRoot;
        const article = root.querySelector('.prose');
        const text = (article.innerText || '').replace(/\s+/g, ' ').trim();
        const source = new DOMParser().parseFromString(html || '', 'text/html');
        source.querySelectorAll('style,script,title,head').forEach(el => el.remove());
        const sourceText = (source.body.textContent || '').replace(/\s+/g, ' ').trim();
        const plain = article.cloneNode(true); plain.querySelectorAll('style,script,title').forEach(el => el.remove());
        return {
          cssEscaped: before.padding !== getComputedStyle(document.body).padding || before.color !== getComputedStyle(document.querySelector('.outside')).color,
          lostText: (plain.textContent || '').replace(/\s+/g, ' ').trim() !== sourceText,
          blank: text.length < 25 && sourceText.length > 200,
          visibleHtml: (text.match(/<!DOCTYPE\b|<\/?(?:html|head|style|body|div|section|table|script|h[1-6])\b[^>]*>/gi) || []).slice(0, 3),
          headingCount: article.querySelectorAll('h1,h2,h3').length,
        };
      }, { html: row.content, language: row.language });
      if (row.isSource) report.sourcesRendered++; else report.translationsRendered++;
      if (result.cssEscaped || result.lostText || result.blank || result.visibleHtml.length) report.failures.push({ id: row.id, contentId: row.content_id ?? row.id, language: row.language, ...result });
      if ((report.sourcesRendered + report.translationsRendered) % 1000 === 0) console.log(JSON.stringify({ rendered: report.sourcesRendered + report.translationsRendered, failures: report.failures.length }));
    }
    checked('Published lesson text, markup rendering and outer-page isolation', { sources: report.sourcesRendered, translations: report.translationsRendered });
  }
  await page.screenshot({ path: path.join(out, 'mobile-lesson.png'), fullPage: false });
  assert.equal(report.failures.length, 0, 'Published lesson rendering regressions require review');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report));
