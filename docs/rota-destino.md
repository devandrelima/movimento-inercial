# Destino e rota sugerida

Antes de iniciar uma coleta com uma sala selecionada, **toque (ou clique) no mapa** para escolher o destino: o círculo e a rota aparecem na hora. Só existe **um destino por vez**; tocar em outro ponto o substitui. Pontos fora da sala, dentro de obstáculos ou sem rota com a margem abaixo são recusados com um aviso e o destino anterior continua ativo. Arrastar ou usar pinça para navegar no mapa não define destino (um toque é um movimento de até 8 px). Como alternativa, ou para valores exatos, abra **Destino opcional**, informe X e Y em metros e selecione **Traçar rota**; **Remover destino** o limpa. A linha tracejada indica uma sugestão e o círculo marca o destino. O destino pertence à sessão local: não é publicado nem gravado no mapa. Para alterá-lo após iniciar, reinicie a sessão. Ao trocar ou editar a sala, escolha o destino novamente.

O A* usa uma grade de 25 cm em salas de até ~100 × 100 m; em salas maiores a grade engrossa para o planejador ficar limitado a ~160 mil células (50 cm em 200 × 200 m, 1,25 m em 500 × 500 m), senão o cálculo travaria a página (medido: ~12 s a 25 cm em 500 × 500 m; com o limite, ~0,4 s no mesmo teste). Com a grade mais grossa, passagens mais estreitas que a célula podem não ser encontradas, e a rota informa que não achou caminho nessa resolução. A rota usa segmentos sem interseção com obstáculos e margem geométrica de 20 cm ao redor dos obstáculos e das paredes. Origem e destino também precisam respeitar a margem. Quando não encontra caminho nessa resolução, informa a limitação; isso não prova que nenhum caminho físico exista. A margem é fixa e não substitui as medidas da pessoa, aparelho ou ambiente.

O filtro mantém a rede v2 inalterada e aplica uma preferência heurística pequena às hipóteses próximas da rota; ela nunca elimina uma hipótese válida apenas por estar longe. Em espaço livre a saída segue o deslocamento previsto pela rede. Quando a posição estimada permanece a mais de 1 m da rota por três atualizações, o planejador tenta criar uma nova rota a partir dessa posição; se não houver solução, a preferência é desativada e a interface informa a falha. Sem movimento previsto não há deslocamento artificial nem confirmação de chegada. A posição corrigida continua incerta, e o filtro pode perder hipóteses ou estimar o lado errado; mesmo um peso pequeno pode enviesar resultados após várias atualizações.

## Avaliação preliminar

Foi feita uma comparação nos dados locais de validação RoNIN e mapas sintéticos descritos em [validação do mapa](validacao-mapa-experimental.md). O destino foi definido usando o ponto final de referência, uma condição idealizada. Dos 261 trechos, 253 tinham uma rota com a margem e resolução escolhidas. Nas 15.034 janelas em que os dois filtros forneceram saída, o erro médio foi de 1,569 m sem preferência pela rota e 1,559 m com preferência; ambos perderam hipóteses em 7 trechos. A diferença é pequena, e a comparação usa apenas os mesmos pontos disponíveis. Os mapas não são os das coletas, o destino era conhecido exatamente e trechos de uma pessoa não são independentes. Isso não demonstra melhora em uma sala real.

Para reproduzir na máquina com os dados locais:

```sh
RONIN_MAP_FIXTURE=../codigo_trabalho/experimentos_mapas/cenarios_validacao_local.json \
RONIN_ROUTE_RESULT=../codigo_trabalho/experimentos_mapas/resultado_rota.json \
npx vitest run tests/route-replay.test.ts
```

São necessários testes com referência real e trajetórias que sigam a sugestão, escolham o lado oposto, parem, retornem ou mudem de destino. O modelo, os pesos e as métricas devem ser avaliados sem usar o conjunto de participantes não vistos para ajustar os parâmetros.
