import {assets} from './config/assets.mjs';
import {loadSettings,system} from './config/settings.mjs';
import {createLogger} from './shared/logger.mjs';
import {securityHeaders,sendJson,passwordAccepted} from './shared/http.mjs';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { gzip as gzipCallback } from 'node:zlib';
import { promisify } from 'node:util';
import { AppError, createService, matchId } from '../lib.mjs';
import { ReplayError } from './features/replays/data.mjs';

const publicRoot = new URL('../public/', import.meta.url);
const gzip=promisify(gzipCallback);

async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new AppError('Envie JSON.', 415);
  // Vercel may provide an already-buffered body; local Node keeps the stream.
  if(Object.hasOwn(req,'body')&&req.body!==undefined){
    let raw;try{raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);}catch{throw new AppError('JSON inválido.');}
    if(Buffer.byteLength(raw)>8192)throw new AppError('Solicitação muito grande.',413);
    try{return JSON.parse(raw);}catch{throw new AppError('JSON inválido.');}
  }
  let content = '';
  for await (const chunk of req) {
    content += chunk;
    if (Buffer.byteLength(content) > 8192) throw new AppError('Solicitação muito grande.', 413);
  }
  try { return JSON.parse(content); } catch { throw new AppError('JSON inválido.'); }
}

export function createApp(service = createService(), settings=loadSettings()) {
  const logger=createLogger({level:settings.logLevel});
  const limits = new Map();
  let analysesInProgress = 0;
  return http.createServer(async (req, res) => {
    const headers = securityHeaders(settings.production);
    const started=performance.now();let actionName='page';
    res.once('finish',()=>logger.info('http_request',{action:actionName,status:res.statusCode,duration_ms:Math.round(performance.now()-started)}));
    const json=(value,status=200)=>sendJson(res,value,status,headers);
    try {
      const url = new URL(req.url, 'http://localhost');
      const host = req.headers.host ?? '';
      const publicOrigin='https://'+host;
      const expectedOrigin=settings.production?publicOrigin:'http://'+host;
      const hostAllowed=settings.production?(settings.allowedOrigins??[settings.origin]).includes(publicOrigin):/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
      if(!hostAllowed)throw new AppError('Host não autorizado.',403);
      if(req.headers.origin&&req.headers.origin!==expectedOrigin)throw new AppError('Origem não autorizada.',403);
      if(settings.production&&!settings.publicAccess&&url.pathname!=='/api/health'&&!passwordAccepted(req.headers.authorization,settings.accessPassword)) {
        headers['WWW-Authenticate']='Basic realm="Ancient Dota Coach", charset="UTF-8"';return json({error:'Entre com o usuário coach e a senha configurada para acessar.'},401);
      }
      if (req.headers['sec-fetch-site'] === 'cross-site') throw new AppError('Solicitação externa bloqueada.', 403);
      if (req.method === 'GET' && assets[url.pathname]) {
        const [name, type] = assets[url.pathname];
        const data = await readFile(new URL(name, publicRoot));
        res.writeHead(200, { ...headers, 'Content-Type': type }); res.end(data); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/health') return json({ ok: true, system:system.name, version:system.version, mode:settings.mode, analysis_engine:'deterministic', analysis_available:true, gemini_configured:false });
      if (req.method === 'POST' && url.pathname === '/api/gemini/check') {
        await body(req);
        const bucket = `${req.socket.remoteAddress}:openai-check`;
        const previous = limits.get(bucket);
        if (previous && Date.now() < previous.reset) throw new AppError('Aguarde 30 segundos antes de repetir o teste.', 429);
        limits.set(bucket, { reset: Date.now() + 30000 });
        return json(await service.checkGemini());
      }
      const route = url.pathname.match(/^\/api\/matches\/(\d+)(?:\/(parse|analyze|replay|replay-upload|replay-data))?$/);
      if (!route) throw new AppError('Rota não encontrada.', 404);
      const id = matchId(route[1]), action = route[2];
      actionName=action||'match';
      const bucket = `${req.socket.remoteAddress}:${action ?? 'read'}`;
      const entry = limits.get(bucket) ?? { count: 0, reset: Date.now() + 60_000 };
      if (Date.now() > entry.reset) { entry.count = 0; entry.reset = Date.now() + 60_000; }
      entry.count++; limits.set(bucket, entry);
      if (entry.count > (req.method==='GET' ? 60 : 6)) throw new AppError('Muitas solicitações. Aguarde um minuto.', 429);
      if (action==='replay'&&req.method==='GET')return json(await service.replayStatus(id));
      if (action==='replay-data'&&req.method==='GET') {
        const data=await service.replayData(id);if(!data)throw new AppError('Replay ainda não processado.',404);
        const acceptsGzip=(req.headers['accept-encoding']??'').split(',').some(s=>{const [name,...params]=s.trim().split(';');return name==='gzip'&&!params.some(p=>/^q=0(?:\.0*)?$/.test(p.trim()));});
        if(acceptsGzip){const compressed=await gzip(JSON.stringify(data));res.writeHead(200,{...headers,'Content-Type':'application/json; charset=utf-8','Content-Encoding':'gzip','Vary':'Accept-Encoding'});res.end(compressed);return;}
        return json(data);
      }
      if (action==='replay'&&req.method==='POST'){await body(req);return json(await service.replayDownload(id),202);}
      if (action==='replay-upload'&&req.method==='POST') {
        if(req.headers['content-type']!=='application/octet-stream')throw new AppError('Envie o arquivo de replay em formato binário.',415);
        if(Number(req.headers['content-length'])>512*1024*1024)throw new AppError('Replay maior que 512 MB.',413);
        return json(await service.replayUpload(id,req),202);
      }
      if (req.method === 'GET' && !action) return json(await service.matchView(id, url.searchParams.get('account'), url.searchParams.get('hero') ?? ''));
      if (req.method === 'POST' && action === 'parse') { await body(req); return json(await service.parse(id), 202); }
      if (req.method === 'POST' && action === 'analyze') {
        const input = await body(req);
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('Corpo inválido.');
        if (typeof input.focus !== 'undefined' && (typeof input.focus !== 'string' || input.focus.length > 600)) throw new AppError('O foco deve ter até 600 caracteres.');

        if (analysesInProgress >= 2) throw new AppError('Há análises em andamento. Aguarde.', 429);
        analysesInProgress++;
        try { return json(await service.analyze(id, input.player_slot, input.focus)); }
        finally { analysesInProgress--; }
      }
      throw new AppError('Método não permitido.', 405);
    } catch (error) {
      const expected=error instanceof AppError||error instanceof ReplayError;
      if(!expected)logger.error('http_failure',{action:actionName,code:'INTERNAL_ERROR'});
      json({ error: expected ? error.message : 'Falha interna. Tente novamente.' }, expected ? error.status : 500);
    }
  });
}

