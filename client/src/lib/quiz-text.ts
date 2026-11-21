import DOMPurify from 'dompurify';

// Assessment text is displayed as text, never injected HTML. Some legacy
// translations contain typographic entities (e.g. French &nbsp; before '?').
export function quizVisibleText(value: string): string {
 const escaped = DOMPurify.sanitize(value, {ALLOWED_TAGS: [], ALLOWED_ATTR: []});
 const decoder = document.createElement('textarea');
 decoder.innerHTML = escaped;
 return decoder.value;
}
