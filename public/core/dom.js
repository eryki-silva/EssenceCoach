export const $=id=>document.getElementById(id);
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}
export function notify(text, error = false) {
  $('message').textContent = text; $('message').className = `message${error ? ' error' : ''}`; $('message').hidden = !text;
}
export function time(seconds) {
  if (seconds === null || seconds === undefined) return 'Sem momento específico';
  return `${seconds < 0 ? '−' : ''}${Math.floor(Math.abs(seconds) / 60)}:${String(Math.floor(Math.abs(seconds) % 60)).padStart(2, '0')}`;
}
export function date(value) { return new Date(value).toLocaleString('pt-BR'); }

export function list(items, ordered = false) { const node = el(ordered ? 'ol' : 'ul', 'report-list'); items.forEach(item => node.append(el('li', '', item))); return node; }
export function section(title) { const node = el('section', 'panel'); node.append(el('h3', 'report-section-title', title)); return node; }
export function safeLink(url) { try { const parsed = new URL(url); return parsed.protocol === 'https:' ? parsed.href : null; } catch { return null; } }
