import test from 'node:test';
import assert from 'node:assert/strict';
import {publicDataUrl,publicDataFallback} from '../backend/shared/public-transport.mjs';
test('transporte alternativo permite somente dados públicos e remove chave OpenDota',()=>{
 assert.equal(publicDataUrl('https://api.opendota.com/api/matches/9101912991?api_key=private'),'https://api.opendota.com/api/matches/9101912991');
 for(const url of ['https://generativelanguage.googleapis.com/v1beta/models','https://evil.example/api/matches/9101912991','http://api.opendota.com/api/matches/9101912991','https://api.opendota.com/api/request/9101912991','https://user:pass@api.opendota.com/api/matches/9101912991'])assert.equal(publicDataUrl(url),null);
});
test('Windows usa curl com TLS validado, limites e janela oculta sem propagar credenciais',async()=>{
 const response=await publicDataFallback('https://api.opendota.com/api/matches/9101912991?api_key=private',{platform:'win32',runner:async(file,args,options)=>{
 assert.match(file,/curl.exe$/);assert(!args.includes('-k'));assert(!args.includes('--insecure'));assert(!args.includes('--location'));assert(!args.join(' ').includes('private'));assert.equal(options.windowsHide,true);assert(options.timeout<=47000);
 return {stdout:'{"match_id":9101912991}\n200'};
 }});
 assert.equal(response.status,200);assert.equal((await response.json()).match_id,9101912991);
});
test('alternativa não é executada em outras plataformas ou para Gemini',async()=>{
 const runner=()=>{throw Error('must not run');};
 assert.equal(await publicDataFallback('https://generativelanguage.googleapis.com/v1beta/models',{platform:'win32',runner}),null);
 assert.equal(await publicDataFallback('https://api.opendota.com/api/matches/9101912991',{platform:'linux',runner}),null);
});
