import {createFarmRoute} from '../replays/heatmap.js';
import {$,el,list,section,safeLink,time,date,notify} from '../../core/dom.js';
import {state,replaySession} from '../../core/state.js';
export function download(content, type, extension) {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob);
  const a = el('a'); a.href = url; a.download = `dota-${state.report.match_id}-${state.report.player_slot}.${extension}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export function markdown(report) {
  const a=report.analysis;
  return ['# Aula de '+report.hero+' · partida '+report.match_id, 'Gerado: '+report.generated_at+' · '+report.model, a.summary, '## O plano para este jogo', a.game_plan || '', ...(a.lessons || []).map(l=>'## '+l.title+'\n\n'+l.teaching+'\n\n'+l.application+'\n\n'+l.exception+'\n\nEvidências: '+l.evidence_ids.join(', ')), '## O que vale repetir', ...a.strengths, '## Para levar à próxima partida', ...a.training_plan, '## Fontes e limites',a.patch_context,...a.limitations,...report.context.warnings,...report.context.sources.map(x=>x.name+': '+x.url+' · '+x.fetched_at)].join('\n\n');
}
export function prose(parent,text,className='coach-prose') {
  for (const paragraph of String(text || '').split(/\n\s*\n/).filter(Boolean)) parent.append(el('p',className,paragraph));
}
export function renderReport(report) {
  const root = $('report'); root.replaceChildren(); root.hidden = false;
  const a = report.analysis;
  const intro = el('section', 'panel');
  const header = el('div', 'report-head'), titles = el('div');
  titles.append(el('p', 'eyebrow', 'SEU RELATÓRIO'), el('h2', '', `${report.hero} · #${report.match_id}`), el('p', '', `Sua aula · ${date(report.generated_at)}`));
  header.append(titles);
  intro.append(header); prose(intro,a.summary,'report-summary');
  root.append(intro);
  const plan=section('Seu foco para a próxima partida');prose(plan,a.game_plan || a.summary);root.append(plan);
  if (a.lessons?.length) {
    const classroom=section('Vamos rever sua partida');
    for (const lesson of a.lessons) {
      const article=el('article','coach-lesson');
      article.append(el('p','eyebrow',lesson.time===null?'PARA TREINAR':time(lesson.time)+' · REVEJA ESTE MOMENTO'),el('h3','',lesson.title));
      prose(article,lesson.teaching);
      article.append(el('h4','','O que tentar nesse momento'));prose(article,lesson.application,'coach-prose coach-example');
      const nuance=el('details');nuance.append(el('summary','','Quando faria sentido jogar diferente?'));prose(nuance,lesson.exception,'coach-prose coach-tradeoff');article.append(nuance);
      if (lesson.time!==null && replaySession.data) { const watch=el('button','secondary','Ver este lance no mapa');watch.type='button';watch.addEventListener('click',()=>replaySession.view?.seek(Math.max(0,lesson.time-15)));article.append(watch); }
      const proof=el('details');proof.append(el('summary','',lesson.time===null?'O que os dados mostram':'O que os dados mostram · '+time(lesson.time)));
      const briefs=(report.context.decision_briefs??[]).filter(b=>lesson.evidence_ids.includes(b.evidence_id));
      for(const brief of briefs){
        const o=brief.observation;
        const facts=el('div','decision-facts');
        facts.append(el('p','', 'Amostra em '+time(o.snapshot_time)+' · '+brief.phase+'.'));
        if(o.health!==null||o.mana!==null)facts.append(el('p','', 'Seus recursos: '+(o.health===null?'vida não registrada':o.health+' de vida')+'; '+(o.mana===null?'mana não registrada':o.mana+' de mana')+'.'));
        for(const [label,rows] of [['Aliados próximos',o.allies_nearby],['Adversários próximos',o.enemies_nearby]])facts.append(el('p','',label+': '+(rows.length?rows.map(h=>h.hero+' ('+h.distance_units+' unidades)').join(', '):'nenhum registrado neste recorte')+'.'));
        const restrictions={cooldown:'em recarga',insufficient_mana:'mana insuficiente',hidden:'oculta',inactive:'desativada',outside_main_slots:'fora dos seis slots principais ou slot não confirmado'};
        const blocked=brief.resources.filter(r=>r.restrictions.length);
        if(blocked.length)facts.append(el('p','', 'Restrições na amostra: '+blocked.map(r=>String(r.name||'recurso sem nome').replaceAll('_',' ')+': '+r.restrictions.map(k=>restrictions[k]).join(', ')).join('; ')+'.'));
        facts.append(el('p','hint','Recorte de '+o.radius_units+' unidades em linha reta, na perspectiva do observador. Não comprova visão ou participação na luta.'));
        proof.append(facts);
      }
      const raw=el('details');raw.append(el('summary','', 'Registros técnicos usados nesta aula'),el('pre','',JSON.stringify(report.evidence.filter(e=>lesson.evidence_ids.includes(e.id)),null,2)));proof.append(raw);article.append(proof);classroom.append(article);
    }
    root.append(classroom);
  }
  if (a.strengths.length) { const good=section('O que vale repetir');good.append(list(a.strengths));root.append(good); }
  if (a.training_plan.length) { const practice=section('Para levar à próxima partida');practice.append(list(a.training_plan));root.append(practice); }
  if(report.farm_route?.available)root.append(createFarmRoute(report.farm_route,report.hero));
  if(report.metrics?.length){const progress=el('details','panel');progress.append(el('summary','','Conferir meu farm minuto a minuto'));const grid=el('div','report-grid');for(const m of report.metrics){const cell=el('div','metric');cell.append(el('span','',m.label),el('b','',m.value),el('span','',m.detail));grid.append(cell);}progress.append(grid);root.append(progress);}
  const reference=report.context.meta_reference;
  const deepMeta=report.context.hero_analysis,performance=report.context.performance;
  if(deepMeta||performance){
    const meta=el('details','panel');meta.append(el('summary','','Comparar meus números com outras partidas'));
    if(performance?.rows?.length){const grid=el('div','report-grid');for(const row of performance.rows){const cell=el('div','metric');cell.append(el('span','',row.label),el('b','',String(row.observed)),el('span','','Mediana agregada: '+Math.round(row.median*10)/10+' · diferença '+(row.delta>0?'+':'')+row.delta));grid.append(cell);}meta.append(grid,el('p','hint',performance.scope));}
    const rankNames={1:'Herald',2:'Guardian',3:'Crusader',4:'Archon',5:'Legend',6:'Ancient',7:'Divine',8:'Immortal'};
    const rank=deepMeta?.rank_stats;
    if(rank&&rank.picks>0&&Number.isFinite(rank.wins))meta.append(el('p','report-context',report.hero+' · '+(rankNames[deepMeta.rank_tier]??'rank desconhecido')+': '+rank.picks+' escolhas, '+rank.wins+' vitórias ('+(100*rank.wins/rank.picks).toFixed(1)+'%). Faixa média da partida, não rank individual. '+rank.window+' Sem filtro de posição; taxa de vitória não demonstra a melhor build.'));
    if(deepMeta){meta.append(el('p','report-context',deepMeta.sample_size+' partidas comparáveis · '+deepMeta.role+' · consultado em '+date(deepMeta.window_end)+'. Recorte: últimos 14 dias, mesmo herói, patch, modo, lobby e rota; rank médio igual quando disponível.'));
      if(!deepMeta.sample_size)meta.append(el('p','hint','Não houve partida elegível no lote de até seis jogos recentes. A lista por herói pode trazer partidas competitivas, incompatíveis com seu lobby. Nenhuma build foi apresentada como referência equivalente.'));
      if(deepMeta.sample_size>0&&deepMeta.sample_size<5)meta.append(el('p','hint','Amostra inferior a cinco jogadores: comparação exploratória, sem julgamento automático de atraso.'));
      if(deepMeta.farm?.length)meta.append(el('h4','','Farm nos mesmos minutos'),list(deepMeta.farm.map(x=>time(x.time)+': você '+(x.observed??'sem registro')+' LH · mediana '+x.median+' LH · intervalo '+x.min+'–'+x.max+' · '+x.sample_size+' registros.')));
      if(deepMeta.item_timings?.length)meta.append(el('h4','','Compras e timings observados'),list(deepMeta.item_timings.map(x=>x.item+': você '+(x.observed_seconds===null?'sem compra registrada':time(x.observed_seconds))+' · mediana '+time(x.median_seconds)+' · '+x.sample_size+'/'+x.denominator+' compradores.')));
      if(deepMeta.skills?.length){const skills=el('details');skills.append(el('summary','','Ordem de habilidades e facets observadas'),list(deepMeta.skills.map(x=>'Nível '+x.level+' · habilidade ID '+x.ability_id+': '+x.count+'/'+x.denominator+' · sua habilidade '+(x.observed??'não registrada'))),list(deepMeta.facets.map(x=>'Facet ID '+x.variant+': '+x.count+'/'+x.denominator+' · sua facet '+(x.observed??'não registrada'))),el('p','hint','IDs brutos: não há mapeamento histórico confiável de nomes e efeitos neste recorte.'));meta.append(skills);}
      for(const m of deepMeta.matches??[]){const link=el('a','source-link','Partida da amostra #'+m.match_id+' · '+date(new Date(m.start_time*1000).toISOString()));link.href=safeLink(m.url);link.target='_blank';link.rel='noopener noreferrer';meta.append(link);}
    }root.append(meta);
  }
  if(reference){const meta=el('details','panel');meta.append(el('summary','','Consultar referências de meta'));meta.append(el('p','report-context',reference.population),el('p','report-context',reference.note));for(const [label,url]of [['Consultar meta no Dota2ProTracker',reference.url],['Consultar '+report.hero+' na fonte',reference.hero_url]]){const link=el('a','source-link',label);link.href=safeLink(url);link.target='_blank';link.rel='noopener noreferrer';meta.append(link);}meta.append(el('p','hint','Disponibilidade conferida em '+reference.checked_at+' · sem importação automática.'));root.append(meta);}
  const context = section('Fontes e limites da análise');
  const matchSource=el('a','source-link','OpenDota · eventos da partida #'+report.match_id);matchSource.href='https://www.opendota.com/matches/'+encodeURIComponent(report.match_id);matchSource.target='_blank';matchSource.rel='noopener noreferrer';context.append(matchSource);
  context.append(el('p', 'report-context', report.context.hero_analysis?.sample_size ? report.context.hero_analysis.sample_size + ' partidas comparáveis. Os detalhes estão abaixo.' : 'Sem amostra externa comparável. A aula usa os eventos desta partida.'));
  const details = el('details'); details.className='technical-context';
  details.append(el('summary', '', 'Consultar patch, referências e limitações'));
  details.append(el('p', 'report-context', a.patch_context),el('p','report-context',report.model+' · confiança '+a.confidence+' · '+report.coverage));
  const deep=report.context.hero_analysis;
  if (deep?.item_timings?.length) {
    details.append(el('h4','','Timings de referência'),list(deep.item_timings.map(x=>x.item + ': mediana ' + time(x.median_seconds) + ' · ' + x.sample_size + '/' + x.denominator + ' logs; nesta partida ' + (x.observed_seconds===null?'sem evento':time(x.observed_seconds)))));
  }
  if (deep?.sample_size) {
    details.append(el('p','report-context',deep.role + ' · rank médio ' + (deep.rank_tier ?? 'desconhecido') + ' · ' + date(deep.window_start) + ' até ' + date(deep.window_end)),list(deep.limitations));
    for (const b of deep.build_examples || []) { const build=el('details');build.append(el('summary','', 'Build observada · partida ' + b.match_id),list((b.purchases||[]).map(p=>p.item+' · '+time(p.time))));details.append(build); }
  }
  const pro=report.context.recent_professional;
  if (pro?.selected_hero_examples?.length) {
    details.append(el('h4','','Exemplos profissionais deste herói'),el('p','report-context',pro.sample_size+' partidas consultadas. '+pro.note));
    for (const example of pro.selected_hero_examples) { const link=el('a','source-link',example.player+' · '+example.league+' · '+example.match_id);link.href=safeLink(example.url);link.target='_blank';link.rel='noopener noreferrer';details.append(link); }
  }
  details.append(el('h4','','Limitações'),list([...new Set([...a.limitations,...report.context.warnings])]));
  for (const integration of report.context.integrations || []) { const link=el('a','source-link',integration.name+' · consulta manual');link.href=safeLink(integration.url);link.target='_blank';link.rel='noopener noreferrer';details.append(link,el('p','report-context',integration.limitation)); }
  for (const source of report.context.sources) { const href=safeLink(source.url);if(!href)continue;const link=el('a','source-link',source.name+' · '+date(source.fetched_at));link.href=href;link.target='_blank';link.rel='noopener noreferrer';details.append(link); }
  if (report.replay_review) {const automatic=el('details');automatic.append(el('summary','','Índice automático de eventos'),el('pre','',JSON.stringify(report.replay_review,null,2)));details.append(automatic);}
  const raw=el('details');raw.append(el('summary','','Dados completos de contexto'),el('pre','',JSON.stringify({availability:report.availability,context:report.context},null,2)));details.append(raw);context.append(details);root.append(context);
  const actions = el('div', 'report-actions');
  const pdf = el('button', 'primary', 'Salvar relatório em PDF'); pdf.type = 'button';
  pdf.addEventListener('click', () => {
    const previousTitle = document.title;
    document.title = 'Dota Coach - ' + report.hero + ' - partida ' + report.match_id;
    const restore = () => { document.title = previousTitle; };
    window.addEventListener('afterprint', restore, { once: true });
    try { window.print(); } catch { restore(); notify('Não foi possível abrir a impressão. Use Ctrl + P e escolha Salvar como PDF.', true); }
  });
  actions.append(pdf); root.append(actions, el('p', 'pdf-help', 'Na janela de impressão, escolha “Salvar como PDF”. O arquivo inclui resumo, recomendações, plano de treino e fontes, sem blocos de código.'));
}

