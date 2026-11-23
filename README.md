# EssenceCoach

Publicação Vercel: [configuração e limitações](docs/publico/vercel.md).

O aplicativo consulta models.list com a chave configurada e seleciona um Gemini Flash de texto disponível. GEMINI_MODEL é uma preferência: se não estiver no catálogo, será usado outro Flash. O teste mostra o modelo escolhido; disponibilidade no catálogo não garante cota gratuita nem sucesso de geração.

# Google Gemini — configuração atual

Abra INICIAR-WINDOWS.cmd, cole a chave completa do Google AI Studio na janela protegida e clique em Iniciar aplicativo. Com Lembrar marcado, a chave fica salva criptografada para o usuario atual do Windows. O botão Testar conexão Gemini consulta o modelo sem gerar conteúdo; isso não garante cota para análise. O modelo é escolhido no catálogo da API. A integração anterior com OpenAI foi substituída.

# Ancient · Dota Replay Coach

Aplicação local para consultar partidas de Dota 2 pelo ID e receber um relatório em português com Google Gemini. O projeto original na raiz foi preservado.

## Executar

**Windows:** extraia o ZIP e abra `INICIAR-WINDOWS.cmd`. Com Node.js 24.5+ instalado, ele solicita a chave de forma oculta, inicia o servidor e abre o navegador. Na primeira abertura, deixe Lembrar marcado para salvar a chave criptografada. Nas proximas aberturas, ela sera reutilizada automaticamente, sem gravar `.env` ou incluir a chave no codigo. O iniciador abre uma janela protegida para receber a chave do Google.

O iniciador verifica instalações compatíveis no PATH e nos diretórios comuns do instalador oficial, NVM e Volta. Se o Windows ainda estiver usando o PATH anterior à instalação, ele tenta usar o executável encontrado diretamente. Se continuar sem localizar sua instalação, abra um **novo PowerShell**, execute `node -v` e `where.exe node` e confira qual versão/caminho está ativo. Uma instalação fora desses diretórios pode precisar ser adicionada ao PATH.

Requer **Node.js 24.5 ou mais recente**. Não há pacotes externos ou etapa de build.

```sh
cd /workspace/projeto-tcc/dota-coach
cp .env.example .env
# Edite .env localmente e defina GEMINI_API_KEY.
npm start
```

O servidor escuta apenas na interface local, porta 3000 (ou `PORT`). Use seu navegador local na porta configurada. A interface permite consultar a partida sem chave Google Gemini; a geração de relatórios exige uma chave válida e cota. Use GEMINI_MODEL para indicar um modelo preferido com suporte a generateContent e JSON estruturado. Não há fallback com relatório inventado.

O Node usa o proxy e a confiança TLS já configurados no ambiente (`--use-env-proxy`). Não desative validação de certificados. A chave fica no servidor, nunca no JavaScript da página. `.env` é ignorado pelo Git. Também é aceito `GOOGLE_API_KEY` quando já fornecido por outro ambiente.

## Usar

1. Informe o ID da partida (Dota 2 → histórico → detalhes).
2. Para analisar **qualquer jogador**, informe o nome completo do herói (por exemplo `Axe` ou `Anti-Mage`); ele tem prioridade sobre o perfil. Alternativamente informe um SteamID64, ID OpenDota ou link público `steamcommunity.com/profiles/...`. Seu perfil está preenchido por conveniência, mas pode ser trocado ou apagado. Sem identificação, escolha qualquer jogador entre os dez participantes; também é possível trocar a seleção antes de gerar uma nova análise. Jogadores anonimizados podem ser selecionados pelo herói.
3. Se faltarem eventos detalhados, solicite processamento do replay. Aguarde e use **Atualizar**; o OpenDota pode levar minutos e replays antigos podem ter expirado. A solicitação não garante sucesso e não precisa ser repetida continuamente.
4. Escolha um foco, autorize o envio dos dados ao Google Gemini e gere a análise. Cada chamada consome cota da chave configurada.
5. Consulte evidências, recomendações, nível de certeza e plano de treino; exporte Markdown ou JSON.

Os dados públicos e eventos processados vêm do OpenDota. É possível habilitar **Expose Public Match Data** nas opções sociais do Dota e vincular sua conta ao OpenDota; partidas privadas, não indexadas ou replays expirados podem continuar indisponíveis. `OPENDOTA_API_KEY` é opcional e pode aumentar a cota conforme seu plano.

## O que é e o que não é analisado

- Estatísticas, evolução de ouro/XP/last hits, compras, abates, buybacks, wards, runas, objetivos e lutas quando esses campos existem na resposta. A cobertura aparece no relatório.
- Além dos eventos da API OpenDota, o aplicativo agora pode baixar ou receber um arquivo `.dem` e processá-lo localmente com o parser aberto do OpenDota (Java 21 portátil). Um ID não garante acesso a cada ação, comandos, câmera, comunicação, posições contínuas ou visão completa. Não há análise quadro a quadro nem promessa de identificar todos os erros.
- A IA recebe apenas o jogador selecionado e evidências numeradas. O backend valida o esquema, os IDs e os timestamps citados; isso evita referências inexistentes, mas não prova que a interpretação da IA está correta. Recomendações continuam sujeitas a revisão humana.
- Nomes, chat e ID de conta não são enviados ao Google Gemini. São enviados o ID da partida, estatísticas/eventos do jogador, foco informado e contexto de patch/meta. Não coloque informações sensíveis no foco. No plano gratuito do Gemini, os dados enviados podem ser usados pelo Google para melhorar seus produtos. Consulte as condições do Google AI Studio. Os textos gerados não são salvos automaticamente. Replays completos processados geram arquivos locais em `.replays/`, contendo posições e eventos selecionados sem chat ou IDs de conta; o arquivo bruto recebido é apagado após o processamento. Consultas externas ficam em cache de memória por até 5 minutos (catálogo de heróis por 1 hora; partida por 30 segundos).

## Patch e meta

Cada análise consulta o catálogo comunitário `odota/dotaconstants`, estatísticas agregadas de heróis, benchmarks e popularidade de itens do OpenDota, além das notícias oficiais de Dota 2 pelo Steam. Fontes e horários de consulta são exibidos; indisponibilidade de uma fonte gera um aviso.

**O catálogo pode atrasar e não incluir subpatches.** O app distingue patch da partida e versão mais recente conhecida no catálogo. Não confirma automaticamente que essa versão é o patch vigente, e as estatísticas agregadas não têm janela temporal garantida. Notícias oficiais fornecem contexto recente, mas não são um banco completo de regras de habilidades/itens. Assim, o app não deve ser tratado como confirmação de meta exato do patch atual. A IA é instruída a explicitar essas limitações e não condenar decisões antigas com regras posteriores.

## Rede e segurança

Destinos HTTPS necessários:

- `api.opendota.com`: partida, processamento e estatísticas;
- `raw.githubusercontent.com`: heróis, itens e patches;
- `api.steampowered.com`: notícias oficiais;
- `generativelanguage.googleapis.com`: análise.

Configure a chave localmente na janela protegida. Nunca envie chaves pelo chat.

Este servidor é **para uso individual local**: possui validação de entradas, limites por minuto, limite de duas análises simultâneas, proteção de origem/Host, CSP e escape de texto na interface. Não publique na Internet sem autenticação, TLS, cotas por usuário e revisão de infraestrutura. O app não serve arquivos `.env` ou código do servidor. As mensagens de erro não repassam respostas externas que possam conter dados sensíveis.

## Validação

```sh
npm test
```

Os testes usam APIs simuladas, explicitamente; não consomem créditos. Exercitam seleção de jogador, SteamID64, eventos, dados ausentes, esquema/evidências, requisição Google Gemini, falhas de rede/chave, consentimento, rotas e segurança HTTP. A validação real de uma partida exige rede liberada e chave com cota; não é substituída pelos mocks. A interface também pode ser testada em DOM; renderização visual em navegador exige um navegador disponível.



## Patches oficiais e campeonatos
Cada análise consulta o catálogo público de dota2.com e tenta carregar notas do patch atual e do patch estimado pela data da partida. Notas grandes podem ser truncadas, explicitamente. A fonte é pública e pode mudar de formato. Também consulta até oito partidas profissionais recentes do OpenDota, nos últimos 14 dias e após a publicação do patch atual quando conhecida. Mostra campeonatos, amostra, picks/bans e exemplos do herói com inventário e compras quando disponíveis. Isso não é cobertura completa dos campeonatos, nem opinião declarada dos profissionais. Falhas aparecem nos avisos e não interrompem o coaching. Requer acesso HTTPS a www.dota2.com. Cache de cinco minutos.

Mapa de calor: imagem local real da base 7.40 do OpenDota (public/assets/images/dota2/map/detailed_740.webp no repositório odota/web). Transformação das células segue utility.tsx e Heatmap.tsx do OpenDota: x−64, 191−y e escala largura/127. Terreno de patches diferentes pode divergir. Controle de opacidade e alternância de terreno permitem examinar posições sem esconder o mapa.


## Relatório em PDF
Depois de gerar a análise, clique em Salvar relatório em PDF e escolha Salvar como PDF na impressão do navegador. O layout A4 usa fundo branco e inclui resumo, recomendações, regras para a próxima partida, verificações no replay, treino, contexto e fontes. Os blocos JSON e controles do aplicativo ficam fora da impressão. Não exige instalação adicional nem nova chamada à IA.

## Comparações específicas do herói (28/10/2026)

O relatório inclui uma amostra de até seis partidas recentes do herói, obtidas no OpenDota e filtradas localmente pelos últimos 14 dias, patch numérico, modo, lobby, rota e faixa média de rank quando conhecida. Mostra IDs, datas, denominadores, logs disponíveis, builds de exemplo, habilidades por nível e identificadores de facets. As compras reais são ligadas aos IDs de evidência e comparadas à mediana, mínimo e máximo da primeira compra registrada por referência. Compras repetidas não aumentam a amostra. Markdown e JSON incluem as comparações; PDF inclui a seção visível.

A rota não resolve posições 1/5 ou 3/4. O rank é a média da partida, quando disponível, e nunca é apresentado como rank individual. Sem rota, patch, modo ou lobby conhecidos não há amostra comparável. Jogos históricos podem não ter referências recentes do mesmo patch. Subpatches não são garantidos. As estatísticas de rank do heroStats não possuem recorte por posição nem janela documentada. Dados ausentes não viram zero. Medianas condicionadas à compra não são metas ou prova de erro. Esta amostra pequena não estabelece build ótima.

Regras atuais de habilidades, talentos e facets são consultadas no datafeed público da Valve por hero_id. O catálogo comunitário fornece informações dos itens comprados ou presentes na amostra. As regras atuais são separadas do patch histórico; facets vazias ou serviços indisponíveis são apresentados sem inventar efeitos. As sequências por nível não fornecem horário de aprendizado.

Integrações verificadas em 28/10/2026:
- Dota2ProTracker: https://dota2protracker.com/ — páginas públicas disponíveis, população declarada 7000+ MMR/profissionais. A tentativa de consultar /api/hero/1/builds não foi validada. A integração oferece links por herói e declara referência manual; não importa builds nem promete API suportada.
- Dotabuff: https://www.dotabuff.com/pages/faq — FAQ pública consultada; funções/rotas dependem de TrueSight e eventos detalhados podem faltar. Não foi confirmada uma API pública documentada para esta integração. Links por herói para consulta manual, sem scraping ou bypass.

Destinos adicionais: www.dota2.com para regras atuais; Dota2ProTracker e Dotabuff somente quando o usuário abre os links. Consultas OpenDota adicionais usam cache de cinco minutos, timeout de oito segundos e lotes de dois. Datas das referências são datas das partidas; a hora de consulta ao cache não garante hora de atualização da fonte. Falhas externas não interrompem o relatório e aparecem como avisos.


## Lembrar ou trocar a chave no Windows

Abra INICIAR-WINDOWS.cmd e informe sua chave uma vez com **Lembrar minha chave neste Windows** marcado. O iniciador salva `.gemini-key.windows` usando a protecao DPAPI do Windows (ConvertFrom-SecureString sem chave adicional), vinculada ao usuario e computador atuais. O arquivo e ignorado pelo Git e nao e servido pelo aplicativo. Copiar o projeto para outro usuario/computador pode exigir informar a chave novamente.

Para trocar a chave, abra **TROCAR-CHAVE.cmd**. Para esquecer a chave, abra esse mesmo iniciador, informe a chave que deseja usar e desmarque Lembrar: a copia salva sera removida e a chave sera usada somente nessa sessao. Excluir `.gemini-key.windows` tambem remove a copia salva. A chave descriptografada permanece apenas na memoria e no ambiente do processo durante a execucao.

Validacao especifica: `powershell -NoProfile -File test/windows-key.ps1` verifica sintaxe e criptografia/descriptografia DPAPI com uma chave ficticia, sem acessar a chave do usuario.

## Revisão prática antes do meta

O relatório prioriza até três tarefas calculadas a partir das evidências: luta com morte registrada e saldo de ouro/dano/cura quando disponíveis; queda do ritmo de XP entre fases consecutivas de pelo menos três minutos; compra seguida de luta em até três minutos. Cada tarefa mostra números, intervalo para assistir, ação condicional, exercício mensurável e IDs de eventos. Não depende de haver partidas comparáveis de meta. Para Chen, há orientação de revisão das unidades controladas, explicitamente sem alegar erro de micro observado. Proximidade de objetivo não determina quem ganhou nem relação causal.

Descrições brutas de habilidades, placeholders, seções 0/0, torneios sem exemplos do herói e listas extensas saíram da leitura principal. Referências, datas, dados brutos e limitações continuam disponíveis em detalhes recolhidos. O Markdown inclui as tarefas; o PDF inclui os cartões visíveis. A IA recebe a revisão calculada para interpretar os eventos. Achados sem número, momento ou compra das evidências citadas são omitidos; esse filtro é uma verificação básica de ancoragem e não valida causalidade. O texto de patch exibido é factual e montado pelo aplicativo, sem afirmações de buffs/nerfs geradas pela IA.

Os testes de revisão usam eventos sintéticos para conferir cálculos, IDs, ausência de dados, limites temporais e ausência de causas inventadas. Um teste de DOM verifica a ordem das seções, o contexto recolhido, exportação e remoção de descrições/contagens vazias da prosa. Não equivale a um teste visual de navegador nem à análise real da partida do usuário.

## Aula do coach

O formato principal agora é uma aula: uma leitura inicial, um plano para conduzir o jogo e de uma a três explicações em prosa. Cada aula conecta um exemplo documentado a um princípio do herói, demonstra como o professor jogaria a situação e explica quando escolher outro caminho. O objetivo inclui ensinar decisões boas e raciocínio, além de corrigir erros. A prática aparece ao final, vinculada às ideias ensinadas.

O contrato da IA exige game_plan e lessons com teaching, application, exception, evidence_ids e time. O servidor rejeita aulas sem explicação/aplicação, IDs inexistentes ou horários sem evidência correspondente. Essa validação comprova estrutura e referências, não a qualidade pedagógica ou veracidade de toda interpretação. A geração ainda depende do Gemini e dos dados disponíveis.

O índice automático de eventos fica recolhido no contexto e não é usado como texto de aula. A IA recebe somente as observações desse índice, sem suas recomendações padronizadas. A interface e os exports apresentam o texto do professor com parágrafos completos, sem cartões repetitivos de erro/prioridade/métrica. A chave protegida e os iniciadores Windows permanecem inalterados nesta revisão.


## Replay completo e mapa temporal

O processamento completo foi integrado ao app: busque a partida, escolha o jogador e use **Buscar replay da Valve** ou envie o arquivo `.dem`, `.dem.bz2` ou `.dem.zst` da mesma partida. A leitura ocorre em processo Java separado, com uma tarefa por vez, limite de 512 MB de entrada, heap de 2 GB e timeout de dez minutos. O ID gravado no replay deve coincidir com o solicitado; arquivos incompletos são recusados. Replays expirados na Valve podem exigir o arquivo local.

Neste computador, o leitor já foi instalado e validado. Em outro Windows, execute **INSTALAR-REPLAY.cmd** uma vez. A instalação baixa Java 21 portátil da Eclipse Adoptium, Maven 3.9.12 do Maven Central e o fonte do parser OpenDota, compila o adaptador local e registra a revisão em `.runtime/parser.json`. Java e Maven são verificados por checksums publicados. A confiança TLS usa os certificados do Windows, sem desativar validação. Nenhuma instalação do sistema ou chave Gemini é alterada. Fontes de terceiros e licença MIT ficam em `.runtime/source/`.

O adaptador Java recebe o replay por stdin e entrega NDJSON por stdout, sem abrir servidor HTTP. Eventos de chat, cosméticos e identidades não entram no resultado armazenado ou enviado à IA. A saída sanitizada fica em `.replays/` e sobrevive ao reinício do app. A pasta é ignorada pelo Git e não é servida como diretório público. A resposta local da API de replay contém os eventos filtrados; este continua sendo um servidor individual em localhost.

O mapa oferece relógio, reprodução em 1×/2×/4×/8×, barra de tempo, seleção do jogador, trilha dos últimos 20 segundos e atalhos para mortes/smokes. Lacunas maiores que dois segundos não são preenchidas com posições inventadas. A aula recebe até doze contextos de decisões distribuídos por fases: posições anteriores, heróis vivos próximos, distâncias geométricas e eventos ao redor do momento. Cada contexto ganha um ID de evidência. Aulas com horário podem abrir o lance no mapa.

Limites: posições são do observador, não representam fog of war. A versão atual lê vida, mana, inventário, recargas e posições observadas de creeps, torres e wards. Não reconstrói fog of war, câmera ou ordens de micro; unidades controladas só aparecem quando o dono é identificado. O terreno local é a base 7.40 e pode divergir do patch do replay. Portanto ainda não é equivalência completa à AstinIA e não comprova qualidade superior.

Validação real realizada: replay público de teste OpenDota 1781962623 (23.086 posições, dez jogadores, 5.106 eventos) e replay público recente 9101771071 (42.230 posições, dez jogadores, 23.460 eventos). O segundo também foi conferido no mapa do navegador; o primeiro passou pelo upload HTTP completo, job e leitura de resultado. Nenhuma chamada Gemini foi feita nessa validação. Os testes automatizados verificam identidade, privacidade dos eventos, slots, amostras antigas, contexto espacial, contratos da IA, upload, origem e limites.


## Estado da partida para a aula (parser v3)

O professor recebe mais que posições: vida/mana e seus máximos, habilidades aprendidas, recargas restantes, custos de mana e inventário amostrados a cada 2 segundos. O mundo é observado a cada 6 segundos: creeps de rota, torres vivas, wards e creeps com dono identificável. Wards não são classificadas como creeps controlados. Os contextos de ensino incluem ações bem-sucedidas e habilidades do jogador, além de mortes, distribuídos pela partida. O responsável e o alvo de cada evento são explícitos.

Para cada contexto, o backend usa somente amostras anteriores ao evento: até 3 segundos para recursos e 6 segundos para o mundo. Custo/recarga indisponíveis ficam ausentes, nunca viram zero. Mana suficiente é calculada somente quando custo e mana existem. Cooldown zerado não significa que o jogador podia usar a habilidade: silêncio, stun, alvo, alcance, cargas, passivas e outras restrições precisam ser considerados. Itens fora dos seis slots principais não são tratados como disponíveis na mão. A máscara bruta de visibilidade, quando existe, não é interpretada nem enviada como conhecimento do jogador.

O campo de rede m_fCooldown foi conferido em usos reais da partida 9101771071: ele já é uma duração restante, não um timestamp absoluto. Echo Slash foi usado aos 80s; a recarga registrada foi 20,8s aos 81s, 18,8s aos 83s e 16,8s aos 85s. Essa verificação tem teste automatizado com a fixture real opcional `.runtime/replay-v3.json`, sem chamar Gemini. O replay forneceu 21.120 estados detalhados e 704 snapshots do mundo.

A interface permite ligar creeps/torres/wards no mapa e abrir Recursos neste momento para conferir vida, mana, inventário e recargas da amostra. Replays antigos processados somente com posições precisam ser reprocessados. Neste computador, o leitor já foi recompilado; em outra instalação, execute INSTALAR-REPLAY.cmd. Para recompilar o fonte instalado sem consultar downloads: `powershell -NoProfile -ExecutionPolicy Bypass -File setup-replay.ps1 -RebuildOnly`.

Os estados usam um catálogo compartilhado de recursos para evitar repetir os mesmos nomes e atributos em cada segundo. O replay real passou de cerca de 110 MB na representação expandida para cerca de 23 MB na representação compacta; a API negocia gzip para o navegador. Esses recursos não incluem treinamento com material privado de terceiros e não comprovam que a qualidade pedagógica já iguala a de um coach humano.

## Estúdio Ancient 1.1

Interface com cenário cinematográfico local, tons midnight purple, navegação para o estúdio e guia em `/guide`. O código está organizado em módulos por funcionalidade, mantendo os iniciadores Windows e as importações antigas compatíveis.

- Verificar tudo: `npm run check` (sintaxe e testes).
- [Arquitetura](docs/publico/arquitetura.md)
- [API](docs/publico/api.md)
- [Configuração e produção](docs/publico/deploy.md)

A chave salva permanece privada no servidor. A versão da aplicação vem de `package.json` e está disponível em `/api/health`.
