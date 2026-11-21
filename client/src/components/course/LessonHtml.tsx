import { useLayoutEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import dormBookingLogo from '../../../../attached_assets/dorm-removebg-preview_1760296726263.png';

const typography = 'prose prose-sm max-w-none';

/** Give document selectors and responsive rules a real, lesson-local scope. */
function lessonCss(css: string): string {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  const serialize = (rules: CSSRuleList): string => Array.from(rules).map(rule => {
    if (rule instanceof CSSStyleRule) {
      // Quoted attribute values must remain literal, even if they contain :root.
      const selector = rule.selectorText.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|:root\b/g,
        token => token === ':root' ? '[data-lesson-document]' : token);
      return `${selector}{${rule.style.cssText}}`;
    }
    if (rule instanceof CSSMediaRule && /^\(\s*(min|max)-width\s*:\s*[\d.]+(px|rem|em)\s*\)$/.test(rule.conditionText)) {
      // A lesson sits beside navigation: its available width, not the entire
      // browser width, determines when authored columns need to stack.
      return `@container lesson (${rule.conditionText.slice(1, -1)}){${serialize(rule.cssRules)}}`;
    }
    if ('cssRules' in rule) {
      return `${rule.cssText.slice(0, rule.cssText.indexOf('{') + 1)}${serialize((rule as CSSGroupingRule).cssRules)}}`;
    }
    return rule.cssText;
  }).join('\n');
  return serialize(sheet.cssRules);
}

/** Keep an authored lesson's CSS inside the lesson, including full HTML documents. */
export function LessonHtml({ html, language }: { html: string; language: string }) {
  const host = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const root = element.shadowRoot ?? element.attachShadow({ mode: 'open' });
    root.replaceChildren();

    for (const sheet of Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style[data-vite-dev-id]'))) {
      root.append(sheet.cloneNode(true));
    }

    const sanitized = DOMPurify.sanitize(html, {
      WHOLE_DOCUMENT: true,
      ADD_TAGS: ['style', 'link', 'iframe', 'video', 'source'],
      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'controls', 'playsinline', 'target', 'rel'],
      FORBID_TAGS: ['form', 'input', 'button', 'textarea', 'select'],
    });
    const doc = new DOMParser().parseFromString(sanitized, 'text/html');
    const authored = Boolean(doc.querySelector('style, link[rel="stylesheet"]'));
    for (const style of Array.from(doc.querySelectorAll('style'))) {
      style.textContent = lessonCss(style.textContent ?? '');
    }

    const theme = document.createElement('div');
    theme.style.containerType = 'inline-size';
    theme.style.containerName = 'lesson';
    const syncTheme = () => { theme.className = document.documentElement.className; };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // Real html/body elements preserve authored body rules, attributes and inline
    // styles. :root is mapped to this local document rather than the app root.
    const documentElement = document.createElement('html');
    for (const attr of Array.from(doc.documentElement.attributes)) documentElement.setAttribute(attr.name, attr.value);
    documentElement.setAttribute('data-lesson-document', '');
    documentElement.lang = language;
    documentElement.dir = ['ar', 'fa', 'ur'].includes(language.toLowerCase().split(/[-_]/)[0]) ? 'rtl' : 'ltr';
    const article = document.createElement('body');
    for (const attr of Array.from(doc.body.attributes)) article.setAttribute(attr.name, attr.value);
    article.classList.add('lesson-body');
    article.lang = language;
    article.dir = documentElement.dir;
    if (!authored) article.classList.add(...typography.split(' '));
    article.innerHTML = doc.body.innerHTML;
    for (const image of Array.from(article.querySelectorAll('img'))) {
      // These two legacy lessons stored a Vite development filesystem URL.
      // Bundle the original logo instead of requesting an SPA page as an image.
      if (/^(?:https:\/\/academy\.findandstudy\.com)?\/@fs\/var\/www\/academy\.findandstudy\.com\/attached_assets\/dorm-removebg_1760296726263\.png$/.test(image.getAttribute('src') ?? '')) {
        image.src = dormBookingLogo;
      }
    }
    for (const link of Array.from(article.querySelectorAll('a[target="_blank"]'))) {
      link.setAttribute('rel', `${link.getAttribute('rel') ?? ''} noopener noreferrer`.trim());
    }
    // Keep readable cell widths. Scrolling belongs to each table, so surrounding
    // headings and text remain in view on a phone or a narrow content column.
    for (const table of Array.from(article.querySelectorAll('table'))) {
      const scroller = document.createElement('div');
      scroller.setAttribute('data-lesson-table', '');
      scroller.setAttribute('tabindex', '0');
      const label = table.caption?.textContent?.trim() || table.getAttribute('aria-label');
      if (label) { scroller.setAttribute('role', 'region'); scroller.setAttribute('aria-label', label); }
      table.replaceWith(scroller);
      scroller.append(table);
    }
    const defaults = document.createElement('style');
    defaults.textContent = `
      [data-lesson-document], .lesson-body { display:block; min-width:0; max-width:100%; }
      .lesson-body { margin:0; overflow-wrap:break-word; word-break:normal; }
      [data-lesson-table] { max-width:100%; min-width:0; overflow-x:auto; overscroll-behavior-x:contain; }
      [data-lesson-table] table { min-width:36rem; overflow-wrap:normal; word-break:normal; }
      [data-lesson-table]:focus-visible { outline:2px solid #143591; outline-offset:2px; }
      .lesson-body img, .lesson-body video, .lesson-body iframe { max-width:100%; }
      @container lesson (max-width:520px) {
        .fas-tip { flex-direction:column; align-items:flex-start; }
        .fas-tip > .txt { align-self:stretch; }
      }
    `;
    root.append(defaults);
    for (const sheet of Array.from(doc.head.querySelectorAll('style, link[rel="stylesheet"]'))) {
      documentElement.append(sheet.cloneNode(true));
    }
    documentElement.append(article);
    theme.append(documentElement);
    root.append(theme);

    const navigate = (event: Event) => {
      const mouse = event as MouseEvent;
      if (mouse.metaKey || mouse.ctrlKey || mouse.altKey || mouse.shiftKey) return;
      const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
      const hash = link?.getAttribute('href')?.slice(1);
      if (!hash) return;
      let id: string;
      try { id = decodeURIComponent(hash); } catch { return; }
      const target = root.getElementById(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ block: 'start' });
    };
    root.addEventListener('click', navigate);

    return () => {
      observer.disconnect();
      root.removeEventListener('click', navigate);
      root.replaceChildren();
    };
  }, [html, language]);

  const rtl = ['ar', 'fa', 'ur'].includes(language.toLowerCase().split(/[-_]/)[0]);
  return <div ref={host} lang={language} dir={rtl ? 'rtl' : 'ltr'} data-testid="lesson-html" style={{ display: 'block', minWidth: 0, maxWidth: '100%', contain: 'content' }} />;
}
