import {$,notify} from '../../core/dom.js';
import {state,replaySession} from '../../core/state.js';
import {api,apiPaths,errorMessage} from '../../core/api.js';
import {setBusy} from '../../core/ui.js';
import {createReplayViewer} from './viewer.js';
export function drawFullReplay() {
  if (!replaySession.data || !state.match) return;
  replaySession.view?.destroy();
  replaySession.view=createReplayViewer($('replay-viewer'),replaySession.data,{selectedSlot:state.slot,players:state.match.players});
}
export async function refreshFullReplay() {
  if (!state.match) return;
  const id=state.match.match_id,epoch=replaySession.epoch;
  try {
    const status=await api(apiPaths.action(id,'replay'));
    if (state.match?.match_id!==id || replaySession.epoch!==epoch) return;
    $('replay-status').textContent=status.message;
    const working=['receiving','downloading','parsing'].includes(status.state);
    if (working && !replaySession.poll) replaySession.poll=setInterval(refreshFullReplay,3000);
    if (!working && replaySession.poll) {clearInterval(replaySession.poll);replaySession.poll=null;}
    if (status.state==='complete' && !replaySession.data) {
      const data=await api(apiPaths.action(id,'replay-data'));
      if(state.match?.match_id!==id || replaySession.epoch!==epoch)return;
      replaySession.data=data;drawFullReplay();
    }
  } catch (error) {if(state.match?.match_id===id)$('replay-status').textContent=errorMessage(error);if(replaySession.poll){clearInterval(replaySession.poll);replaySession.poll=null;}}
}
export async function beginFullReplay(upload) {
  if (!state.match || state.busy) return;
  const file=$('replay-file').files[0];
  if(upload&&!file)return notify('Selecione o arquivo .dem da partida.',true);
  if(upload&&file.size>512*1024*1024)return notify('O limite por replay é 512 MB.',true);
  const id=state.match.match_id,epoch=replaySession.epoch;setBusy(true);
  try {
    const result=await api(apiPaths.action(id,upload?'replay-upload':'replay'),{method:'POST',headers:upload?{'Content-Type':'application/octet-stream'}:{},body:upload?file:'{}'});
    if(state.match?.match_id!==id || replaySession.epoch!==epoch)return;
    replaySession.view?.destroy();replaySession.view=null;replaySession.data=null;$('replay-viewer').replaceChildren();
    $('replay-status').textContent=result.message;void refreshFullReplay();
  } catch(error) {notify(errorMessage(error),true);}finally{setBusy(false);}
}
