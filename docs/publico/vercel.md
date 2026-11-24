# Publicação na Vercel

Projeto: `essencecoach`, repositório `eryki-silva/EssenceCoach`, branch `main`.

O diretório `api/index.mjs` adapta a aplicação Node para Vercel Functions. `vercel.json` publica os assets de `public`, encaminha `/api/*` à função e preserva os cabeçalhos de segurança. O build valida a sintaxe. `npm run check` executa a suíte completa antes do envio.

Configure em Production:

- `GEMINI_API_KEY`: chave do servidor, nunca no frontend ou Git.
- A versão pública não exige `APP_ACCESS_PASSWORD`. A variável antiga pode permanecer na Vercel, mas não controla o acesso ao site.
- `APP_ORIGIN`: opcional; padrão `https://essencecoach.vercel.app`. Ajuste se usar domínio próprio.
- `GEMINI_MODEL`: opcional, descoberta automática quando vazio.

As páginas e assets são públicos. A API aceita acesso público, sem login, conforme solicitado. Os limites de frequência e concorrência são locais a cada instância da função e não constituem uma cota global entre instâncias. As análises usam a cota da chave Gemini do servidor. A lista de hosts inclui somente a origem de produção e as URLs de deployment fornecidas pela Vercel. Sem os segredos, a API responde 503 sem expor valores ou detalhes internos.

A versão Vercel consulta OpenDota e gera aulas Gemini. O parser Java, uploads de .dem, reprodução local e rota de farm da partida inteira dependem da instalação Windows ou de um servidor de replay separado. A versão hospedada informa essa limitação em vez de inventar posições ou tentar gravar no filesystem da função. Ela não envia seus arquivos locais para a Vercel.

`.vercelignore` exclui a chave Windows, variáveis locais, replays e runtimes. A pasta de publicação é preparada por uma lista explícita de arquivos; credenciais nunca são copiadas.

Após um push em `main`, acompanhe o deployment no painel da Vercel. Verifique `/api/health`, autenticação e consulta de partida no domínio público. Um health saudável não comprova cota de geração Gemini. Para validar uma aula real, autorize a geração pelo próprio aplicativo.
