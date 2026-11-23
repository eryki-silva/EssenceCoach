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
$('check-gemini').addEventListener('click', async () => {
  $('check-gemini').disabled = true;
  $('connection-status').textContent = 'Verificando a chave e o modelo no Google Gemini, sem gerar conteúdo…';
  try {
    const result = await api(apiPaths.check, { method: 'POST', body: '{}' });
    $('connection-status').textContent = result.message;
  } catch (error) { $('connection-status').textContent = errorMessage(error); }
  finally { $('check-gemini').disabled = false; }
});
$('reload-button').addEventListener('click', () => loadMatch());
$('consent').addEventListener('change', () => setBusy(false));
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
  state.configured = health.gemini_configured;
  const version=$('system-version');if(version)version.textContent=health.version?'v'+health.version:'';
  $('key-status').textContent = health.gemini_configured ? 'Google Gemini configurado no servidor · conexão será verificada ao analisar.' : 'Análise IA: configure GEMINI_API_KEY no servidor. A consulta de partidas funciona sem essa chave.';
  setBusy(state.busy);
}).catch(error => { $('key-status').textContent = 'Servidor indisponível.'; notify(errorMessage(error), true); });
