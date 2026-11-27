# Motor de regras 1.0

A análise executa funções JavaScript sobre dados do OpenDota e do parser local. Não chama Gemini nem outra IA, não envia a partida a um modelo e não precisa de chave de IA. O catálogo comunitário fornece nomes de heróis, itens e identificação do patch; falhas nesses catálogos não viram fatos inventados.

## Critérios

- Farm: janelas de até 5 minutos com pelo menos 3 amostras e 180 segundos, sem lacunas maiores que 90 segundos. A queda de ritmo é priorizada quando há janelas consecutivas, a primeira tem pelo menos 2 LH/min e a seguinte fica abaixo de 65% do ritmo anterior. São critérios editoriais da regra, não metas profissionais ou limites universais.
- Pausa: LH constante por pelo menos 120 segundos em amostras contínuas. Não significa renda zero nem prova inatividade ou erro de suporte.
- Luta: morte registrada; entre os eventos com morte, prioriza o menor saldo de ouro conhecido. Dano e saldo são descritivos, não uma nota de qualidade da luta.
- Recursos: antes de morte registrada no replay local, identifica habilidade aprendida com recarga positiva ou mana insuficiente na amostra. Não afirma que isso causou a morte.
- Item: compra anterior a uma luta em até 180 segundos, excluindo consumíveis comuns. Proximidade temporal não comprova entrega ou uso do item.
- Trajeto: usa apenas posições temporais do replay completo. Soma deslocamentos entre amostras vivas com lacunas máximas de 4s e saltos máximos de 1800 unidades. Prioriza um trecho com ao menos 120s observados e 8000 unidades de deslocamento entre as janelas elegíveis, começando pelo menor LH registrado. Isso não calcula uma rota ideal nem classifica o trajeto como ruim.

Cada regra gera uma aula com a situação observada, uma alternativa condicional, o motivo e a exceção. As prioridades são ordenadas por uma política fixa; palavras do foco apenas dão preferência à categoria. Não são instruções executadas pelo motor. Até três aulas são exibidas, com versão do motor e IDs de evidências.

O objetivo é tornar os diagnósticos auditáveis. Mesmo um sistema determinístico pode ter regras incompletas ou hipóteses ruins: uma morte pode ser uma troca correta, uma queda de farm pode resultar de uma boa jogada e uma distância em linha reta não prova caminho transitável. A posição 1–5 não é deduzida só da rota.

## Disponibilidade

Na Vercel, os eventos públicos do OpenDota sustentam a análise numérica e as aulas por regras. A rota de farm da partida inteira e estados espaciais dependem de um replay completo processado localmente. Sem isso, o relatório mostra a limitação e não inventa a rota.

As chaves antigas foram preservadas, mas não são usadas pela análise. O iniciador Windows mantém a descoberta de Node corrigida e passa a abrir diretamente, sem solicitar chave.
