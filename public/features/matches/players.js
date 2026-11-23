import {$,el} from '../../core/dom.js';
import {state} from '../../core/state.js';
import {setBusy} from '../../core/ui.js';
import {drawFullReplay} from '../replays/controller.js';
export function renderPlayers() {
  const parent = $('players'); parent.replaceChildren();
  const teams = {};
  for (const team of ['Radiant','Dire']) {
    const group=el('section','team-group team-'+team.toLowerCase());
    const header=el('div','team-header');
    const won=typeof state.match.radiant_win==='boolean' && ((team==='Radiant')===state.match.radiant_win);
    const members=state.match.players.filter(p=>p.team===team);
    const score=members.every(p=>Number.isFinite(p.kills))?members.reduce((n,p)=>n+p.kills,0):'—';
    header.append(el('h3','',team),el('span','',score+' abates'+(won?' · VITÓRIA':'')));
    const roster=el('div','team-roster');group.append(header,roster);parent.append(group);teams[team]=roster;
  }
  for (const player of [...state.match.players].sort((a,b)=>a.player_slot-b.player_slot)) {
    const button = el('button', `player${state.slot === player.player_slot ? ' selected' : ''}`);
    button.type = 'button'; button.setAttribute('aria-pressed', String(state.slot === player.player_slot));
    const portrait = el('div', 'hero-portrait');
    portrait.append(el('span', 'hero-initials', player.hero.slice(0, 2).toUpperCase()));
    if (player.hero_image && player.hero_image.startsWith('https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/')) {
      const image = el('img'); image.src = player.hero_image; image.alt = player.hero; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
      image.addEventListener('error', () => image.remove()); portrait.append(image);
    }
    const heading = el('div', 'player-heading');
    heading.append(el('small', player.team === 'Dire' ? 'team-dire' : 'team-radiant', player.team), el('strong', '', player.hero), el('small', 'player-name', player.name));
    const top = el('div', 'player-top'); top.append(portrait, heading); button.append(top);
    const number = value => Number.isFinite(value) ? value.toLocaleString('pt-BR') : '—';
    const stats = el('div', 'player-stats');
    const kda = [player.kills, player.deaths, player.assists].map(number).join(' / ');
    for (const [label, value] of [['K / D / A', kda], ['Ouro/min', number(player.gold_per_min)], ['XP/min', number(player.xp_per_min)], ['Últimos golpes', number(player.last_hits)], ['Nível', number(player.level)], ['Dano em heróis', number(player.hero_damage)]]) {
      const metric = el('span', 'player-stat'); metric.append(el('b', '', value), el('small', '', label)); stats.append(metric);
    }
    button.append(stats);
    button.disabled = state.busy;
    button.addEventListener('click', () => {
      if (state.busy) return;
      state.slot = player.player_slot; state.report = null; $('report').hidden = true;
      renderPlayers(); setBusy(false);
    });
    teams[player.team].append(button);
  }
  drawFullReplay();
}
