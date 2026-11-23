# API

Todas as respostas de dados usam JSON. Falhas retornam `{ "error": "mensagem" }`, sem stacktrace. Há limites por IP e ação. Chamadas mutáveis exigem origem autorizada; não há CORS público.

| Método | Caminho | Uso |
|---|---|---|
| GET | `/api/health` | `ok`, `system`, `version`, `mode`, `gemini_configured` |
| POST | `/api/gemini/check` | Corpo `{}`; verifica credencial/modelo sem gerar aula |
| GET | `/api/matches/:id?hero=Kez&account=ID` | Dados públicos e seleção sugerida |
| POST | `/api/matches/:id/parse` | Corpo `{}`; solicita processamento OpenDota |
| GET | `/api/matches/:id/replay` | Estado da extração local |
| POST | `/api/matches/:id/replay` | Corpo `{}`; busca replay oficial |
| POST | `/api/matches/:id/replay-upload` | Binário `application/octet-stream`, limite 512 MB |
| GET | `/api/matches/:id/replay-data` | Resultado validado; aceita gzip |
| POST | `/api/matches/:id/analyze` | `{ "player_slot": 0, "focus": "timings", "consent": true }` |

`focus` tem até 600 caracteres. `consent` deve ser explicitamente true. A análise pode levar até dois minutos e consome a cota da chave configurada. Disponibilidade e granularidade dependem das fontes.

No modo local, somente Host de loopback é aceito. Em produção, todas as páginas e endpoints, exceto health, exigem HTTP Basic: usuário `coach`, senha `APP_ACCESS_PASSWORD`. Host e Origin devem corresponder a `APP_ORIGIN`. Use HTTPS no proxy. Esse acesso é destinado a uma instalação individual, sem cadastro de usuários.

Códigos usados: 400 validação; 401 autenticação; 403 host/origem; 404 ausência; 413 limite; 415 formato; 429 frequência ou concorrência; 500 falha interna. Fontes indisponíveis podem gerar avisos parciais no relatório.
