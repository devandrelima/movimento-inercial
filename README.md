# Norte — navegação inercial

Projeto em desenvolvimento. A interface atual oferece diagnóstico de sensores; **não contém modelo treinado, inferência, trajetórias, experimentos nem deploy HTTPS**.

## Estado e restrições

A primeira parte do [RoNIN](https://www.frdr-dfdr.ca/repo/dataset/816d1e8c-1fc3-47ff-b8ea-a36ff51d682a) foi obtida e extraída; o conjunto de teste não visto está baixando. Ainda faltam sequências do protocolo oficial de treino e validação. Consulte `docs/ronin-sensores.md`. Dados e modelos têm licença específica para pesquisa não comercial; obtenha e consulte o LICENSE do dataset antes do uso.

A VPS possui Nginx Proxy Manager em Docker nas portas 80/443 e outros serviços ativos. Não alterá-los. A memória disponível era cerca de 1,6 GiB no início; treinamento deve ser limitado e agendado de forma a preservar os serviços existentes. Nenhum serviço do projeto foi publicado.

## Diagnóstico

`docker compose build` e `docker compose up -d` executam a interface experimental somente em 127.0.0.1:8197. `curl http://127.0.0.1:8197/health` verifica o servidor. Isso não oferece HTTPS nem habilita sensores em telefones remotos. `docker compose down` remove apenas os recursos deste Compose.

O navegador informa aceleração incluindo gravidade em m/s² e rotação em graus/s, convertida para rad/s (alpha→X, beta→Y, gamma→Z, conforme a especificação W3C atual; confirmar em cada navegador). Valores ausentes são rejeitados. Convenções e sinais dependem do navegador e precisam de validação física antes de qualquer integração com treinamento. A frequência exibida é calculada sobre as últimas 100 leituras. Os dados ficam na memória do navegador e não são transmitidos pelo código da aplicação.

## Próximos passos

1. Completar os dados RoNIN e validar unidades, calibração, timestamps, orientação e compatibilidade com os sensores web.
2. Construir e testar pipeline de divisões independentes, treinamento, métricas, quantização e comparação com execução no navegador.
3. Implementar sessão, gravação, reprodução, experimentos e interface completa; validar em aparelhos reais.
4. Configurar proxy e certificado após receber hostname e DNS; verificar saúde, HTTPS e modelo antes de declarar publicação.
