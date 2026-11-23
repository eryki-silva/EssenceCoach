# Execução e produção

## Windows local

Abra `INICIAR-WINDOWS.cmd` como antes. O iniciador e a chave local salva foram preservados. Para atualizar o visual de um servidor já aberto, encerre sua janela, inicie novamente e pressione Ctrl+F5 no navegador.

## Configuração

Use `.env.example` como referência. Não substitua um `.env` existente nem copie a chave para o frontend. Node >=24.5 é necessário. O parser depende adicionalmente do runtime Java e do adaptador instalados pelo procedimento existente.

- `DOTA_ENV`: local, test ou production.
- `PORT`: 3000 por padrão.
- `HOST`: 127.0.0.1 local; em produção configure a interface do serviço.
- `APP_ORIGIN`: origem HTTPS pública, sem caminho.
- `APP_ACCESS_PASSWORD`: senha individual de pelo menos 16 caracteres em produção.
- `GEMINI_API_KEY` ou `GOOGLE_API_KEY`: credencial do servidor.
- `LOG_LEVEL`: debug, info, warn, error ou silent.
- `REQUEST_TIMEOUT_MS`, `EXTERNAL_TIMEOUT_MS`, `CACHE_TTL_MS`: limites validados na inicialização.

Execute `npm run check` antes de publicar. Depois inicie com `npm start`. A configuração de produção falha antes de abrir a porta se os requisitos obrigatórios estiverem ausentes.

## Hospedagem

A interface precisa do backend Node; hospedagem apenas de arquivos estáticos não executa as análises. Uma plataforma deve suportar processo Node persistente, HTTPS, segredos e requisições longas. Para parser local, também precisa de Java, memória, disco e execução de processos. Planos gratuitos podem não oferecer esses recursos; sua disponibilidade precisa ser conferida no provedor escolhido.

Configure os valores de ambiente no painel do servidor. Use `DOTA_ENV=production`, sua origem HTTPS e senha forte. A credencial Windows protegida pertence ao seu computador: configure uma credencial separadamente no servidor. Entre no site com usuário `coach` e a senha definida.

Atrás de Nginx ou outro proxy, preserve o cabeçalho Host do domínio público, encaminhe ao processo Node em loopback, habilite TLS, limite upload a 512 MB e use timeout de leitura de pelo menos 180 segundos. Não exponha `.env`, `.runtime`, `.replays` ou a pasta do projeto como conteúdo estático. Os assets públicos são servidos pelo próprio Node.

Após iniciar, confirme `/api/health`, acesso protegido, consulta de partida e uma análise autorizada. O modo production pode ser testado localmente por teste HTTP automatizado, mas não substitui teste no domínio real. Nenhum deploy público foi executado nesta alteração.

Não há instalador Linux completo do parser nem pipeline automático de publicação neste pacote. Preserve o setup Windows validado; em outro sistema, instale e valide o adaptador antes de anunciar suporte ao processamento de replay. A consulta OpenDota e a aula com dados públicos continuam separadas do parser local.
