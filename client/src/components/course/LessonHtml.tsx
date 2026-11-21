import { useLayoutEffect, useRef } from 'react';
import DOMPurify from 'dompurify';

const typography = 'prose prose-sm max-w-none prose-headings:bg-gradient-to-r prose-headings:from-foreground prose-headings:to-foreground/70 prose-headings:bg-clip-text prose-headings:text-transparent';

/** Keep an authored lesson's CSS inside the lesson, including full HTML documents. */
export function LessonHtml({ html, language }: { html: string; language: string }) {
  const host = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const root = element.shadowRoot ?? element.attachShadow({ mode: 'open' });
    root.replaceChildren();

    // The surrounding app's prose/utilities remain available inside the shadow
    // tree; lesson selectors cannot reach navigation, dialogs or the page body.
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
    for (const sheet of Array.from(doc.head.querySelectorAll('style, link[rel="stylesheet"]'))) {
      root.append(sheet.cloneNode(true));
    }

    const theme = document.createElement('div');
    const syncTheme = () => { theme.className = document.documentElement.className; };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const article = document.createElement('div');
    article.className = `${typography} ${doc.body.className}`;
    article.style.overflowWrap = 'anywhere';
    article.style.overflowX = 'auto';
    article.style.maxWidth = '100%';
    article.innerHTML = doc.body.innerHTML;
    for (const link of Array.from(article.querySelectorAll('a[target="_blank"]'))) {
      link.setAttribute('rel', `${link.getAttribute('rel') ?? ''} noopener noreferrer`.trim());
    }
    theme.append(article);
    root.append(theme);

    // Fragment navigation must resolve against this lesson, not another lesson
    // or the app document, whose IDs are outside the shadow tree.
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
  }, [html]);

  const rtl = ['ar', 'fa', 'ur'].includes(language.toLowerCase().split(/[-_]/)[0]);
  return <div ref={host} lang={language} dir={rtl ? 'rtl' : 'ltr'} data-testid="lesson-html" style={{ display: 'block', minWidth: 0, maxWidth: '100%', contain: 'content' }} />;
}
