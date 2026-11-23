import {$,el,notify,time,date} from '../../core/dom.js';
import {state,replaySession} from '../../core/state.js';
import {api,apiPaths,errorMessage} from '../../core/api.js';
import {setBusy} from '../../core/ui.js';
import {renderPlayers} from './players.js';
import {refreshFullReplay} from '../replays/controller.js';
export async function loadMatch(event) {
  event?.preventDefault(); if (state.busy) return;
  const id = $('match-id').value.trim(), account = $('account-id').value.trim(), hero = $('hero-name').value.trim();
  if (!/^[1-9]\d{5,11}$/.test(id)) return notify('Informe um ID de partida válido.', true);
  setBusy(true); notify('Buscando dados da partida no OpenDota…');
  replaySession.epoch++;
  state.match = null; state.slot = null; state.report = null;replaySession.view?.destroy();replaySession.view=null;replaySession.data=null;if(replaySession.poll){clearInterval(replaySession.poll);replaySession.poll=null;}$('replay-viewer').replaceChildren();$('replay-file').value='';
  $('match-panel').hidden = true; $('report').hidden = true; $('empty-state').hidden = false;
  try {
    const params = new URLSearchParams();
    if (account && !hero) params.set('account', account);
    if (hero) params.set('hero', hero);
    const match = await api(apiPaths.match(id)+(params.size ? `?${params}` : ''));
    state.match = match; state.slot = match.selected_slot;
    $('replay-status').textContent=match.replay_parser_available ? match.replay_status.message : match.replay_mode==='cloud-limited'?match.replay_status.message:'Abra INSTALAR-REPLAY.cmd uma vez para habilitar a leitura completa neste PC.';
    for(const id of ['download-replay','upload-replay','replay-file','refresh-replay'])$(id).hidden=match.replay_mode==='cloud-limited';
    void refreshFullReplay();
    $('match-info').replaceChildren(el('span', '', `Partida #${match.match_id}`), el('span', '', `${time(match.duration)} de jogo`), el('span', '', `Vitória ${match.radiant_win ? 'Radiant' : 'Dire'}`), el('span', '', match.start_time ? date(match.start_time * 1000) : 'Data indisponível'));
    $('parse-status').textContent = match.parsed ? 'Eventos processados disponíveis.' : 'Dados parciais: processamento detalhado não confirmado.';
    $('match-panel').hidden = false; $('empty-state').hidden = true; renderPlayers();
    notify(match.selected_slot === null && (hero || account) ? (hero ? 'Esse herói não foi identificado pelo nome. Escolha o jogador desejado na lista abaixo.' : 'O perfil não foi encontrado (ou está anonimizado). Escolha o jogador desejado na lista.') : 'Partida carregada. Confirme o jogador selecionado para continuar.');
  } catch (error) { notify(errorMessage(error), true); }
  finally { setBusy(false); }
}

