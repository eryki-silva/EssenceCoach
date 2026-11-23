// Calculated from replay evidence only. These are review tasks, not proven mistakes.
const finite = Number.isFinite;
const clock = s => `${s < 0 ? '-' : ''}${Math.floor(Math.abs(s)/60)}:${String(Math.floor(Math.abs(s)%60)).padStart(2,'0')}`;
const fmt = n => Math.round(n*10)/10;
const ids = rows => [...new Set(rows.map(e=>e.id))];
const objectiveName = type => /ROSHAN/.test(type||'')?'Roshan':/BUILDING/.test(type||'')?'estrutura':/BARRACKS/.test(type||'')?'quartel':'objetivo';
export function groundedFindings(findings, evidence) {
  const byId=new Map(evidence.map(e=>[e.id,e]));
  return findings.filter(f=>{
    const cited=f.evidence_ids.map(id=>byId.get(id)).filter(Boolean);
    const numbers=[];
    const collect=value=>{if(finite(value)) numbers.push(value);else if(value&&typeof value==='object') Object.values(value).forEach(collect);};
    cited.forEach(e=>collect(e.data));
    const tokens=String(f.observation).match(/\d+(?:[.,]\d+)?/g)||[];
    const numeric=tokens.some(t=>numbers.includes(Number(t.replace(',','.'))));
    const eventTime=cited.some(e=>finite(e.time)&&String(f.observation).includes(clock(e.time)));
    const namedPurchase=cited.some(e=>e.kind==='purchase_log'&&[e.data.item,e.data.key].some(name=>name&&String(f.observation).toLowerCase().includes(String(name).toLowerCase())));
    return numeric||eventTime||namedPurchase;
  });
}
export function buildReplayReview(evidence, hero = '') {
  const of = kind => evidence.filter(e=>e.kind===kind);
  const timed = kind => of(kind).filter(e=>finite(e.time)).sort((a,b)=>a.time-b.time);
  const duration=of('match')[0]?.data.duration;
  const end = n => finite(duration) ? Math.min(n,duration) : n;
  const fights=timed('teamfight'), purchases=timed('purchase_log'), deaths=timed('deaths_log');
  const phases=of('phase_progress').filter(e=>finite(e.data.start)&&finite(e.data.end));
  const priorities=[];
  const add = (kind,title,observation,action,replay_check,metric,rows,start,stop) => priorities.push({kind,title,observation,action,replay_check,metric,evidence_ids:ids(rows),start,end:stop,certainty:'Ponto de revisão; o evento não prova erro.'});
  // Actual fight casualties and economy, without inventing missing death timestamps.
  const costly=fights.filter(e=>e.data.player?.deaths>0).sort((a,b)=>(b.data.player.deaths-a.data.player.deaths)||((a.data.player.gold_delta??0)-(b.data.player.gold_delta??0))||a.time-b.time)[0];
  if(costly) {
    const d=costly.data, p=d.player, stop=finite(d.end)?d.end:costly.time;
    const nearby=purchases.filter(e=>e.time>=costly.time-120&&e.time<=costly.time);
    const objective=timed('objective').find(e=>e.time>=stop&&e.time<=stop+90);
    const numbers=[`${p.deaths} morte(s) do jogador`,finite(p.damage)?`${p.damage} de dano`:null,finite(p.healing)?`${p.healing} de cura`:null,finite(p.gold_delta)?`saldo de ouro ${p.gold_delta}`:null].filter(Boolean).join('; ');
    add('combate',`Revise sua entrada na luta de ${clock(costly.time)}`,`Luta registrada entre ${clock(costly.time)} e ${clock(stop)}: ${numbers}.${nearby.length?' Compra anterior: '+(nearby.at(-1).data.item||nearby.at(-1).data.key)+' em '+clock(nearby.at(-1).time)+'.':''}${objective?' Registro de '+objectiveName(objective.data.type)+' em '+clock(objective.time)+'; confira no replay qual equipe o conquistou e se essa luta influenciou.':''}`,
      'Na próxima luta, defina antes de entrar qual aliado acompanhar e qual habilidade ou item guardar para sair. Se sua função for proteger, espere o aliado iniciar e use sua proteção quando ele for focado; avance somente com rota de saída ou vantagem visível.',
      `Assista de ${clock(Math.max(0,costly.time-20))} a ${clock(end(stop+15))}. Pause antes do primeiro dano recebido: havia aliado ao alcance, saída e recurso defensivo? Confira se a morte permitiu uma troca favorável antes de mudar sua decisão.`,
      'Nas próximas 3 partidas, registre as lutas em que morreu antes de usar o recurso reservado; compare após rever 5 lutas.',[costly,...nearby.slice(-1),...(objective?[objective]:[])],Math.max(0,costly.time-20),end(stop+15));
  } else if(deaths.length) {
    const d=deaths[0];
    add('sobrevivência',`Primeira morte registrada: ${clock(d.time)}`,`O log registra uma morte em ${clock(d.time)}${d.data.killer?' por '+d.data.killer:''}. O log não informa sozinho se ela era evitável.`,
      'Antes de repetir a mesma entrada no mapa, identifique os inimigos visíveis e o aliado que pode responder. Se não houver informação ou apoio, escolha uma rota com visão; aceite o risco somente quando o objetivo compensar.',
      `Reveja ${clock(Math.max(0,d.time-20))}–${clock(end(d.time+10))}: procure a última informação dos inimigos e a primeira oportunidade real de recuar.`,
      'Nas próximas 3 partidas, classifique cada morte como troca por objetivo, luta ou deslocamento sem apoio; revise primeiro a categoria mais frequente.',[d],Math.max(0,d.time-20),end(d.time+10));
  }
  // Compare the player's own consecutive phases, not a carry benchmark for supports.
  const transitions=[];
  for(let i=1;i<phases.length;i++) {
    const a=phases[i-1],b=phases[i];
    if(a.data.end!==b.data.start || !finite(a.data.xp_per_minute)||!finite(b.data.xp_per_minute)||a.data.xp_per_minute<=0) continue;
    if(a.data.elapsed_seconds<180||b.data.elapsed_seconds<180) continue;
    const drop=1-b.data.xp_per_minute/a.data.xp_per_minute;
    if(drop>0) transitions.push({a,b,drop});
  }
  transitions.sort((a,b)=>b.drop-a.drop);
  if(transitions.length) {
    const {a,b,drop}=transitions[0];
    const losses=deaths.filter(e=>e.time>=b.data.start&&e.time<=b.data.end);
    add('economia',`Sua experiência caiu na fase ${b.data.phase}`,`XP/min passou de ${fmt(a.data.xp_per_minute)} (${clock(a.data.start)}–${clock(a.data.end)}) para ${fmt(b.data.xp_per_minute)} (${clock(b.data.start)}–${clock(b.data.end)}): queda de ${fmt(drop*100)}%.${losses.length?' Há '+losses.length+' morte(s) registrada(s) no segundo intervalo.':''} Isso mede mudança de ritmo, não XP perdido nem erro de farm.`,
      'Ao terminar uma rotação sem luta ou objetivo, escolha imediatamente a próxima fonte segura de experiência. Se você estiver dando espaço a um aliado, confira se a visão, proteção ou pressão criada justifica ficar sem XP; não tome a rota do core só para aumentar o número.',
      `No intervalo ${clock(b.data.start)}–${clock(b.data.end)}, procure deslocamentos que terminaram sem XP, proteção ou objetivo. Compare com a fase anterior e anote a decisão que iniciou cada espera.`,
      'Reveja 5 minutos desse intervalo e conte deslocamentos sem resultado; nas próximas 3 partidas, anote o destino antes de sair de cada rota.',[a,b,...losses],b.data.start,b.data.end);
  }
  // Match meaningful purchases to actual subsequent fight windows.
  const utility=purchases.filter(e=>e.time>=0&&!/^(recipe_|tpscroll$|ward_|tango$|flask$|clarity$|branches$|dust$|smoke_of_deceit$)/.test(e.data.key||''));
  const paired=utility.map(p=>({p,f:fights.find(f=>f.time>=p.time&&f.time<=p.time+180)})).find(x=>x.f);
  if(paired) {
    const {p,f}=paired, item=p.data.item||p.data.key;
    const uses=f.data.player?.item_uses?.[p.data.key];
    add('itens',`${item}: compra e primeira luta próxima`,`${item} foi comprado em ${clock(p.time)}. Há uma luta em ${clock(f.time)}, ${Math.round(f.time-p.time)}s depois.${finite(uses)?' O log da luta registra '+uses+' uso(s) desse item.':' O log não confirma uso, entrega ou disponibilidade do item nessa luta.'}`,
      `Antes da próxima luta após comprar ${item}, confira se o item chegou e onde ele muda sua decisão. Se tiver uma habilidade ativa útil naquele confronto, defina o alvo e o gatilho de uso; se ainda estiver no entregador, não conte com o efeito.`,
      `Reveja a entrega após ${clock(p.time)} e o início da luta em ${clock(f.time)}. Confira inventário, alvo possível e se havia uma janela de uso; não conclua que faltou usar só pela ausência no log.`,
      'Nas próximas 3 partidas, reveja a primeira luta após cada item de utilidade e registre: entregue, alvo disponível e uso possível.',[p,f],p.time,end(finite(f.data.end)?f.data.end:f.time));
  }
  const chen=/^chen$/i.test(hero);
  if(chen && priorities.length) {
    priorities[0].action += ' Para Chen, escolha antes da aproximação qual unidade inicia e qual fica junto do aliado; mantenha grupos separados para não enviar todas as unidades à mesma área de dano.';
    priorities[0].replay_check += ' Confira também a posição das unidades controladas e qual delas conseguiu executar sua função. O log não comprova erro de micro.';
    priorities[0].metric += ' Com Chen, anote também quantas unidades chegaram à luta e quais tiveram ação útil; essa contagem deve ser feita no replay.';
  }
  const participation=of('team_participation')[0];
  const snapshots=phases.map(e=>({phase:e.data.phase,start:e.data.start,end:e.data.end,xp_per_minute:e.data.xp_per_minute??null,last_hits_delta:e.data.last_hits_delta??null,gold_delta:e.data.gold_delta??null,evidence_id:e.id}));
  return {basis:'Cálculos dos eventos da partida; independem de amostra de meta ou de opinião da IA.',priorities:priorities.slice(0,3),phases:snapshots,participation:participation?{...participation.data,evidence_id:participation.id}:null,
    status:priorities.length?'Momentos encontrados para revisão':'Eventos insuficientes para apontar uma decisão concreta. Solicite processamento do replay e atualize a partida.',
    coverage:{fights:fights.length,death_events:deaths.length,purchases:purchases.length,phase_intervals:phases.length},
    purchases:utility.slice(0,20).map(e=>({item:e.data.item||e.data.key,time:e.time,evidence_id:e.id})),
    note:'Ações sugeridas são condicionais. Sem posição, visão e cooldowns completos, não é possível provar que havia uma alternativa melhor.'};
}
