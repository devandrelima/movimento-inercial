# Integração experimental do modelo RoNIN

A entrega recebida contém uma CNN de 5.738 parâmetros treinada com RoNIN. A versão ativa é TFLite float32 (26.480 bytes); a versão INT8 (11.608 bytes) é fornecida para investigação, mas não é a versão executada pelo aplicativo. Os pesos e metadados estão em `public/models/`. O SHA-256 do modelo ativo é conferido pelo navegador antes do uso. O runtime LiteRT.js 2.6.0 executa em WebAssembly num worker local; nenhuma leitura é enviada ao servidor.

## Entrada e saída

São necessários aceleração com gravidade, giroscópio e orientação completa. `devicemotion` fornece aceleração em m/s² e rotação em graus/s, convertida em rad/s. Os campos de rotação seguem a convenção W3C usada no navegador (`alpha` X, `beta` Y, `gamma` Z), corroborada pela comparação com a API de giroscópio em gravação de aparelho enviada pelo usuário. A documentação da entrega propõe outra ordem; é necessária validação física em cada combinação de aparelho e navegador.

A orientação `deviceorientation` gira os eixos do aparelho para um referencial horizontal local, sem exigir norte magnético. As equivalências entre essa orientação do navegador e `game_rv` do RoNIN, bem como calibrações e sinais de dispositivos diferentes, ainda precisam ser validadas fisicamente. O filtro causal de quatro estágios de 12 Hz precede a interpolação temporal para 50 Hz; o primeiro segundo é descartado. Cada janela tem 100 amostras e avança 25. A normalização está embutida nos pesos. Uma saída `[dx, dy]` representa somente os últimos 0,5 s de cada janela e é somada uma vez. Aproximadamente os primeiros 2,5 s não têm estimativa.

A perda de sensor/orientação, frequência insuficiente, lacuna de amostragem ou pausa interrompe a inferência. Ao retomar, um novo trecho independente começa na origem; a posição durante a interrupção é desconhecida. Assim, trechos separados não podem ser interpretados como coordenadas no mesmo referencial. O mapa assume 1 metro por quadrícula.

## Validação e limitações

Na inicialização, uma entrada sintética acompanha o aplicativo e a saída do navegador é comparada com a referência float fornecida na entrega (tolerância de 1e-5). O processamento e as pausas possuem testes automatizados. Uma gravação real de sensores enviada pelo usuário foi reproduzida no navegador em ambiente isolado e gerou a linha por inferência real; não havia posição de referência para avaliar a precisão. Ainda são necessários testes de caminhada nos aparelhos reais, com percursos medidos, verificação das convenções, latência, memória e consumo.

Segundo o relatório entregue pelo treinamento, o teste em participantes não vistos teve MAE de 0,10819 m por componente e janela de 0,5 s, e erro final médio acumulado de 26,79 m por trajetória. Não são ATE/RTE padronizados. O relatório também informa sobreposição de 10 participantes entre treino e validação e ausência de uma sequência da lista de treino. A versão INT8 apresentou erro final médio de 31,79 m. Esses resultados são os relatados pela entrega, não uma medição independente deste deploy. A trajetória é experimental e não deve ser tratada como localização confiável.

Para reproduzir o build e os testes: `npm ci`, `npm run build`, `npx vitest run`, `docker compose build` e `docker compose up -d`. Em produção, o proxy HTTPS encaminha para o container web, sem expor diretamente a porta pública. Os artefatos e os arquivos WASM são servidos no mesmo domínio. As gravações e conjuntos de dados não entram na imagem.
