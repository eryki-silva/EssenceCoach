// Derived observations, not a verdict about whether a play was correct.
const finite=Number.isFinite;
export function buildDecisionBriefs(evidence,player){
 const team=player.player_slot<128?'Radiant':'Dire';
 return evidence.filter(e=>e.kind==='replay_decision_context').map(e=>{
  const d=e.data,r=d.self?.resources;
  const nearby=(d.other_heroes??[]).filter(h=>finite(h.distance_units)&&h.distance_units<=1600);
  const observation={event:d.event,actor:d.event_actor,target:d.event_target,player_is_actor:d.player_is_actor,player_is_target:d.player_is_target,snapshot_time:d.snapshot_time,
   allies_nearby:nearby.filter(h=>h.team===team).map(h=>({hero:h.hero,distance_units:h.distance_units})),
   enemies_nearby:nearby.filter(h=>h.team!==team).map(h=>({hero:h.hero,distance_units:h.distance_units})),
   radius_units:1600,health:r&&finite(r.health)?r.health:null,mana:r&&finite(r.mana)?r.mana:null};
  const candidates=[...(r?.abilities??[]).filter(a=>a.level>0).map(a=>({...a,kind:'ability'})),...(r?.items??[]).map(a=>({...a,kind:'item'}))];
  const resources=candidates.map(a=>({name:a.name,kind:a.kind,slot:a.slot??null,cooldown:finite(a.cooldown_remaining)?a.cooldown_remaining:null,mana_cost:finite(a.mana_cost)?a.mana_cost:null,
   restrictions:[...(a.kind==='item'&&(!Number.isInteger(a.slot)||a.slot<0||a.slot>5)?['outside_main_slots']:[]),...(a.hidden===true?['hidden']:[]),...(a.activated===false?['inactive']:[]),...(finite(a.cooldown_remaining)&&a.cooldown_remaining>0?['cooldown']:[]),...(finite(r.mana)&&finite(a.mana_cost)&&r.mana<a.mana_cost?['insufficient_mana']:[])]}));
  const questions=['Qual resultado você quer obter: preservar farm, proteger um aliado, ameaçar um alvo ou converter em objetivo?',
   'Qual sinal observável justificaria comprometer seu herói e qual sinal faria você recuar?'];
  if(resources.some(a=>a.restrictions.length))questions.push('Quais ferramentas exigem esperar recarga ou recuperar mana antes de executar a alternativa?');
  if(observation.enemies_nearby.length)questions.push('Como responder às ameaças registradas sem presumir que o jogador as enxergava?');
  if(d.world?.towers?.length||d.world?.lane_creeps?.length)questions.push('Que estrutura ou onda observada dá um propósito à jogada? Não deduza direção da wave de um único snapshot.');
  return {evidence_id:e.id,time:e.time,phase:e.time<600?'rota':e.time<1200?'transição':'jogo de equipe',observation,resources,
   coaching_questions:questions,
   missing:['Visibilidade do jogador e comunicações não confirmadas.','Distâncias geométricas não comprovam caminho, alcance ou tempo de chegada.',...(!r?['Vida, mana e recargas indisponíveis neste instante.']:[]),...(!d.world?['Estado de ondas e estruturas indisponível neste instante.']:[])],
   instruction:'Use este instante como exemplo; explique uma escolha e uma alternativa com condição de entrada, sequência, saída e tradeoff. Restrições são da amostra, não de todos os frames.'};
 });
}
export function coachingFramework(player){
 const lane=player.lane_role;
 return {version:1,role_basis:lane===2?'mid provável':lane===1?'rota segura; posição 1 ou 5 não confirmada':lane===3?'offlane; posição 3 ou 4 não confirmada':'posição não confirmada',
  method:['Defina a função do herói nesta composição com base nas ferramentas documentadas.','Escolha até três decisões de maior utilidade, incluindo bons exemplos quando sustentados.','Explique o sinal que permite agir, a execução e o resultado pretendido.','Compare uma alternativa plausível e o custo de escolhê-la.','Transforme a aula em uma regra condicional observável na próxima partida.'],
  phase_questions:{lane:['Como disputar a próxima onda sem comprometer recursos necessários para sobreviver?','Quando trocar recursos cria espaço para a dupla e quando prejudica o farm?'],transition:['Qual rota ou aliado permite usar o timing recém-adquirido?','O que deve continuar sendo farmado se não houver oportunidade de luta?'],team:['Qual ameaça impede sua função e quem precisa iniciar ou responder primeiro?','Que objetivo pode ser convertido depois da jogada?']},
  rule:'Perguntas são um método de ensino, não fatos observados nem conhecimento específico do patch. Use habilidades e efeitos somente quando documentados no contexto.'};
}
