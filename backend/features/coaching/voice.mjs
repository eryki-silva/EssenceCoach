const clock=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
// Wording changes only; rule selection and supporting event IDs stay intact.
export function coachVoice(lesson,evidence,hero){
 const rows=evidence.filter(e=>lesson.evidence_ids.includes(e.id));
 const find=kind=>rows.find(e=>e.kind===kind);
 const versions={
  farm_transition:()=>{const [a,b]=rows.filter(e=>e.kind==='rule_farm_window').map(e=>e.data);return {
   title:'Não perca o próximo farm depois de uma jogada',
   teaching:`Entre ${clock(a.start)} e ${clock(a.end)}, você pegou ${a.last_hits} creeps. De ${clock(b.start)} a ${clock(b.end)}, foram ${b.last_hits}.${rows.some(e=>e.kind==='deaths_log')?' Você também morreu nesse segundo trecho.':''} Eu começaria revendo essa mudança de ritmo: depois de uma luta ou de voltar à vida, para onde você foi?`,
   application:'Quando terminar uma onda, escolha a próxima onda ou campo antes de começar a andar. Se entrar numa luta, ao sair dela faça a mesma escolha de novo. Isso ajuda a retomar o farm sem ficar andando atrás do time sem saber o que buscar.',
   exception:'Se você estava defendendo uma torre ou protegendo quem precisava farmar, pegar menos creeps pode ter valido a pena. Reveja a jogada antes de tentar mudar esse hábito.',
   training:'Nas próximas três partidas, ao sair de uma luta ou voltar à vida, escolha sua próxima onda ou campo antes de andar.'};},
  farm_pause:()=>{const r=find('rule_farm_pause').data;return {
   title:'Saia de cada jogada sabendo para onde ir',
   teaching:`De ${clock(r.start)} até ${clock(r.end)}, você ficou sem pegar creeps. Vale rever esse trecho para entender o que ganhou em troca: uma luta, uma defesa ou proteção para um aliado.`,
   application:'Se você estava tentando fechar um item, procure a próxima onda ou campo seguro assim que a jogada acabar. Evite acompanhar uma perseguição só porque o resto do time continuou andando.',
   exception:'Como suporte, dar visão e proteger seu carry pode ser mais útil do que pegar esses creeps. O objetivo é ter uma tarefa, não farmar a qualquer custo.',
   training:'Depois de cada jogada, diga para si mesmo qual é sua próxima tarefa antes de mudar de área.'};},
  fight_survival:()=>{const e=find('teamfight');return {
   title:'Entre na luta com um plano para sair',
   teaching:`Na luta que começou em ${clock(e.time)}, você morreu. Eu voltaria alguns segundos antes da entrada: o que você queria fazer ali e como pretendia sair depois? A morte merece revisão, mas pode ter sido uma troca que ajudou seu time.`,
   application:'Se você precisava causar dano, espere seu aliado iniciar ou o inimigo gastar uma ameaça importante antes de avançar. Se precisava salvar alguém, fique perto desse aliado. Quando seu alvo escapar ou sua proteção acabar, pare de perseguir e procure uma saída.',
   exception:'Morrer para salvar um aliado importante ou concluir uma defesa pode valer a pena. Para decidir, veja o que o time conseguiu depois da sua entrada.',
   training:'Antes da próxima luta, escolha quem você vai atacar ou proteger e o que fará você recuar.'};},
  death_resources:()=>{const e=find('replay_decision_context'),r=e.data.self.resources;const mana=(r.abilities??[]).some(a=>a.level>0&&a.mana_sufficient===false);return {
   title:mana?'Recupere mana antes de voltar para o perigo':'Espere suas habilidades antes de se expor',
   teaching:`Pouco antes da sua morte em ${clock(e.time)}, ${mana?'faltava mana para pelo menos uma habilidade':'pelo menos uma habilidade ainda estava em recarga'}. Eu começaria conferindo se você precisava dessa habilidade para entrar ou escapar.`,
   application:mana?'Antes de avançar, reserve mana para a habilidade que permite sair. Se não tiver esse recurso, recupere mana numa posição protegida e só então procure outra entrada.':'Se sua entrada depende de uma habilidade que ainda não voltou, espere perto de um aliado ou numa área protegida. Assim que ela voltar, reavalie a luta; você não precisa continuar uma entrada que já perdeu o momento.',
   exception:'Às vezes é preciso agir para salvar alguém ou defender a base. A recarga ajuda a entender seu risco, mas não explica sozinha a morte.',
   training:'Antes de se aproximar de uma luta, confira a mana e a habilidade de que sua entrada ou fuga depende.'};},
  reference_item:()=>{const e=find('purchase_log'),r=find('reference_item_timing').data;return {
   title:'Prepare melhor o caminho até seu item',
   teaching:`Você comprou ${e.data.item??e.data.key} em ${clock(e.time)}. Nas ${r.sample_size} partidas de referência, metade dos compradores já tinha feito a compra até ${clock(r.median_seconds)}. Eu usaria essa diferença para rever o que aconteceu antes da compra.`,
   application:'Se esse era o item que você queria fechar, veja se alguma rotação interrompeu seu farm sem trazer uma troca útil. Na próxima partida, planeje uma sequência de onda e campos seguros e evite gastar o dinheiro separado para essa compra.',
   exception:'Uma defesa necessária ou uma rota difícil pode justificar comprar depois. Copiar o minuto de outra partida não garante uma decisão melhor.',
   training:'Escolha uma compra prioritária e, depois da partida, reveja a jogada que mais interrompeu o caminho até ela.'};},
  item_followup:()=>{const e=find('purchase_log'),f=find('teamfight');return {
   title:'Decida o que fazer depois da compra',
   teaching:`Você comprou ${e.data.item??e.data.key} em ${clock(e.time)} e houve uma luta em ${clock(f.time)}. Vale rever se o item já tinha chegado e se você conseguiu aproveitar a compra nessa jogada.`,
   application:'Quando o item chegar, escolha seu próximo passo: farmar uma área com mais segurança, acompanhar um aliado ou disputar um objetivo. Confira sua vida, mana e quem pode ir junto antes de procurar a luta.',
   exception:'Se seu time não puder acompanhar, continue farmando numa área segura. Fechar um item não obriga você a lutar imediatamente.',
   training:'Ao receber uma compra importante, escolha uma jogada que ela ajuda a fazer antes de sair da área atual.'};},
  farm_route:()=>{const r=find('rule_farm_route').data;return {
   title:'Faça seu caminho terminar perto da próxima jogada',
   teaching:`Reveja seu caminho de ${clock(r.start)} a ${clock(r.end)} no mapa. Nesse trecho, você se deslocou bastante e pegou ${r.last_hits} creeps. Eu procuraria onde uma mudança de direção ajudou o time e onde você poderia ter escolhido o destino antes.`,
   application:'Se sua tarefa era farmar, ligue uma onda aos campos próximos e termine perto da área onde seu time vai precisar de você. Depois de uma luta, escolha outra onda ou campo antes de voltar a andar.',
   exception:'Não siga uma rota só para pegar mais creeps se houver inimigos sem aparecer no mapa. Pode ser melhor ceder uma área e jogar perto do time.',
   training:'Ao terminar cada onda, escolha o próximo campo ou onda e evite voltar pelo mesmo caminho sem uma razão.'};},
  coverage:()=>({title:'Vamos começar pelo seu próximo movimento',teaching:`Faltam detalhes desta partida de ${hero} para apontar um lance específico com segurança. Ainda dá para escolher um hábito útil para treinar.`,application:'Antes de mudar de área, escolha sua tarefa: pegar uma onda, fazer um campo, proteger um aliado ou defender uma torre. Depois de uma luta, faça essa escolha de novo.',exception:'Se quiser revisar lances desta partida, solicite o processamento do OpenDota. Partidas antigas podem não ter replay disponível.',training:'Na próxima partida, escolha sua próxima tarefa antes de mudar de área.'})
 };
 const rewrite=versions[lesson.rule]?.();
 return rewrite?{...lesson,...rewrite}:lesson;
}
