# Norte — navegação inercial

Projeto em desenvolvimento. A interface atual oferece diagnóstico de sensores; **não contém modelo treinado, inferência, trajetórias, experimentos nem deploy HTTPS**.

## Estado e restrições

Em 25/11/2026, a página oficial do [RoNIN](https://www.frdr-dfdr.ca/repo/dataset/816d1e8c-1fc3-47ff-b8ea-a36ff51d682a) informava que os arquivos estavam em backup e não podiam ser aprovados para download. É necessária uma cópia legítima dos dados ou a restauração do serviço, e um hostname com DNS para HTTPS. Dados e modelos têm licença específica para pesquisa não comercial; consulte o LICENSE do dataset.

A VPS possui Nginx Proxy Manager em Docker nas portas 80/443 e outros serviços ativos. Não alterá-los. A memória disponível era cerca de 1,6 GiB no início; treinamento deve ser limitado e agendado de forma a preservar os serviços existentes. Nenhum serviço do projeto foi publicado.

## Diagnóstico

`docker compose build` e `docker compose up -d` executam a interface experimental somente em 127.0.0.1:8197. `curl http://127.0.0.1:8197/health` verifica o servidor. Isso não oferece HTTPS nem habilita sensores em telefones remotos. `docker compose down` remove apenas os recursos deste Compose.

O navegador informa aceleração incluindo gravidade em m/s² e rotação em graus/s, convertida para rad/s (beta→X, gamma→Y, alpha→Z). Valores ausentes são rejeitados. Convenções e sinais dependem do navegador e precisam de validação física antes de qualquer integração com treinamento. A frequência exibida é calculada sobre as últimas 100 leituras. Os dados ficam na memória do navegador e não são transmitidos pelo código da aplicação.

## Próximos passos

1. Obter dados RoNIN e examinar unidades, calibração, timestamps, orientação e compatibilidade com os sensores web.
2. Construir e testar pipeline de divisões independentes, treinamento, métricas, quantização e comparação com execução no navegador.
3. Implementar sessão, gravação, reprodução, experimentos e interface completa; validar em aparelhos reais.
4. Configurar proxy e certificado após receber hostname e DNS; verificar saúde, HTTPS e modelo antes de declarar publicação.
