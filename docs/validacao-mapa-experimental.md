# Estimador com mapa: validação experimental

O modelo de sensores em uso continua sendo a v2. Seus pesos não foram alterados nem treinados com obstáculos: o RoNIN disponível não contém o mapa dos móveis ou ações de desvio. O mapa entra no **estimador posterior à rede**, que propaga hipóteses de posição e direção, rejeita segmentos não transitáveis e considera alternativas à esquerda e à direita com pesos heurísticos menores. Isso não é uma observação de impacto, nem identifica com certeza qual lado a pessoa tomou. A saída original continua acessível; a interface avisa quando o mapa restringe hipóteses e interrompe a correção caso nenhuma solução viável reste.

## Avaliação local controlada

Foram usadas as predições reais da v2 nas trajetórias **de validação** RoNIN, divididas em 261 trechos não sobrepostos de 30 s. Para cada trecho foi criada uma sala retangular sintética ao redor da referência, com quatro retângulos sintéticos aleatórios que não a interceptam. A posição inicial foi considerada exatamente conhecida. Isso não reproduz o mapa das coletas nem é uma medição de obstáculos reais; trechos da mesma pessoa também não são amostras independentes.

| Medida | Filtro anterior | Novo filtro |
|---|---:|---:|
| Trechos em que o filtro perdeu todas as hipóteses | 44/261 | 7/261 |
| Janelas com saída | 14.728/15.660 | 15.522/15.660 |
| Erro médio de posição nas 14.724 janelas em que ambos produziram saída | 1,466 m | 1,451 m |
| Erro médio da saída original da rede nessas mesmas janelas | 1,536 m | 1,536 m |

O filtro novo manteve mais hipóteses viáveis **nesta simulação**; a diferença de precisão nos pontos comuns foi pequena: ele teve erro médio menor em 137 dos 261 trechos e maior em 124. Não é prova de melhoria em uma sala real. Os pontos depois da perda de um filtro não entram na comparação pareada de erros. Não se devem comparar diretamente erros médios de final de percurso entre filtros que tiveram perdas diferentes.

A dispersão angular entre predição e referência em janelas de movimento RoNIN teve mediana absoluta de 7,6° e percentil 90 de 25,6° em 11.883 janelas. Isso combina erro da rede, movimento e referencial: **não é uma incerteza calibrada do sensor do smartphone**. Os parâmetros das hipóteses continuam heurísticos.

## Reprodução na máquina de treinamento

Os dados de avaliação permanecem fora deste repositório e não devem ser incluídos na imagem Docker ou distribuídos sem observar a licença da SFU. Na pasta de treinamento que contém `movimento-inercial/` e `.venv-ml/`:

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=2 .venv-ml/bin/python codigo_trabalho/experimentos_mapas/preparar_validacao.py
.venv-ml/bin/python codigo_trabalho/experimentos_mapas/gerar_cenarios.py
cd movimento-inercial
RONIN_MAP_FIXTURE=../codigo_trabalho/experimentos_mapas/cenarios_validacao_local.json \
RONIN_MAP_RESULT=../codigo_trabalho/experimentos_mapas/resultado_validacao.json \
npx vitest run tests/map-replay.test.ts
```

O replay é omitido na suíte comum quando a variável `RONIN_MAP_FIXTURE` não está definida. A referência do filtro anterior está isolada em `tests/helpers/legacy-map-matcher.ts` para comparação; o aplicativo usa `src/map-match.ts`.

## Próxima validação indispensável

Medir uma sala real e trajetórias com ponto inicial e direção conhecidos: reta livre, rota que contorna obstáculo à esquerda e à direita, retorno e parada. Gravar sensores, estimativa sem mapa, estimativa com mapa e pontos de referência cronometrados; repetir em sessões separadas e medir erro, perdas, desvios artificiais e latência. Um mapa inexato, mudança de móveis, orientação inicial ruim ou movimento em pausa pode impedir a correção ou favorecer o lado errado. Evite apresentar uma hipótese como posição certa ou usar o sistema como orientação de segurança.
