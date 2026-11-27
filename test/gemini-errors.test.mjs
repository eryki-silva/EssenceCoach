import test from 'node:test';
import assert from 'node:assert/strict';
import {geminiFailureMessage} from '../backend/shared/gemini-errors.mjs';
import {createService} from '../lib.mjs';
test('motivo Google é classificado sem ecoar mensagem, chave ou metadados externos',async()=>{
 for(const [reason,pattern]of [['API_KEY_INVALID',/inválida/],['API_KEY_HTTP_REFERRER_BLOCKED',/navegador/],['API_KEY_IP_ADDRESS_BLOCKED',/IP/],['SERVICE_DISABLED',/Generative Language/]]){
 const payload={error:{message:'secret-do-not-print',details:[{reason,metadata:{key:'secret-do-not-print'}}]}};
 const safe=geminiFailureMessage(payload);assert.match(safe,pattern);assert(!safe.includes('secret-do-not-print'));
 // Legacy diagnostic text is independently tested; the analysis engine no longer uses this provider.
 }
 assert.match(geminiFailureMessage({error:{message:'API key expired. private-key'}}),/expirou/);assert.equal(geminiFailureMessage({error:{message:'unknown private-key'}}),null);
});
