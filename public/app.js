import {$,notify} from './core/dom.js';
import {state} from './core/state.js';
import {api,apiPaths,errorMessage} from './core/api.js';
import {setBusy} from './core/ui.js';
import {loadMatch} from './features/matches/controller.js';
import {analyzeMatch} from './features/coaching/controller.js';
import {beginFullReplay,refreshFullReplay} from './features/replays/controller.js';
$('download-replay').addEventListener('click',()=>beginFullReplay(false));
$('upload-replay').addEventListener('click',()=>beginFullReplay(true));
$('refresh-replay').addEventListener('click',refreshFullReplay);
$('analyze-button').addEventListener('click',analyzeMatch);
$('match-form').addEventListener('submit', loadMatch);
$('reload-button').addEventListener('click', () => loadMatch());

$('parse-button').addEventListener('click', async () => {
  if (state.busy || !state.match) return;
  setBusy(true); notify('Solicitando processamento ao OpenDota…');
  try {
    const result = await api(apiPaths.action(state.match.match_id,'parse'), { method: 'POST', body: '{}' });
    notify(`${result.message}${result.job_id ? ` Protocolo: ${result.job_id}.` : ''}`);
  } catch (error) { notify(errorMessage(error), true); }
  finally { setBusy(false); }
});
api(apiPaths.health).then(health => {
  state.configured = health.analysis_available;
  const version=$('system-version');if(version)version.textContent=health.version?'v'+health.version:'';
  $('key-status').textContent = 'Análise por regras do código · sem IA e sem chave. Dados do OpenDota e do replay quando disponível.';
  setBusy(state.busy);
}).catch(error => { $('key-status').textContent = 'Servidor indisponível.'; notify(errorMessage(error), true); });
