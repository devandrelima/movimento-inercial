# Comparação inicial: RoNIN e navegador

Situação: inspeção de uma sequência real (`a000_1`) do arquivo `train_dataset_1.zip`; o download e a extração integrais ainda estão em andamento. Não há modelo treinado ou métricas nesta análise.

A sequência extraída parcialmente teve CRC do ZIP validado. `synced/time` possui 67.610 amostras, intervalo mediano 0,005 s (200 Hz) e nenhum intervalo não crescente. Os grupos sincronizados incluem `acce`, `gyro`, `gyro_uncalib`, `game_rv`, `grav`, `linacce`, `magnet`, `rv` e `time`. A referência `pose/tango_pos` tem três coordenadas por amostra e `pose/tango_ori` tem quatro componentes; ambos servem a rótulos e avaliação, não são dados disponíveis ao navegador. A sequência possui metadados de calibração em `info.json`.

A rotina original `source/data_glob_speed.py` do repositório oficial aplica bias do giroscópio e escala/bias do acelerômetro; alinha orientação ao referencial Tango usando calibração e pose de referência iniciais; transforma os vetores e calcula velocidade global a partir de `tango_pos`. Essa calibração com pose de referência não pode ser pressuposta em produção: é necessário definir um referencial inicial e estratégia realizável no celular antes de gerar rótulos, e documentar quaisquer informações fornecidas pelo usuário. Não utilizar `tango_pos`, `tango_ori` ou calibração de alinhamento proveniente do rastreador como entradas disponíveis no dispositivo.

## Comparação com a coleta do segundo telefone

| RoNIN | Navegador observado | Considerações |
|---|---|---|
| `synced/acce` | `devicemotion.accelerationIncludingGravity` | Ambos contemplam gravidade; calibração, sinal, referencial e processamento do sistema devem ser comparados fisicamente. |
| `synced/gyro` ou `gyro_uncalib` | `devicemotion.rotationRate` | O evento está em graus/s e deve ser convertido para rad/s. O RoNIN usa calibração dependente do dispositivo; não assumir que o navegador exponha o mesmo sinal bruto. |
| `synced/game_rv` | `deviceorientation` relativo, em evento separado | Quaternion e ângulos Euler não são diretamente intercambiáveis sem definir convenção, referencial, sincronização e offset. `absolute=false` não garante norte. A interface agora coleta eventos de orientação separadamente, com seu próprio timestamp; ainda não há sincronização, transformação para quaternion ou alinhamento implementados. |
| `pose/tango_pos` | Não disponível | Referência de posição para construir deslocamentos e medir erro, nunca entrada da inferência. |
| `synced/time`, 200 Hz nesta sequência | Tempos monotônicos de evento, aproximadamente 60 Hz no segundo telefone | Ajustar frequências por reamostragem temporal, filtro antialias antes de reduzir frequência e política explícita para lacunas. Não inventar alta frequência a partir de 60 Hz. |

A coleta do segundo aparelho teve 1.853 eventos de movimento em 30,85 s (~60 Hz), 1.851 leituras de giroscópio alternativo (~60 Hz) e 849 eventos de orientação relativa. Com pareamento de até 10 ms, 1.852 pares mostraram correlação de aproximadamente 0,998 para `alpha`/X, 0,981 para `beta`/Y e 0,999 para `gamma`/Z. Isso apoia a correção aplicada na interface para `alpha→X`, `beta→Y`, `gamma→Z` e rad/s, também descrita na [especificação W3C atual](https://www.w3.org/TR/orientation-event/). Não substitui testes físicos em outros navegadores, dada a variação entre implementações.

## Dados ainda necessários

Este arquivo é somente parte do treino. Precisamos de conjuntos independentes de validação e teste, com separação por trajetórias ou participantes e protocolo documentado. Uma amostra não representa todo o conjunto. O inventário automático produzirá `data/ronin/comparacao-inventario.json` após download, extração e validação completos; seu status fica em `data/ronin/inventory.status`. O arquivo não contém métricas de modelo.

## Captura no navegador

A interface registra `devicemotion` e `deviceorientation` em linhas separadas, com relógio monotônico e marcadores `inicio` e `pausa`. Os campos `gravidade_x_m_s2`, `gravidade_y_m_s2` e `gravidade_z_m_s2` são nomes históricos: contêm `accelerationIncludingGravity` (aceleração total incluindo gravidade), não gravidade isolada. Os demais campos do CSV permanecem nas unidades originais do navegador; o gráfico de giroscópio usa rad/s. A coleta de orientação pode falhar sem bloquear o diagnóstico de movimento; ausência ou recusa é exibida na tela. Um estado `absolute=false` indica referencial relativo, não norte. Os eventos ainda não foram reamostrados nem normalizados para o modelo. A avaliação final de equivalência dos referenciais depende do pipeline e de testes reais em aparelhos.
