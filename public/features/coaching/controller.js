import {prepareFarmReplay} from '../replays/prepare.js';
import {refreshFullReplay} from '../replays/controller.js';
import {$,notify} from '../../core/dom.js';
import {state} from '../../core/state.js';
import {api,apiPaths,errorMessage} from '../../core/api.js';
import {setBusy} from '../../core/ui.js';
import {renderReport} from './report.js';
export async function analyzeMatch() {
  if (state.busy || !state.match || state.slot === null) return;
  setBusy(true, 'Preparando sua aula… '); $('report').hidden = true;
  notify('Calculando farm, transições, lutas e decisões com os registros da partida…');
  try {
    let routeWarning='';
    if(state.match.replay_parser_available){
      try{
        const preparation=await prepareFarmReplay(api,state.match.match_id,{onProgress:message=>notify(message)});
        if(!preparation.ready)routeWarning=preparation.message;
        void refreshFullReplay();
      }catch(error){routeWarning=errorMessage(error);}
    }
    notify('Preparando sua aula com os dados disponíveis. A rota será incluída no resultado quando houver posições do replay completo.');
    state.report = await api(`/api/matches/${state.match.match_id}/analyze`, { method: 'POST', body: JSON.stringify({ player_slot: state.slot, focus: $('focus').value }) });
    if(routeWarning&&!state.report.farm_route?.available)state.report.farm_route={available:false,reason:'A aula está pronta, mas a rota completa não ficou disponível: '+routeWarning+' Você pode enviar o .dem na seção Replay completo.'};
    renderReport(state.report); notify('Análise concluída. Revise os achados junto das evidências e limitações.');
    $('report').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  } catch (error) { notify(errorMessage(error), true); }
  finally { setBusy(false); }
}
