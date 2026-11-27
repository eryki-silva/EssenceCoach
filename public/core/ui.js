import {$,el} from './dom.js';
import {state} from './state.js';
export function setBusy(busy, label = '') {
  state.busy = busy;
  for (const button of document.querySelectorAll('#match-form button, #match-panel button')) button.disabled = busy;
  for (const input of document.querySelectorAll('#match-form input, #focus, #consent')) input.disabled = busy;
  $('analyze-button').disabled = busy || state.slot === null;
  $('load-button').replaceChildren(document.createTextNode(busy ? 'Aguarde…' : 'Buscar partida '), el('span', '', busy ? '◌' : '↗'));
  $('analyze-button').replaceChildren(document.createTextNode(label || 'Analisar minha partida '), el('span', '', busy ? '◌' : '✦'));
}
