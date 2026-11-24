// Return only fixed messages. Never forward Google's raw body, metadata or key.
export function geminiFailureMessage(payload){
 const error=payload?.error;
 const reasons=new Set((Array.isArray(error?.details)?error.details:[]).map(d=>d?.reason));
 const message=typeof error?.message==='string'?error.message:'';
 if(/API key expired/i.test(message))return 'O Google informou que a chave Gemini expirou. Substitua GEMINI_API_KEY por uma chave ativa do Google AI Studio e reaplique o deploy.';
 if(reasons.has('API_KEY_INVALID')||/API key not valid/i.test(message))return 'O Google informou API_KEY_INVALID: a chave Gemini aplicada neste deploy é inválida. Copie a chave completa e ativa do Google AI Studio para o Value de GEMINI_API_KEY em Production.';
 if(reasons.has('API_KEY_HTTP_REFERRER_BLOCKED'))return 'A chave Gemini está restrita a sites no navegador e foi bloqueada na chamada do servidor. Confira as restrições da chave no Google Cloud.';
 if(reasons.has('API_KEY_IP_ADDRESS_BLOCKED'))return 'As restrições de IP da chave Gemini bloquearam o servidor da Vercel. Confira os IPs autorizados no Google Cloud.';
 if(reasons.has('API_KEY_SERVICE_BLOCKED')||reasons.has('SERVICE_DISABLED'))return 'A chave ou o projeto não está autorizado a usar a Generative Language API. Confira a API habilitada e as restrições no Google Cloud.';
 return null;
}
