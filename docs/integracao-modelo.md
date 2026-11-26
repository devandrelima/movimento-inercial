# Integração experimental do modelo RoNIN

A versão ativa é a v2 experimental: uma rede residual 1D treinada com RoNIN que combina oito rotações dentro do próprio grafo. O aplicativo usa TFLite float32 (994.528 bytes); a versão INT8 (361.824 bytes) também é fornecida, mas não é executada pelo aplicativo. Os arquivos da v1 permanecem disponíveis para evitar falhas em abas antigas que ainda carreguem o código anterior. Os pesos e metadados estão em `public/models/`. O SHA-256 do modelo ativo é conferido pelo navegador antes do uso. O runtime LiteRT.js 2.6.0 executa em WebAssembly num worker local; nenhuma leitura é enviada ao servidor.

## Entrada e saída

São necessários aceleração com gravidade, giroscópio e orientação completa. `devicemotion` fornece aceleração em m/s² e rotação em graus/s, convertida em rad/s. Os campos de rotação seguem a convenção W3C usada no navegador (`alpha` X, `beta` Y, `gamma` Z), corroborada pela comparação com a API de giroscópio em gravação de aparelho enviada pelo usuário. A documentação da entrega propõe outra ordem; é necessária validação física em cada combinação de aparelho e navegador.

A orientação `deviceorientation` gira os eixos do aparelho para um referencial horizontal local, sem exigir norte magnético. As equivalências entre essa orientação do navegador e `game_rv` do RoNIN, bem como calibrações e sinais de dispositivos diferentes, ainda precisam ser validadas fisicamente. O filtro causal de quatro estágios de 12 Hz precede a interpolação temporal para 50 Hz; o primeiro segundo é descartado. Cada janela tem 100 amostras e avança 25. A normalização está embutida nos pesos. Uma saída `[dx, dy]` representa somente os últimos 0,5 s de cada janela e é somada uma vez. Aproximadamente os primeiros 2,5 s não têm estimativa.

A perda de sensor/orientação, frequência insuficiente, lacuna de amostragem ou pausa interrompe a inferência. Ao retomar, a estimativa continua no último ponto conhecido, usando o referencial inicial enquanto a origem de orientação do navegador permanecer compatível. O deslocamento durante a interrupção é desconhecido e não é acrescentado; se a pessoa se mover durante essa lacuna, a posição exibida ficará deslocada. Se a referência da orientação mudar entre absoluta e relativa, a inferência fica suspensa até voltar à referência original. O mapa assume 1 metro por quadrícula.

## Validação e limitações

Na inicialização, uma entrada sintética acompanha o aplicativo e a saída do navegador é comparada com a referência float fornecida na entrega (tolerância de 1e-5). O processamento e as pausas possuem testes automatizados. Uma gravação real de sensores enviada pelo usuário foi reproduzida no navegador em ambiente isolado e gerou a linha por inferência real; não havia posição de referência para avaliar a precisão. Ainda são necessários testes de caminhada nos aparelhos reais, com percursos medidos, verificação das convenções, latência, memória e consumo.

Segundo o relatório da v2, o teste em participantes não vistos teve MAE de 0,0743 m por componente e janela de 0,5 s, erro médio de posição de 7,97 m e erro final médio acumulado de 11,46 m por trajetória. O conjunto de teste já havia sido consultado na v1 e não é um teste cego virgem para esta iteração. Não são ATE/RTE padronizados. O relatório anterior informa sobreposição de 10 participantes entre treino e validação e ausência de uma sequência da lista de treino. A versão INT8 apresentou erro final médio de 11,74 m. Esses resultados são os relatados pela entrega, não uma medição independente deste deploy. A trajetória é experimental e não deve ser tratada como localização confiável.

Para reproduzir o build e os testes: `npm ci`, `npm run build`, `npx vitest run`, `docker compose build` e `docker compose up -d`. Em produção, o proxy HTTPS encaminha para o container web, sem expor diretamente a porta pública. Os artefatos e os arquivos WASM são servidos no mesmo domínio. As gravações e conjuntos de dados não entram na imagem.

## Direção inicial e zoom do mapa

O mapa define a frente de cada trecho a partir do primeiro deslocamento estimado cuja distância à origem alcança 0,75 m. Essa direção é exibida para cima; a transformação é uma rotação rígida que preserva distâncias e giros à direita e à esquerda. Antes disso, a linha fica oculta e a interface solicita uma caminhada inicial reta. O trecho inicial de aproximadamente 2,5 s continua sem estimativa pelo modelo. A orientação depende da previsão, portanto ruído, desvios ou movimento insuficiente podem atrasar ou desalinhar a calibração; não é uma medição direta da orientação do usuário. A mesma direção inicial é mantida após pausas e lacunas; movimentos durante elas não são observados.

Botões, roda do mouse e pinça alteram a escala visual; uma quadrícula continua representando 1 m × 1 m em qualquer zoom. O reset restaura o zoom e a centralização.

## Verificação inicial de compatibilidade

Antes de iniciar, o usuário autoriza os sensores e movimenta o aparelho durante cinco segundos. A verificação exige leituras completas de acelerômetro com gravidade, giroscópio e orientação, além de pelo menos 50 Hz de eventos completos de movimento durante o intervalo. Sensores ausentes, permissão negada ou frequência insuficiente são informados, com opção de repetir o teste. Uma aprovação indica disponibilidade durante aquela amostra, não garante precisão ou disponibilidade contínua.

Depois que o usuário toca em Iniciar, a página mostra o carregamento real do modelo e só abre o mapa quando o carregamento e o teste de compatibilidade do modelo terminam. Em caso de erro, é possível tentar novamente. A aquisição de rastreamento começa apenas ao tocar em play na tela do mapa.

A barra de carregamento representa etapas do preparo: início do mecanismo, download do arquivo do modelo, verificação do hash, compilação e teste de inferência. O download usa o tamanho informado pelo servidor para mostrar progresso dos bytes quando disponível; sem esse tamanho, a barra avança quando o download termina. Os percentuais são pesos dessas etapas, não uma estimativa do tempo restante. A barra só atinge 100% após o teste de inferência passar.
