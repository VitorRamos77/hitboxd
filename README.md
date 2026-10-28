# hitBoxd

Uma rede social para gamers catalogarem, avaliarem e resenharem os jogos que jogam, criando um diário interativo com listas personalizadas e recomendações da comunidade.

## Arquitetura

```
frontend/   HTML + CSS + JS puro (sem build), servido pelo FastAPI
python-api/ FastAPI  :8000 — catálogo de jogos, estatísticas e recomendações
java-api/   Spring Boot :8080 — usuários, avaliações, diários de jogo, listas, seguidores e feed
```

O navegador conversa com os dois serviços. O serviço Python é o dono do catálogo e consulta o serviço Java (`GET /api/reviews`) para calcular médias, a distribuição das notas e as recomendações. O serviço Java guarda apenas o `gameId` de cada jogo.

Os dois serviços guardam os dados em memória (o Java usa H2) e recarregam os dados de exemplo ao reiniciar: 24 jogos, 5 usuários, 32 avaliações, 20 atualizações de diário e 5 listas.

### Diário de jogo

O diário funciona como o caderno de um jogo que você está jogando. Em **Diário**, a lateral mostra os seus diários (os jogos com atualizações e os que você marcou como "Jogando"). Você escolhe um jogo e adiciona atualizações sobre cada sessão: o texto, o dia, as horas jogadas e se contém spoilers. O mesmo dia pode ter quantas atualizações você quiser. Elas aparecem agrupadas por dia ("Hoje", "Ontem"...) e com a hora em que foram escritas. O cabeçalho soma as horas jogadas. Para começar o diário de outro jogo, use **+ Novo** ou o botão **Diário do jogo** na página do jogo. A nota e a resenha continuam em **Avaliar jogo**.

### Capas e screenshots

Cada jogo tem um `coverUrl` com a imagem original: a arte vertical da Steam (600x900) ou, para jogos fora da Steam, a capa da Wikipedia. O navegador nunca baixa essa imagem direto. Ele pede `GET /api/games/{id}/cover`, e então o FastAPI:

1. baixa a original só no primeiro pedido;
2. reduz para 360x540 em WebP com o Pillow (cerca de 25 KB, contra 50 a 110 KB da original). Capas quadradas e logos são encaixados inteiros sobre a cor do jogo, sem corte;
3. guarda o resultado em `python-api/.cache/images/` e o entrega com `Cache-Control` de 1 dia e `ETag`.

As screenshots seguem o mesmo caminho. Para jogos da Steam, a lista vem da API da loja (`appdetails`), guardada em `.cache/steam/` por uma semana. Para os outros, as URLs ficam em `screenshotUrls`. Cada jogo mostra até 6 imagens, em dois tamanhos: miniatura de 480x270 (cerca de 20 KB) e imagem grande de 1280x720 (cerca de 100 KB), que só é baixada quando você clica para ampliar. A primeira visita à página de um jogo leva cerca de 1 s a mais, enquanto as imagens são geradas.

No frontend, as imagens usam `loading="lazy"`, então só são baixadas quando aparecem na tela. Enquanto carregam, a cor do jogo fica de fundo e, se a capa falhar, o card volta a mostrar o título. As 24 capas somam cerca de 570 KB na primeira visita. Depois disso, ficam no cache do navegador.

As imagens pertencem aos respectivos estúdios e são usadas aqui só como ilustração em um projeto acadêmico.

### Tempos do HowLongToBeat

O HowLongToBeat não tem API pública, então os tempos (história principal, história + extras e 100%) foram levantados uma vez e gravados em [`python-api/app/game_details.py`](python-api/app/game_details.py), junto com o id da página de cada jogo, para que o site mostre o link "Dados do HowLongToBeat". O mesmo arquivo tem a descrição e o texto "para quem é" de cada jogo.

## Como rodar

Pré-requisitos: Python 3.11+ e JDK 25. Não é preciso instalar o Maven, porque o projeto usa o wrapper `mvnw`.

**1. Serviço da comunidade (Spring Boot)**

```bash
cd java-api
./mvnw spring-boot:run
```

No Windows (PowerShell), use `.\mvnw.cmd spring-boot:run`.

**2. Serviço de catálogo (FastAPI) + frontend**

```bash
cd python-api
python -m venv .venv
.venv/Scripts/activate        # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

**3.** Abra http://localhost:8000, clique em **Entrar** e informe um nome de usuário (por exemplo, `ana_souls`), escolha um dos perfis de exemplo ou crie o seu. Depois de entrar, o botão com a sua foto abre o menu da conta: perfil, diário, listas, seguidores, dados da conta (nome, bio e foto), trocar de conta e sair.

A documentação interativa do FastAPI fica em http://localhost:8000/docs, e o console do H2 em http://localhost:8080/h2-console (JDBC URL `jdbc:h2:mem:hitboxd`, usuário `sa`).

## Endpoints

### Python — catálogo (`:8000`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/games?q=&genre=&platform=&sort=popular\|rating\|year\|title` | Busca e filtra jogos, com média e nº de registros da comunidade (versão enxuta, sem os textos longos) |
| GET | `/api/games/{id}` | Detalhe de um jogo: descrição, "para quem é", tempos do HowLongToBeat e médias |
| POST | `/api/games` | Adiciona um jogo ao catálogo |
| GET | `/api/games/{id}/screenshots` | Lista as screenshots do jogo (URLs da miniatura e da imagem grande) |
| GET | `/api/games/{id}/screenshots/{n}?size=thumb\|full` | Screenshot reduzida em WebP (480x270 ou 1280x720) |
| GET | `/api/games/{id}/cover` | Capa reduzida (WebP 360x540), gerada e guardada no primeiro pedido |
| GET | `/api/games/{id}/stats` | Média, curtidas e distribuição das notas (½★ a 5★) |
| GET | `/api/genres`, `/api/platforms` | Valores disponíveis para os filtros |
| GET | `/api/recommendations/{userId}?limit=8` | Recomendações personalizadas, com o motivo de cada uma |
| GET | `/api/health` | Status do serviço e se o serviço Java está acessível |

A recomendação combina três sinais: a afinidade do usuário com gêneros e desenvolvedoras (calculada a partir das próprias notas e curtidas), uma filtragem colaborativa simples (similaridade de cosseno com usuários que avaliaram os mesmos jogos) e a média da comunidade ponderada pelo número de avaliações.

### Java — comunidade (`:8080`)

| Método | Rota | Descrição |
|---|---|---|
| GET / POST | `/api/users` | Lista os usuários / cria um perfil |
| GET / PUT | `/api/users/{id}` | Perfil com estatísticas / edita o perfil |
| GET | `/api/users/{id}/avatar` | Foto de perfil (cache de 30 dias; listas e feed levam só `avatarVersion`) |
| PUT / DELETE | `/api/users/{id}/avatar` | Envia a foto (corpo `image/jpeg`, `png` ou `webp`, até 256 KB) / remove a foto |
| GET | `/api/users/{id}/followers` | Quem segue o usuário (quem ele segue vem em `following` no perfil) |
| POST / DELETE | `/api/users/{id}/following/{targetId}` | Segue / deixa de seguir |
| GET | `/api/users/{id}/diary` | Avaliações do usuário, ordenadas pela data em que jogou |
| GET | `/api/reviews?userId=&gameId=` | Avaliações |
| GET | `/api/users/{id}/journal` | Jogos do diário do usuário, com nº de atualizações, horas e situação |
| GET | `/api/users/{id}/journal/{gameId}` | Atualizações do diário de um jogo, das mais recentes às mais antigas |
| POST | `/api/journal` | Adiciona uma atualização (`userId`, `gameId`, `text`, `playedOn`, `sessionHours`, `spoilers`) |
| PUT / DELETE | `/api/journal/{id}` | Edita / exclui uma atualização (o DELETE exige `?userId=` do dono) |
| POST | `/api/reviews` | Registra um jogo (nota em meias estrelas, curtida, resenha, situação, plataforma, data, rejogado, spoilers) |
| GET / PUT / DELETE | `/api/reviews/{id}` | Lê, edita ou exclui uma entrada |
| POST | `/api/reviews/{id}/like` | Curte uma resenha |
| GET | `/api/feed?userId=&limit=20` | Atividade de quem o usuário segue (ou de toda a comunidade) |
| GET / POST | `/api/lists?ownerId=&gameId=` | Listas personalizadas / cria uma lista |
| GET / PUT / DELETE | `/api/lists/{id}` | Lê, edita ou exclui uma lista |
| POST | `/api/lists/{id}/games` | Adiciona um jogo (`{"gameId": 3}`) |
| DELETE | `/api/lists/{id}/games/{gameId}` | Remove um jogo da lista |

Os erros voltam como `{"detail": "mensagem"}`, com status 400, 404 ou 409.

## Limitações

- Não há autenticação de verdade: o login pede só o nome de usuário, sem senha, e a API confia no `userId` enviado.
- Os dados ficam em memória. Para persistir, troque a URL do H2 em `java-api/src/main/resources/application.properties` por um arquivo (`jdbc:h2:file:./data/hitboxd`) e o catálogo Python por um banco.
