# Arquitetura

O projeto mantém Node.js e JavaScript nativo. O template Flask/React foi usado como referência de organização, sem adicionar uma migração de linguagem nem banco de dados.

- `backend/app.mjs`: factory HTTP, rotas, limites de solicitação e políticas de acesso.
- `backend/config`: configuração validada, versão central e lista explícita de recursos públicos.
- `backend/features/matches`: validação de partidas, evidências e mapa de calor.
- `backend/features/coaching`: integração Gemini, prompt, schema e revisão didática.
- `backend/features/meta`: regras dos heróis e contexto competitivo.
- `backend/features/replays`: arquivo, extração e tarefas do parser.
- `backend/shared`: erros, respostas HTTP, logs e formatadores.
- `public/core`: estado, DOM e cliente HTTP com timeout.
- `public/features`: partidas, aula e visualizador de replay em módulos ES.
- `public/styles`: componentes e identidade visual do estúdio.
- `test`: testes de domínio, HTTP, configuração, renderização e replay.

Os módulos na raiz são fachadas de compatibilidade. `launch.mjs` e os iniciadores Windows mantêm os caminhos existentes. A versão vem apenas de `package.json` e aparece no health e no rodapé.

A chave persistida no Windows usa o mecanismo local existente. Nunca é incluída nos módulos do navegador. Logs estruturados aceitam somente campos técnicos permitidos; não incluem cabeçalhos, chave, foco escrito ou corpo da análise.

As tarefas de replay são locais, os arquivos têm limites e a amostragem tem lacunas. O sistema não possui contas, armazenamento distribuído nem fila persistente. Não execute múltiplas instâncias compartilhando a mesma pasta de replay.

## Verificação

Use `npm run check`: valida sintaxe dos módulos e executa a suíte de testes. GitHub Actions executa o mesmo comando com Node 24. O teste com replay real é opcional quando a fixture local não está presente. Validação visual manual é independente da suíte Node.

ESLint e Prettier não foram instalados neste ambiente devido à falha de validação do certificado do registro npm. A verificação atual não deve ser confundida com lint ou validação automática de formatação.

## Rota de farm no resultado

A resposta de análise inclui `farm_route` com trajetória temporal do jogador escolhido. Quando disponível, contém `source`, `player_slot`, `duration`, `start`, `end`, `points` e uma nota de interpretação. Cada ponto tem `time`, `x`, `y`, `life_state` e `lh` (null quando ausente). Sem replay completo, retorna `available: false` e `reason`; não utiliza `lane_pos` para inventar uma cronologia.

O frontend prepara o replay antes da chamada à IA quando o parser está disponível: reutiliza resultado pronto ou solicita download oficial e aguarda até três minutos. Falha ou expiração não impede a aula com dados públicos. A rota é desenhada no relatório após sucesso da análise. Intervalos de cinco minutos e limites manuais permitem revisar a partida inteira. Linhas são interrompidas em morte, lacuna acima de quatro segundos ou salto acima de 1800 unidades entre amostras. Esses cortes são heurísticas de visualização, não classificação comprovada de teleporte.

Marcadores de farm representam crescimento de LH entre amostras contínuas. Não comprovam o local de morte do creep ou posição de unidades controladas. A contagem pode ser menor que o total da partida quando há lacunas. A análise textual da IA é independente do desenho determinístico da rota.
