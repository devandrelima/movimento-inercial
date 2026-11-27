# Avaliação das janelas iniciais (estimar logo depois do play)

Mede se preencher o histórico anterior à primeira leitura com cópias dela (aparelho parado ao apertar play) dá o mesmo resultado que ter o histórico real, e quanto isso piora quando o aparelho já estava em movimento. Resultados e limitações: [`docs/integracao-modelo.md`](../../docs/integracao-modelo.md), seção "Primeiras estimativas".

Os dados do RoNIN **não** estão no repositório (licença da SFU). Os scripts esperam o subconjunto extraído (`<sequência>/data.hdf5`) montado em `/d`, uma pasta de trabalho em `/w` e um ambiente Python com `numpy` e `h5py` (por exemplo, a imagem `norte-ronin-inspect:local`, de `Dockerfile.inspect`).

1. Pré-processamento (como o aplicativo faz): aceleração e giro com `game_rv` para o referencial do mundo, filtro de 4 estágios a 12 Hz a 200 Hz e subamostragem para 50 Hz. A convenção do quaternião (`wxyz`) é confirmada por a gravidade resultar em ≈ (0, 0, 9,9).
2. `extrair_parado.py`: janelas normais (para calibrar a rotação entre o referencial do jogo e o do Tango, por sequência) e 57 eventos reais "parado → anda", com a janela preenchida e a janela com histórico real para cada instante (0,5 s, 1,0 s, ... 3,0 s).
3. `extrair_andando.py`: 939 casos de play apertado já em movimento, as leituras iniciais (para o filtro de "parado") e os mesmos pares de janelas.
4. `inferir.mjs`: roda as janelas no modelo real (worker do aplicativo, em um navegador headless).
5. `analisar_parado.py` e `analisar_andando.py`: calibram a rotação, conferem a sanidade (erro de ~7 cm por janela de 0,5 s) e comparam preenchida × histórico real × referência, e limiares do filtro de "parado".

```sh
D=/caminho/data/ronin/train_dataset_1; W=$PWD/trabalho; mkdir -p $W
docker run --rm -v $D:/d:ro -v $W:/w -v $PWD:/s --entrypoint python norte-ronin-inspect:local /s/extrair_parado.py 20    # gera /w/windows.json
docker run --rm -v $D:/d:ro -v $W:/w -v $PWD:/s --entrypoint python norte-ronin-inspect:local /s/extrair_andando.py 20   # gera /w/walking.json
# com o aplicativo servido (npm run build && npx vite preview --port 4199):
node inferir.mjs $W/windows.json $W/outputs.json "$(ls ../../dist/assets | grep '^inference.worker')"
node inferir.mjs $W/walking.json $W/outputs_walking.json "$(ls ../../dist/assets | grep '^inference.worker')"
docker run --rm -v $W:/w -v $PWD:/s --entrypoint python norte-ronin-inspect:local /s/analisar_parado.py
docker run --rm -v $W:/w -v $PWD:/s --entrypoint python norte-ronin-inspect:local /s/analisar_andando.py
```

## Direção inicial do traço

Os mesmos eventos foram usados para medir o erro da direção estimada pela corda até a ponta do traço (`analisar_direcao_por_distancia.py`), o quanto o desenho gira a cada atualização no esquema antigo e no progressivo (`analisar_direcao_progressiva.py`) e a hipótese de usar o topo do aparelho como "frente" (`analisar_hipotese_topo_do_aparelho.py`, que precisa de `h5py` para ler o quaternião no instante do play). Resultados em [`docs/integracao-modelo.md`](../../docs/integracao-modelo.md).

Ressalvas: as 20 sequências são do subconjunto de treino (o modelo já as viu, então os erros absolutos são otimistas; a comparação entre variantes é o que vale); a reconstrução do pré-processamento é aproximada; e o protocolo de coleta do RoNIN difere do de um celular num navegador.
