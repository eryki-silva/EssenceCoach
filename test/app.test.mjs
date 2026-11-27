import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { accountId, matchId, buildEvidence, createService, validateAnalysis, connectionError, geminiKey } from '../lib.mjs';
import { createApp } from '../server.mjs';

const match = {
  match_id: 8123456789, duration: 2400, start_time: 1740000000, patch: 60, version: 21, radiant_win: true,
  players: [
    { player_slot: 0, account_id: 132959615, hero_id: 1, personaname: '<img src=x onerror=alert(1)>', kills: 8, deaths: 3, assists: 6, gold_per_min: 600, times: [0, 60, 120], gold_t: [600, 800, 1100], lh_t: [0, 3, 7], purchase_log: [{ time: 120, key: 'boots' }], kills_log: [{ time: 600, key: 'npc_dota_hero_axe' }], buyback_log: [], item_0: 29 },
    { player_slot: 128, account_id: 42, hero_id: 2, kills: 1, deaths: 5, assists: 2 }
  ],
  teamfights: [{ start: 600, end: 620, deaths: 1, players: [{ deaths: 0, damage: 1200, gold_delta: 300 }, { deaths: 1, damage: 200 }] }],
  objectives: [{ time: 1500, type: 'CHAT_MESSAGE_ROSHAN_KILL', team: 2 }]
};
const validAnalysis = {
  game_plan: 'Use a mobilidade do Anti-Mage para chegar a uma rota segura depois de acompanhar uma jogada. O plano depende de quais inimigos estão visíveis, informação que este registro não confirma.',
  lessons: [{title:'O item precisa mudar sua próxima decisão',teaching:'A compra de Boots aos 2:00 é um ponto para pensar no caminho da sua próxima rotação. Velocidade tem valor quando ajuda você a chegar à onda ou sair do alcance do adversário; o número de compras sozinho não mede esse valor.',application:'Se a onda estiver chegando à sua torre e houver inimigos fora do mapa, eu voltaria pela rota protegida para receber a experiência. Se o aliado estiver criando uma troca favorável ao seu alcance, eu acompanharia primeiro e voltaria à onda depois.',exception:'Se o caminho estiver bloqueado por um inimigo, preserve a saída antes de tentar recuperar a onda.',time:null,evidence_ids:['E2']}],
  summary: 'Revise a fase inicial de farm.', confidence: 'média', strengths: ['Boa participação nos abates.'],
  findings: [{ title: 'Revisar farm inicial', category: 'economia', severity: 'média', time: null, observation: 'O desempenho inicial merece revisão.', recommendation: 'Treine last hits por dez minutos.', rationale: 'Compare evolução entre sessões.', next_game_rule: 'Quando houver uma onda segura, pratique o último golpe.', replay_check: 'Confira a execução dos últimos golpes na fase de rotas.', certainty: 'hipótese', evidence_ids: ['E2'] }],
  training_plan: ['Registrar last hits aos dez minutos.'], patch_context: 'Catálogo comunitário; meta agregado.', limitations: ['Posição contínua indisponível.']
};
const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
test('normaliza somente espaços externos e rejeita credenciais com caracteres inválidos sem expor o valor', () => {
  assert.equal(geminiKey({ GEMINI_API_KEY: '  test-key\r\n' }), 'test-key');
  for (const key of ['test\nsecret', 'test secret', 'test-•']) assert.throws(() => geminiKey({ GEMINI_API_KEY: key }), error => error.status === 400 && !error.message.includes(key));
  assert.throws(() => geminiKey({ GEMINI_API_KEY: '   ' }), error => error.status === 503);
  const error = connectionError('api.openai.com', { message: 'Headers: invalid header value Bearer sensitive-value' });
  assert.equal(error.status, 400); assert(!error.message.includes('sensitive-value'));
});

test('diagnóstico distingue DNS, certificado, timeout e interrupção sem expor erros ou chaves', () => {
  for (const [code, expected] of [['ENOTFOUND', /DNS/], ['UNABLE_TO_GET_ISSUER_CERT_LOCALLY', /certificado TLS/], ['UND_ERR_CONNECT_TIMEOUT', /Tempo limite/], ['ECONNRESET', /interrompida/], ['ECONNREFUSED', /recusada/]]) {
    const result = connectionError('api.openai.com', { cause: { code, message: 'secret-do-not-print' } });
    assert.match(result.message, expected); assert(!result.message.includes('secret-do-not-print'));
  }
  assert.equal(connectionError('api.openai.com', { name: 'TimeoutError' }).status, 504);
  assert.match(connectionError('api.openai.com', { cause: { errors: [{ code: 'ETIMEDOUT' }] } }).message, /Tempo limite/);
  assert(!connectionError('api.openai.com', { code: 'secret-do-not-print' }).message.includes('secret-do-not-print'));
});
function fixture({ key = true, mutateResponse, failMeta = false, replayData = null } = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/models?pageSize=')) return jsonResponse({ models: [{ name: 'models/gemini-3.1-flash-lite', supportedGenerationMethods: ['generateContent'] }] });
    if (url.includes('/matches/')) return jsonResponse(match);
    if (url.includes('/request/')) return jsonResponse({ job: { jobId: 123 } });
    if (url.endsWith('/heroes.json')) return jsonResponse({ 1: { localized_name: 'Anti-Mage', name:'npc_dota_hero_antimage' }, 2: { localized_name: 'Axe',name:'npc_dota_hero_axe' } });
    if (url.endsWith('/items.json')) return jsonResponse({ boots: { id: 29, dname: 'Boots of Speed' } });
    if (url.endsWith('/patch.json')) return jsonResponse([{ id: 60, name: '7.41', date: '2026-03-24' }, { id: 61, name: 'Future patch', date: '2099-01-01' }]);
    if (url.includes('/heroStats')) return failMeta ? jsonResponse({}, 403) : jsonResponse([{ id: 1, pro_pick: 100, pro_win: 50, '7_pick': 50, '7_win': 20 }]);
    if (url.includes('/benchmarks')) return jsonResponse({ result: { gold_per_min: [{ percentile: .5, value: 500 }] } });
    if (url.includes('/itemPopularity')) return jsonResponse({ start_game_items: { 29: 30 } });
    if (url.includes('steampowered')) return jsonResponse({ appnews: { newsitems: [{ title: 'Dota 2 Update 7.41', contents: '<p>Balance update</p>', url: 'https://store.steampowered.com/news/app/570/', date: 1774396800 }] } });
    if (url.includes('generativelanguage.googleapis.com')) return jsonResponse(mutateResponse ? mutateResponse() : { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(validAnalysis) }] } }] });
    throw Error(`Unexpected URL: ${url}`);
  };
  return { service: createService({ fetcher, replayStore:replayData?{data:async()=>replayData,status:async()=>({state:'complete'}),available:async()=>true}:undefined, env: key ? { GEMINI_API_KEY: 'test-only-not-real' } : {}, now: () => Date.parse('2026-10-27') }), calls };
}

test('valida IDs e converte SteamID64/link sem perda de precisão', () => {
  assert.equal(accountId('76561198093225343'), 132959615);
  assert.equal(accountId('https://steamcommunity.com/profiles/76561198093225343/'), 132959615);
  assert.equal(accountId('132959615'), 132959615);
  assert.equal(accountId(''), null);
  for (const v of ['abc', '0', '99999999999999999', 'https://evil.com/76561198093225343']) assert.throws(() => accountId(v));
  assert.equal(matchId('8123456789'), '8123456789');
  for (const v of ['../../secret', '000000', '1', '1e10']) assert.throws(() => matchId(v));
});
test('seleciona jogador pelo perfil e mantém escolha manual para conta ausente', async () => {
  const { service } = fixture();
  const result = await service.matchView('8123456789', '76561198093225343');
  assert.equal(result.selected_slot, 0); assert.equal(result.players[0].hero, 'Anti-Mage'); assert.equal(result.parsed, true);
  assert.equal((await service.matchView('8123456789', '123')).selected_slot, null);
});
test('gera evidências com eventos e preserva a diferença entre campo ausente e lista vazia', () => {
  const { evidence, availability } = buildEvidence(match, match.players[0], { boots: { id: 29, dname: 'Boots of Speed' } });
  assert.equal(availability.buyback_log, true); assert.equal(availability.obs_log, false);
  assert.equal(evidence.find(e => e.kind === 'purchase_log').data.item, 'Boots of Speed');
  assert.equal(evidence.find(e => e.kind === 'teamfight').data.player.damage, 1200);
  assert.equal(evidence.filter(e => e.kind === 'timeline').length, 3);
  const partial = buildEvidence(match, match.players[1]);
  assert.equal(partial.availability.timeline, false); assert.equal(partial.evidence.filter(e => e.kind === 'timeline').length, 0);
});
test('herói tem prioridade sobre a própria conta e permite analisar outros jogadores', async () => {
  const { service } = fixture();
  const friend = await service.matchView('8123456789', '132959615', 'Axe');
  assert.equal(friend.selected_slot, 128); assert.equal(friend.selection_method, 'hero');
  assert.equal((await service.matchView('8123456789', null, 'anti mage')).selected_slot, 0);
  assert.equal((await service.matchView('8123456789', '132959615', 'Invoker')).selected_slot, null);
  const report = await service.analyze('8123456789', 128);
  assert.equal(report.hero, 'Axe'); assert.equal(report.player_slot, 128);
});
test('recusa relatório sem evidências válidas, tipos incorretos e timestamps inventados', () => {
  const evidence = buildEvidence(match, match.players[0]).evidence;
  assert.equal(validateAnalysis(structuredClone(validAnalysis), evidence).confidence, 'média');
  for (const mutate of [a => a.findings[0].evidence_ids = ['FAKE'], a => a.findings[0].time = 555, a => a.findings[0].evidence_ids = [], a => a.confidence = 'absoluta', a => a.summary = {}, a => delete a.limitations, a => a.lessons[0].evidence_ids = ['FAKE'], a => a.lessons[0].time = 555, a => a.lessons[0].application = '', a => a.lessons[0].teaching = ' ', a => a.lessons = [], a => a.lessons = Array(4).fill(a.lessons[0]), a => delete a.game_plan]) {
    const a = structuredClone(validAnalysis); mutate(a); assert.throws(() => validateAnalysis(a, evidence));
  }
});
test('análise usa regras com evidências válidas e não transmite dados a modelo',async()=>{
 const {service,calls}=fixture({key:false});const report=await service.analyze('8123456789',0,'farm');
 assert.equal(report.engine.type,'deterministic');assert.equal(report.hero,'Anti-Mage');assert(report.analysis.lessons.length>=1);validateAnalysis(report.analysis,report.evidence);
 assert(!calls.some(c=>/googleapis|generateContent/.test(c.url)));assert.equal(report.context.hero_analysis.sample_size,0);
});

test('fonte de meta indisponível gera aviso sem inventar dados', async () => {
  const { service } = fixture({ failMeta: true });
  const report = await service.analyze('8123456789', 0);
  assert.equal(report.context.meta, undefined);
  assert.equal(report.context.hero_analysis.sample_size,0);
});

test('a aula recebe contexto espacial real com evidência e perspectiva do observador',async()=>{
 const replayData={source:'parser teste',capabilities:{hero_resources:true,cooldowns:true},limitations:['Visibilidade desconhecida'],samples:[{time:599,player_slot:0,hero_id:1,x:100,y:100,life_state:0},{time:599,player_slot:128,hero_id:2,x:110,y:100,life_state:0}],states:[{time:599,player_slot:0,mana:20,health:300,abilities:[{name:'antimage_blink',level:1,slot:1,mana_cost:60,cooldown_remaining:4}],items:[]}],events:[{type:'DOTA_COMBATLOG_DEATH',time:600,targetname:'npc_dota_hero_antimage',targethero:true}]};
 const {service,calls}=fixture({replayData});const report=await service.analyze('8123456789',0);
 assert.equal(report.availability.spatial_replay,true);
 const input=report;
 const spatial=input.evidence.find(e=>e.kind==='replay_decision_context');assert.equal(spatial.time,600);assert.equal(spatial.data.other_heroes[0].hero,'Axe');assert.equal(spatial.data.other_heroes[0].distance_units,1280);assert.match(spatial.data.perspective,/desconhecida/);
 assert.equal(spatial.data.self.resources.mana,20);assert.equal(spatial.data.self.resources.abilities[0].cooldown_remaining,4);assert.equal(spatial.data.self.resources.abilities[0].mana_sufficient,false);
 assert(!calls.some(c=>c.url.includes('googleapis')));
 assert.equal(input.context.decision_briefs[0].evidence_id,spatial.id);
 assert.deepEqual(input.context.decision_briefs[0].resources[0].restrictions,['cooldown','insufficient_mana']);

 assert.equal(report.farm_route.available,true);assert.equal(report.farm_route.player_slot,0);assert.equal(report.farm_route.points.length,1);
});
test('chave ausente não impede o motor determinístico',async()=>{const {service,calls}=fixture({key:false});const report=await service.analyze('8123456789',0);assert.equal(report.engine.type,'deterministic');assert(!calls.some(c=>/googleapis/.test(c.url)));});

test('valida jogador antes de chamar Google Gemini', async () => {
  const { service, calls } = fixture();
  await assert.rejects(() => service.analyze('8123456789', 99), /Jogador não encontrado/);
  assert(!calls.some(c => c.url.includes('generativelanguage.googleapis.com')));
});
test('processamento envia POST e retorna protocolo sem prometer replay disponível', async () => {
  const { service, calls } = fixture();
  const result = await service.parse('8123456789');
  assert.equal(result.job_id, 123); assert.match(result.message, /não é garantido/);
  assert.equal(calls[0].options.method, 'POST');
});
test('falha de rede, limite e autenticação têm erros seguros', async () => {
  for (const status of [403, 404, 429, 500]) {
    const service = createService({ fetcher: async () => jsonResponse({ secret: 'never-show-this' }, status) });
    await assert.rejects(() => service.matchView('8123456789'), error => !error.message.includes('never-show-this') && error.status >= 400);
  }
  const service = createService({ fetcher: async () => { throw Error('secret-value'); } });
  await assert.rejects(() => service.matchView('8123456789'), /Não foi possível acessar api.opendota.com/);
});
test('resposta de um modelo externo não participa da análise por código',async()=>{const {service,calls}=fixture({mutateResponse:()=>({})});const report=await service.analyze('8123456789',0);assert.equal(report.engine.type,'deterministic');assert(!calls.some(c=>/googleapis/.test(c.url)));});

function httpCall(server, path, { method = 'GET', body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path, method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers } }, res => {
      let text = ''; res.on('data', c => text += c); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text, json: () => JSON.parse(text) }));
    }); req.on('error', reject); if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body)); req.end();
  });
}
test('HTTP: interface, endpoints, consentimento e validação', async t => {
  const { service } = fixture(); const server = createApp(service);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  const home = await httpCall(server, '/'); assert.equal(home.status, 200); assert.match(home.text, /76561198093225343/);
  assert.match(home.headers['content-security-policy'], /default-src 'self'/);
  assert.equal((await httpCall(server, '/api/health')).json().analysis_available, true);
  assert.equal((await httpCall(server, '/api/matches/8123456789?account=132959615')).json().selected_slot, 0);
  const path = '/api/matches/8123456789/analyze';
  assert.equal((await httpCall(server, path, { method: 'POST', body: { player_slot: 0 } })).status, 200);
  assert.equal((await httpCall(server, path, { method: 'POST', body: { player_slot: 0, consent: true } })).status, 200);
  assert.equal((await httpCall(server, path, { method: 'POST', body: '{' })).status, 400);
  assert.equal((await httpCall(server, path, { method: 'POST', body: null })).status, 400);
  assert.equal((await httpCall(server, '/.env')).status, 404);
});
test('HTTP: bloqueia origens externas, DNS rebinding e corpos grandes', async t => {
  const server = createApp(fixture().service);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  for (const headers of [{ Origin: 'https://evil.example' }, { Host: 'evil.example' }, { 'Sec-Fetch-Site': 'cross-site' }]) assert.equal((await httpCall(server, '/api/health', { headers })).status, 403);
  assert.equal((await httpCall(server, '/api/matches/8123456789/analyze', { method: 'POST', body: 'x'.repeat(9000) })).status, 413);
});
test('HTTP: limita solicitações de processamento', async t => {
  const server = createApp(fixture().service);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  for (let i = 0; i < 6; i++) assert.equal((await httpCall(server, '/api/matches/8123456789/parse', { method: 'POST', body: {} })).status, 202);
  assert.equal((await httpCall(server, '/api/matches/8123456789/parse', { method: 'POST', body: {} })).status, 429);
});



test('resumos de fase usam intervalos reais e não inventam métricas ausentes',()=>{
 const p={player_slot:0,kills:2,assists:3,times:[0,300,600,900,1200],gold_t:[0,900,2400,3000,3600],lh_t:[0,20,50,60,70]};
 const m={duration:1200,players:[p,{player_slot:1,kills:8},{player_slot:128,kills:99}]};
 const ev=buildEvidence(m,p).evidence;
 const phases=ev.filter(e=>e.kind==='phase_progress');
 assert.equal(phases.length,2);assert.equal(phases[0].time,600);
 assert.equal(phases[0].data.gold_per_minute,240);assert.equal(phases[1].data.gold_per_minute,120);
 assert.equal(phases[0].data.last_hits_delta,50);assert(!('xp_delta' in phases[0].data));
 assert.equal(ev.find(e=>e.kind==='team_participation').data.participation_pct,50);
 assert.equal(buildEvidence({duration:1200,players:[{player_slot:0}]},{player_slot:0}).evidence.filter(e=>e.kind==='phase_progress').length,0);
});
