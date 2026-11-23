export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function connectionError(host, error) {
  const message = String(error?.message ?? '');
  if (/ByteString|invalid header|header.*invalid|Headers.*(convert|character)/i.test(message)) return new AppError('Não foi possível montar o cabeçalho de autenticação. A chave pode conter espaços internos, quebras de linha ou caracteres inválidos. Cole somente o valor original da chave no campo seguro.', 400);
  const codes = [error?.code, error?.cause?.code, ...(error?.cause?.errors ?? []).map(e => e?.code)];
  const hints = [
    [['ENOTFOUND', 'EAI_AGAIN'], 'Falha ao resolver o endereço (DNS). Confira a conexão e a configuração de DNS.'],
    [['CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'ERR_TLS_CERT_ALTNAME_INVALID'], 'Falha de certificado TLS. Confira data/hora do Windows e a configuração de certificados da rede ou do antivírus. Não desative a verificação TLS.'],
    [['UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'ETIMEDOUT'], 'Tempo limite na conexão ou resposta. Verifique conectividade e as regras de firewall ou proxy para este destino.'],
    [['ECONNRESET', 'UND_ERR_SOCKET'], 'A conexão foi interrompida. Verifique a rede, o proxy e as regras de segurança para este destino.'],
    [['ECONNREFUSED'], 'A conexão foi recusada pelo destino ou pelo proxy configurado.']
  ];
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return new AppError(`A solicitação a ${host} excedeu o tempo limite. O serviço pode estar lento; confirme a conexão antes de tentar novamente.`, 504);
  for (const [known, hint] of hints) if (codes.some(code => known.includes(code))) return new AppError(`Não foi possível acessar ${host}. ${hint}`, 502);
  return new AppError(`Não foi possível acessar ${host}. Falha de transporte; confirme a conexão usando curl.exe ou consulte o diagnóstico de rede.`, 502);
}

export function geminiKey(env) {
  const key = (env.GEMINI_API_KEY || env.GOOGLE_API_KEY || '').trim();
  if (!key) throw new AppError('Configure GEMINI_API_KEY no servidor para ativar a análise com Google Gemini. Não envie sua chave pelo chat.', 503);
  if (/[^\x21-\x7e]/.test(key)) throw new AppError('A chave configurada contém espaços internos, quebras de linha ou caracteres inválidos. Informe somente a chave original do Google Gemini, sem aspas ou texto adicional, e reinicie o aplicativo.', 400);
  return key;
}

