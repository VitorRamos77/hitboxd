"""Conteúdo da página de cada jogo: descrição, para quem é, screenshots e tempos.

Os tempos (em horas) vêm do HowLongToBeat (howlongtobeat.com), levantados uma vez
e gravados aqui: o site não tem API pública. Cada jogo guarda o id da sua página
para o link "ver no HowLongToBeat".
"""

WIKI = "https://upload.wikimedia.org/wikipedia/"

# título -> (id no HowLongToBeat, história principal, história + extras, 100%)
HLTB = {
    "The Legend of Zelda: Breath of the Wild": (38019, 50.32, 98.42, 193.59),
    "Elden Ring": (68151, 60.12, 101.36, 136.19),
    "Hades": (62941, 23.6, 48.63, 95.34),
    "Hollow Knight": (26286, 26.98, 41.63, 65.63),
    "Celeste": (42818, 8.32, 14.69, 39.21),
    "Stardew Valley": (34716, 53.38, 94.87, 172.73),
    "The Witcher 3: Wild Hunt": (10270, 51.67, 103.77, 175.2),
    "Red Dead Redemption 2": (27100, 50.75, 84.63, 196.19),
    "Disco Elysium": (57335, 23.74, 33.31, 48.42),
    "Portal 2": (7231, 8.58, 13.77, 23.01),
    "Minecraft": (6064, 65.4, 143.32, 288.71),
    "God of War": (38050, 20.57, 32.91, 51.04),
    "Persona 5 Royal": (66630, 101.3, 122.6, 140.39),
    "Outer Wilds": (57527, 17.08, 22.74, 29.15),
    "Baldur's Gate 3": (68033, 73.24, 117.29, 181.04),
    "Super Mario Odyssey": (42833, 12.47, 26.86, 62.0),
    "Sekiro: Shadows Die Twice": (57415, 30.25, 43.02, 69.75),
    "Undertale": (30385, 7.04, 11.32, 20.69),
    "Cyberpunk 2077": (2127, 26.16, 63.25, 109.04),
    "Tetris Effect": (57523, 2.81, 9.83, 52.16),
    "Inside": (21694, 3.56, 4.04, 4.69),
    "Final Fantasy VII Remake": (57686, 32.28, 41.12, 85.68),
    "Dead Cells": (45727, 14.12, 32.28, 91.89),
    "It Takes Two": (80199, 12.84, 14.22, 16.48),
}

# jogos fora da Steam: screenshots da Wikipedia (os da Steam vêm da API da loja)
SCREENSHOTS = {
    "The Legend of Zelda: Breath of the Wild": [
        WIKI + "en/b/b3/Breath_of_the_Wild_paraglide.jpg",
        WIKI + "en/c/ce/Climbing_in_BotW.jpg",
    ],
    "Super Mario Odyssey": [
        WIKI + "en/7/79/Super_Mario_Odyssey%2C_Seaside_Kingdom.png",
        WIKI + "en/a/a9/Super_Mario_Odyssey%2C_Cascade_Kingdom.png",
    ],
    "Minecraft": [
        WIKI + "commons/c/cd/Screenshot_from_the_Minecraft_Nether.png",
        WIKI + "commons/0/0f/Screenshot_from_the_Minecraft_End.png",
    ],
}

# título -> (descrição, para quem é)
TEXTS = {
    "The Legend of Zelda: Breath of the Wild": (
        "Hyrule é um mapa enorme e quase sem trilhos: depois do planalto inicial, você pode ir direto ao castelo "
        "enfrentar Ganon ou passar dezenas de horas escalando montanhas, cozinhando, domando cavalos e resolvendo "
        "os santuários espalhados pelo reino. A física e a química do mundo (fogo, vento, metal, eletricidade) "
        "transformam quase todo obstáculo num pequeno quebra-cabeça com várias soluções.",
        "Para quem gosta de explorar sem que o jogo diga para onde ir, de experimentar soluções criativas e de "
        "descobrir segredos por curiosidade. Quem prefere uma história guiada e cheia de cenas pode sentir falta de rumo.",
    ),
    "Elden Ring": (
        "Um RPG de ação da FromSoftware em mundo aberto: as Terras Intermédias se dividem em regiões cheias de "
        "masmorras, castelos e chefes opcionais, e a história é contada aos pedaços, por itens e diálogos curtos. "
        "O combate é exigente, mas o mundo aberto deixa você sair, ficar mais forte e voltar depois.",
        "Para quem gosta de desafio, de aprender padrões de chefes e de montar builds. Também é a porta de entrada "
        "mais acessível aos soulslike, porque dá para contornar o que está difícil demais. Quem não tem paciência "
        "para morrer muitas vezes vai sofrer.",
    ),
    "Hades": (
        "Zagreus tenta fugir do submundo grego em corridas que recomeçam a cada morte. Cada tentativa oferece "
        "bênçãos diferentes dos deuses do Olimpo, armas com estilos próprios e salas geradas na hora. Entre uma "
        "fuga e outra, a casa de Hades evolui e os personagens reagem a tudo o que aconteceu.",
        "Para quem curte ação rápida e partidas curtas que se encaixam numa pausa. Também agrada quem nunca gostou "
        "de roguelikes, porque morrer faz a história andar e o modo Deus deixa tudo mais tranquilo.",
    ),
    "Hollow Knight": (
        "Um metroidvania desenhado à mão no reino subterrâneo e decadente de Hallownest. Você explora um mapa "
        "interligado, encontra habilidades que abrem caminhos novos e enfrenta mais de quarenta chefes. O mapa "
        "precisa ser comprado e atualizado, o que deixa a sensação de estar realmente perdido.",
        "Para quem gosta de exploração cuidadosa, de combate preciso e de atmosfera melancólica. Exige paciência, "
        "porque se perder e voltar várias vezes faz parte da experiência.",
    ),
    "Celeste": (
        "Madeline decide escalar a montanha Celeste e, no caminho, enfrenta a própria ansiedade. A jogabilidade é "
        "de plataforma precisa, com pulo, escalada e um impulso no ar. As telas são curtas, então cada morte "
        "devolve você ao começo em um segundo.",
        "Para quem gosta de plataforma difícil e de dominar um controle preciso, e para quem procura uma história "
        "sensível sobre saúde mental. O modo de assistência permite ajustar a dificuldade sem culpa.",
    ),
    "Stardew Valley": (
        "Você troca o escritório por uma fazenda abandonada numa vila do interior. Os dias passam entre plantar, "
        "criar animais, pescar, minerar e conhecer os moradores, que têm rotinas, histórias e até romances. "
        "Dá para jogar sozinho ou dividir a fazenda com amigos.",
        "Para quem quer um jogo tranquilo, de progresso constante e sem pressa. É ótimo para jogar em sessões "
        "curtas ou cooperativas, mas quem busca ação e desafio deve achar lento.",
    ),
    "The Witcher 3: Wild Hunt": (
        "Geralt de Rívia, caçador de monstros, procura a filha adotiva Ciri por um continente devastado pela guerra. "
        "As missões secundárias são escritas com o mesmo cuidado da principal, e as escolhas têm consequências que "
        "aparecem horas depois.",
        "Para quem gosta de RPG com história adulta, personagens marcantes e muito conteúdo. O combate é o ponto "
        "mais fraco, então vale mais para quem joga pela narrativa do que pela ação.",
    ),
    "Red Dead Redemption 2": (
        "Arthur Morgan é um fora da lei da gangue de Dutch van der Linde, em fuga no fim do velho oeste americano. "
        "O mundo é cheio de detalhes e o ritmo é deliberadamente lento: cavalgar, caçar, acampar e conversar fazem "
        "parte da história tanto quanto os tiroteios.",
        "Para quem gosta de imersão, de narrativa cinematográfica e de um mundo que parece vivo. Quem quer ação "
        "constante ou tem pouco tempo para jogar pode se cansar do ritmo.",
    ),
    "Disco Elysium": (
        "Um RPG sem combate: você é um detetive que acorda sem memória e precisa resolver um assassinato. Tudo "
        "acontece em diálogos e testes de habilidade, e as próprias habilidades falam com você como vozes na "
        "cabeça. A cidade de Revachol mistura política, humor e tragédia.",
        "Para quem gosta de ler, de escolhas de diálogo e de histórias densas. Quem procura ação ou não gosta de "
        "muito texto vai se frustrar.",
    ),
    "Portal 2": (
        "Com uma arma que cria dois portais ligados, você atravessa salas de teste cada vez mais engenhosas nas "
        "instalações da Aperture Science. A campanha solo tem humor afiado e personagens memoráveis, e há uma "
        "campanha cooperativa separada para duas pessoas.",
        "Para quem gosta de quebra-cabeças lógicos e de humor. É curto e acessível, uma boa escolha para quem "
        "joga pouco ou quer algo para jogar em dupla.",
    ),
    "Minecraft": (
        "Um mundo gerado de blocos que você pode minerar, coletar e reconstruir como quiser. No modo sobrevivência "
        "é preciso arranjar comida e se proteger dos monstros à noite; no criativo, não há limite de recursos. "
        "Servidores e mods ampliam o jogo quase sem fim.",
        "Para quem gosta de construir, criar os próprios objetivos e jogar com amigos. Ótimo para todas as idades. "
        "Quem precisa de uma história ou de metas claras pode ficar sem saber o que fazer.",
    ),
    "God of War": (
        "Kratos deixa a Grécia para trás e vive nas terras nórdicas com o filho, Atreus. A viagem para espalhar as "
        "cinzas da mãe do garoto é contada num único plano-sequência, sem cortes de câmera, e mistura combate "
        "pesado, exploração e quebra-cabeças.",
        "Para quem gosta de ação com uma história bem contada e de relações entre personagens. Funciona mesmo para "
        "quem não jogou os anteriores.",
    ),
    "Persona 5 Royal": (
        "Durante o dia, você é um estudante transferido para uma escola de Tóquio que cuida dos estudos, de um "
        "trabalho de meio período e das amizades. À noite, entra no mundo cognitivo com os Ladrões Fantasmas para "
        "roubar os desejos corrompidos de adultos poderosos, com batalhas por turnos muito estilosas.",
        "Para quem gosta de JRPG, de gerenciar o calendário e de criar laços com personagens ao longo de mais de "
        "cem horas. Pede tempo e paciência com o ritmo.",
    ),
    "Outer Wilds": (
        "O sistema solar explode a cada 22 minutos e você volta ao começo, mas sem perder o que aprendeu. Não há "
        "itens nem melhorias: o único progresso é o conhecimento sobre os planetas e sobre a civilização antiga "
        "que viveu ali.",
        "Para quem gosta de mistério, de investigar e de ligar pistas por conta própria. É melhor jogar sabendo o "
        "mínimo possível. Quem detesta se perder ou repetir trechos pode se frustrar.",
    ),
    "Baldur's Gate 3": (
        "Um RPG baseado em Dungeons & Dragons, com combate tático por turnos e uma liberdade rara: quase toda "
        "situação pode ser resolvida com diálogo, furtividade, magia ou criatividade. As companhias têm histórias "
        "próprias que mudam conforme as suas escolhas, e dá para jogar a campanha em cooperativo.",
        "Para quem gosta de RPG de mesa, de escolhas que importam e de combate estratégico. Pede tempo, mas "
        "recompensa quem experimenta.",
    ),
    "Super Mario Odyssey": (
        "Mario viaja em um navio-chapéu por reinos muito diferentes, de uma cidade inspirada em Nova York a um "
        "deserto. Com Cappy, ele captura inimigos e objetos para usar os poderes deles. Cada reino é cheio de "
        "luas escondidas para encontrar.",
        "Para quem gosta de plataforma 3D criativa e de colecionar segredos. É acessível para crianças e novatos e "
        "tem desafios opcionais para os mais experientes.",
    ),
    "Sekiro: Shadows Die Twice": (
        "Um shinobi enfrenta o Japão feudal num combate baseado em postura: aparar golpes no tempo certo é mais "
        "importante que causar dano. Não há criação de personagem nem multijogador, só a habilidade de quem joga, "
        "uma prótese com ferramentas e a chance de reviver uma vez.",
        "Para quem gosta de combate exigente e de dominar uma mecânica até a perfeição. É o mais difícil da "
        "FromSoftware para iniciantes, porque não dá para subir de nível e voltar mais forte.",
    ),
    "Undertale": (
        "Uma criança cai no subterrâneo onde os monstros vivem presos. As batalhas misturam turnos com trechos de "
        "desviar de projéteis, e você pode poupar todos os inimigos conversando com eles. O jogo lembra das suas "
        "escolhas, inclusive entre partidas.",
        "Para quem gosta de humor, personagens carismáticos, trilha sonora marcante e jogos que brincam com o "
        "próprio formato. É curto e vale ser jogado mais de uma vez.",
    ),
    "Cyberpunk 2077": (
        "V é uma mercenária ou mercenário em Night City, uma metrópole controlada por corporações. Um chip "
        "experimental na cabeça traz a consciência de um rockstar morto e uma contagem regressiva. É um RPG em "
        "primeira pessoa com muitos caminhos: tiroteio, invasão de sistemas ou furtividade.",
        "Para quem gosta de ficção científica, de cidades densas e de histórias com escolhas. As atualizações e a "
        "expansão Phantom Liberty deixaram o jogo bem mais redondo do que no lançamento.",
    ),
    "Tetris Effect": (
        "O Tetris clássico, cercado por música, cenários e efeitos visuais que reagem a cada peça encaixada. A "
        "jornada principal passa por fases com climas bem diferentes, e há modos extras para treinar, relaxar ou "
        "competir.",
        "Para quem gosta de puzzle, de música e de jogos para relaxar. Ótimo em partidas rápidas; jogar com fone "
        "faz muita diferença.",
    ),
    "Inside": (
        "Um garoto foge por um mundo cinzento e sem diálogos, cheio de experimentos sinistros. É um jogo de "
        "plataforma com quebra-cabeças ambientais, e a história é contada só pelas imagens e pelo som.",
        "Para quem gosta de atmosfera, de mistério e de experiências curtas que dá para terminar numa tarde. O "
        "final rende boas discussões.",
    ),
    "Final Fantasy VII Remake": (
        "A primeira parte da releitura de Final Fantasy VII acontece toda na cidade de Midgar. Cloud e o grupo "
        "AVALANCHE enfrentam a corporação Shinra num combate que mistura ação em tempo real com pausas táticas "
        "para comandos.",
        "Para fãs de JRPG e de histórias com personagens fortes, mesmo sem ter jogado o original. Quem conhece o "
        "clássico vai notar que a história traz surpresas.",
    ),
    "Dead Cells": (
        "Um roguelike com estrutura de metroidvania: a cada morte, a ilha muda e você recomeça, mas guarda as "
        "células gastas para liberar armas e melhorias permanentes. O combate é rápido e há muitas armas e "
        "caminhos diferentes.",
        "Para quem gosta de ação ágil, de repetir corridas e de dominar um jogo aos poucos. A dificuldade sobe "
        "bastante para quem quer ir até o fim.",
    ),
    "It Takes Two": (
        "Um casal à beira do divórcio é transformado em bonecos e precisa cooperar para voltar ao normal. Só se "
        "joga em dupla, em tela dividida, e cada fase traz uma mecânica nova pensada para os dois jogadores se "
        "complementarem.",
        "Para jogar com alguém: parceiro, amigo ou família, inclusive quem joga pouco. Basta uma cópia para os "
        "dois, com o Passe de Amigo.",
    ),
}
