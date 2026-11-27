# Movimento inercial

Aplicação web experimental de navegação inercial para a disciplina de Sistemas Embarcados. O navegador do smartphone coleta dados dos sensores e executa localmente um modelo neural treinado com o dataset [RoNIN](https://ronin.cs.sfu.ca/), estimando deslocamentos e desenhando uma trajetória em duas dimensões.

A aplicação publicada está em [embarcado.bemaqui.online](https://embarcado.bemaqui.online/). A estimativa é experimental: os resultados ainda precisam ser validados em caminhadas reais com referências medidas.

## Funcionalidades

- Teste de compatibilidade dos sensores e permissões antes do uso (3 segundos). Se o aparelho não passar, ainda é possível abrir o mapa, com play e reset desabilitados, para criar, editar e carregar mapas.
- Mapas públicos: qualquer pessoa carrega os mapas da lista; publicar, atualizar e excluir exigem login. Veja [mapas públicos](docs/mapas-publicos.md).
- Leitura de aceleração com gravidade, giroscópio e orientação; aquisição e inferência locais, sem GPS ou câmera.
- Pré-processamento a 50 Hz e inferência com o modelo RoNIN v2 float32 no navegador, usando LiteRT.js e WebAssembly.
- Trajetória em grade métrica com zoom, arraste, início, pausa, reset e exportação das leituras em CSV.
- Editor de sala retangular e obstáculos com redimensionamento por cantos e arestas, ponto inicial arrastável e direção inicial; correção experimental com filtro de partículas, exportação em CSV do traço original e do corrigido.
- Interface responsiva, build de produção em Docker e servidor Nginx no container.

A versão INT8 está incluída para avaliação, mas a aplicação utiliza o modelo float32. O modelo e seus metadados estão em `public/models/`. O treinamento da v2 foi feito em outra máquina e seu código completo de treinamento não está neste repositório; `ml/` contém ferramentas anteriores de obtenção e inspeção dos dados. O dataset e os arquivos de trabalho não estão incluídos.

Consulte [a documentação da integração](docs/integracao-modelo.md) para contrato de entrada e saída, métricas relatadas na entrega, calibração, limitações e detalhes da correção com mapa.

## Requisitos

- Docker e Docker Compose para executar a aplicação.
- Smartphone e navegador que forneçam acelerômetro, giroscópio e orientação; o teste inicial exige frequência de movimento de pelo menos 50 Hz.
- HTTPS válido para acesso aos sensores em um aparelho remoto. O endereço `localhost` é útil para testes locais, mas não substitui HTTPS no celular.

## Executar com Docker

O Compose utiliza uma rede Docker externa chamada `automacao-net`, usada pelo proxy na VPS. Em uma instalação nova, crie-a uma vez se ela ainda não existir:

```bash
docker network inspect automacao-net >/dev/null 2>&1 || docker network create automacao-net
cp .env.example .env   # defina SEED_USER e SEED_PASSWORD para o usuário inicial dos mapas públicos
docker compose build
docker compose up -d
docker compose ps
```

A aplicação fica disponível localmente em `http://127.0.0.1:8197` e o endpoint de saúde em `http://127.0.0.1:8197/health`. A porta pode ser alterada em `.env`. Para acesso remoto, configure um reverse proxy HTTPS para o container ou para essa porta local; preserve o Nginx e outros serviços existentes. O Compose usa reinício automático, limite de recursos, logs limitados e não monta o Docker socket.

```bash
docker compose logs -f
docker compose down
```

`docker compose down` encerra os serviços deste projeto; a rede externa e serviços de outros projetos são preservados. Os mapas públicos ficam no volume `maps-data`, que `down` preserva; **não use `docker compose down -v`**, que o apagaria. Os arquivos do dataset não entram na imagem.

## Testes e desenvolvimento

Para compilar e executar os testes automatizados fora do container de produção, instale Node.js e npm compatíveis com a imagem de build:

```bash
npm ci
npm run build
npx vitest run
```

Os testes incluem sensores, permissões, janelas de 50 Hz, referencial, exportação, trajetória, geometria dos obstáculos e filtro de mapa. Os roteiros de navegador em `tests/` usam o CLI do Playwright e eventos de sensores simulados; eles não substituem testes físicos com um smartphone.

## Limitações

- A primeira saída do modelo chega por volta de 3 segundos e não reconstrói aproximadamente os primeiros 2,5 segundos. O usuário deve começar caminhando em linha reta para definir a direção inicial.
- Leituras indisponíveis, baixa frequência, lacunas, movimento durante pausas e diferenças de calibração ou orientação entre aparelhos podem afetar o resultado.
- O mapa restringe trajetórias impossíveis conforme a planta informada, mas não garante melhora de precisão nem detecta obstáculos ausentes ou movidos. Se não restarem hipóteses compatíveis, a correção é interrompida; o traço original continua no CSV de trajetórias.
- As métricas da v2, relatadas na entrega do treinamento, não são uma validação independente da aplicação em um smartphone. Consulte [o documento técnico](docs/integracao-modelo.md).
- O RoNIN possui termos próprios de uso dos dados. Verifique a [licença do dataset](https://www.frdr-dfdr.ca/repo/files/8/published/publication_538/submitted_data/LICENSE.txt) e as condições aplicáveis aos artefatos derivados antes de reutilizá-los ou redistribuí-los.
