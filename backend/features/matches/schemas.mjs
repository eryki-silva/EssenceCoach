import {AppError} from '../../shared/errors.mjs';
export function matchId(value) {
  if (!/^[1-9]\d{5,11}$/.test(String(value ?? ''))) throw new AppError('Informe um ID de partida válido (6 a 12 dígitos).');
  return String(value);
}

export function accountId(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const profile = raw.match(/^https:\/\/steamcommunity\.com\/profiles\/(\d{17})\/?$/);
  const text = profile ? profile[1] : raw;
  if (!/^\d{1,17}$/.test(text)) throw new AppError('Use o SteamID64 numérico ou o ID de jogador do OpenDota.');
  const id = BigInt(text);
  const account = id >= 76561197960265728n ? id - 76561197960265728n : id;
  if (account < 1n || account > 4294967295n) throw new AppError('ID de jogador fora do intervalo válido.');
  return Number(account);
}

