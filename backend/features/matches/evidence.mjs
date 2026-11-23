import {pick} from '../../shared/formatters.mjs';
const metricFields = ['kills', 'deaths', 'assists', 'last_hits', 'denies', 'gold_per_min', 'xp_per_min', 'net_worth', 'hero_damage', 'tower_damage', 'hero_healing', 'level', 'stuns', 'obs_placed', 'sen_placed', 'camps_stacked', 'lane_efficiency_pct', 'lane_role', 'teamfight_participation', 'actions_per_min', 'courier_kills', 'roshans_killed', 'towers_killed'];

export function buildEvidence(match, player, items = {}) {
  const evidence = [];
  const add = (kind, time, data) => evidence.push({ id: `E${evidence.length + 1}`, kind, time, data });
  add('match', null, pick(match, ['match_id', 'duration', 'start_time', 'patch', 'game_mode', 'lobby_type', 'radiant_win']));
  add('player_totals', null, { hero_id: player.hero_id, player_slot: player.player_slot, team: player.player_slot < 128 ? 'Radiant' : 'Dire', ...pick(player, metricFields) });
  add('lineups', null, match.players.map(p => ({ hero_id: p.hero_id, team: p.player_slot < 128 ? 'Radiant' : 'Dire', selected_player: p.player_slot === player.player_slot, ...pick(p, ['kills', 'deaths', 'assists', 'gold_per_min', 'net_worth', 'item_0', 'item_1', 'item_2', 'item_3', 'item_4', 'item_5']) })));
  const combat = pick(player, ['ability_uses', 'item_uses', 'killed_by', 'damage_inflictor_received', 'damage_inflictor', 'kill_streaks', 'multi_kills', 'ability_upgrades_arr', 'hero_variant']);
  if (Object.keys(combat).length) add('combat_summary', null, combat);
  const availability = {};
  for (const field of ['purchase_log', 'kills_log', 'deaths_log', 'buyback_log', 'obs_log', 'sen_log', 'runes_log']) {
    availability[field] = Array.isArray(player[field]);
    for (const event of (player[field] ?? []).slice(0, 100)) {
      add(field, typeof event.time === 'number' ? event.time : null, { ...pick(event, ['key', 'unit', 'killer', 'x', 'y', 'type']), ...(field === 'purchase_log' ? { item: items[event.key]?.dname ?? event.key } : {}) });
    }
  }
  availability.timeline = Array.isArray(player.gold_t) && Array.isArray(player.times);
  for (let i = 0; i < (player.times?.length ?? 0); i++) {
    const data = {};
    for (const key of ['gold_t', 'xp_t', 'lh_t', 'dn_t']) if (typeof player[key]?.[i] === 'number') data[key] = player[key][i];
    if (Object.keys(data).length) add('timeline', player.times[i], data);
  }
  const index = match.players.findIndex(p => p.player_slot === player.player_slot);
  availability.teamfights = Array.isArray(match.teamfights);
  for (const fight of (match.teamfights ?? []).slice(0, 50)) {
    const p = fight.players?.[index];
    if (p) add('teamfight', fight.start ?? null, { ...pick(fight, ['start', 'end', 'deaths']), player: pick(p, ['deaths', 'buybacks', 'damage', 'healing', 'gold_delta', 'xp_delta', 'ability_uses', 'item_uses', 'killed']) });
  }
  for (const event of (match.objectives ?? []).slice(0, 80)) add('objective', event.time ?? null, pick(event, ['type', 'key', 'slot', 'player_slot', 'team']));
  add('final_inventory', null, Object.fromEntries(['item_0', 'item_1', 'item_2', 'item_3', 'item_4', 'item_5', 'item_neutral'].filter(k => player[k] !== undefined).map(k => [k, Object.values(items).find(item => item.id === player[k])?.dname ?? player[k]])));

  // Only compare actual samples; never turn missing values into zeros.
  const samples = (player.times ?? []).map((time, i) => ({ time, gold: player.gold_t?.[i], xp: player.xp_t?.[i], last_hits: player.lh_t?.[i] })).filter(p => Number.isFinite(p.time) && p.time >= 0);
  for (const [name, from, to] of [['rotas', 0, 600], ['transição', 600, 1200], ['meio de jogo', 1200, 1800], ['fim de jogo', 1800, match.duration]]) {
    if (!Number.isFinite(to) || to <= from) continue;
    const window = samples.filter(p => p.time >= from && p.time <= to).sort((a,b) => a.time-b.time);
    const first = window[0], last = window.at(-1);
    if (!first || !last || last.time <= first.time) continue;
    const data = { phase: name, start: first.time, end: last.time, elapsed_seconds: last.time-first.time };
    for (const metric of ['gold', 'xp', 'last_hits']) if (Number.isFinite(first[metric]) && Number.isFinite(last[metric])) {
      data[metric + '_start'] = first[metric]; data[metric + '_end'] = last[metric];
      data[metric + '_delta'] = last[metric]-first[metric];
      data[metric + '_per_minute'] = Math.round(600*(last[metric]-first[metric])/(last.time-first.time))/10;
    }
    add('phase_progress', last.time, data);
  }
  const team = match.players.filter(p => (p.player_slot < 128) === (player.player_slot < 128));
  const teamKills = team.every(p => Number.isFinite(p.kills)) ? team.reduce((n,p) => n+p.kills,0) : null;
  if (teamKills > 0 && Number.isFinite(player.kills) && Number.isFinite(player.assists)) add('team_participation', null, { team_kills: teamKills, kills_and_assists: player.kills+player.assists, participation_pct: Math.round(1000*(player.kills+player.assists)/teamKills)/10, note: 'Participação não mede sozinha qualidade de decisões; considere função, farm e objetivos.' });
  return { evidence, availability };
}

