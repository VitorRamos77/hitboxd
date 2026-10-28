"""Catálogo de jogos em memória, com dados iniciais.

O serviço Python é o dono do catálogo: os outros serviços referenciam
os jogos apenas pelo id.
"""

from threading import Lock

from .models import Game, GameCreate


def _steam(app_id: int) -> str:
    """Arte vertical (600x900) da loja Steam."""
    return f"https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{app_id}/library_600x900.jpg"


# capas da Wikipedia para jogos que não estão na Steam
WIKI = "https://upload.wikimedia.org/wikipedia/en/"

_SEED = [
    {"title": "The Legend of Zelda: Breath of the Wild", "year": 2017, "developer": "Nintendo",
     "genres": ["Aventura", "Ação", "Mundo aberto"], "platforms": ["Switch", "Wii U"],
     "summary": "Link acorda após um século e explora livremente um reino de Hyrule em ruínas.",
     "coverUrl": WIKI + "c/c6/The_Legend_of_Zelda_Breath_of_the_Wild.jpg",
     "color": "#3f8f6b"},
    {"title": "Elden Ring", "year": 2022, "developer": "FromSoftware",
     "genres": ["RPG", "Ação", "Mundo aberto", "Soulslike"], "platforms": ["PC", "PS5", "Xbox Series"],
     "summary": "Um Maculado percorre as Terras Intermédias em busca dos fragmentos do Anel Prístino.",
     "coverUrl": _steam(1245620),
     "color": "#b0893b"},
    {"title": "Hades", "year": 2020, "developer": "Supergiant Games",
     "genres": ["Roguelike", "Ação", "Indie"], "platforms": ["PC", "Switch", "PS5"],
     "summary": "Zagreus tenta escapar do submundo grego, uma tentativa de cada vez.",
     "coverUrl": _steam(1145360),
     "color": "#a8323e"},
    {"title": "Hollow Knight", "year": 2017, "developer": "Team Cherry",
     "genres": ["Metroidvania", "Ação", "Indie"], "platforms": ["PC", "Switch", "PS4"],
     "summary": "Um pequeno cavaleiro desce às profundezas do reino arruinado de Hallownest.",
     "coverUrl": _steam(367520),
     "color": "#3b4a7a"},
    {"title": "Celeste", "year": 2018, "developer": "Maddy Makes Games",
     "genres": ["Plataforma", "Indie"], "platforms": ["PC", "Switch", "PS4"],
     "summary": "Madeline escala a montanha Celeste enquanto enfrenta a própria ansiedade.",
     "coverUrl": _steam(504230),
     "color": "#c2507a"},
    {"title": "Stardew Valley", "year": 2016, "developer": "ConcernedApe",
     "genres": ["Simulação", "RPG", "Indie"], "platforms": ["PC", "Switch", "Mobile"],
     "summary": "Você herda a fazenda do avô e reconstrói a vida em uma pequena vila.",
     "coverUrl": _steam(413150),
     "color": "#5a9b3c"},
    {"title": "The Witcher 3: Wild Hunt", "year": 2015, "developer": "CD Projekt Red",
     "genres": ["RPG", "Ação", "Mundo aberto"], "platforms": ["PC", "PS5", "Xbox Series", "Switch"],
     "summary": "Geralt de Rívia procura Ciri enquanto a Caçada Selvagem avança pelo continente.",
     "coverUrl": _steam(292030),
     "color": "#7a5a3a"},
    {"title": "Red Dead Redemption 2", "year": 2018, "developer": "Rockstar Games",
     "genres": ["Ação", "Aventura", "Mundo aberto"], "platforms": ["PC", "PS4", "Xbox One"],
     "summary": "Arthur Morgan e a gangue Van der Linde fogem pelo oeste americano em declínio.",
     "coverUrl": _steam(1174180),
     "color": "#8f3a2a"},
    {"title": "Disco Elysium", "year": 2019, "developer": "ZA/UM",
     "genres": ["RPG", "Narrativo"], "platforms": ["PC", "PS5", "Switch"],
     "summary": "Um detetive amnésico investiga um assassinato numa cidade em decadência.",
     "coverUrl": _steam(632470),
     "color": "#4a6d8c"},
    {"title": "Portal 2", "year": 2011, "developer": "Valve",
     "genres": ["Puzzle", "Plataforma"], "platforms": ["PC", "PS3", "Xbox 360"],
     "summary": "Chell volta às instalações da Aperture para mais testes com a arma de portais.",
     "coverUrl": _steam(620),
     "color": "#d27a2c"},
    {"title": "Minecraft", "year": 2011, "developer": "Mojang",
     "genres": ["Sandbox", "Sobrevivência"], "platforms": ["PC", "Switch", "PS4", "Mobile"],
     "summary": "Um mundo de blocos para minerar, construir e sobreviver do jeito que quiser.",
     "coverUrl": WIKI + "b/be/Minecraft_game_logo_2023.png",
     "color": "#6b8f3a"},
    {"title": "God of War", "year": 2018, "developer": "Santa Monica Studio",
     "genres": ["Ação", "Aventura"], "platforms": ["PS4", "PC"],
     "summary": "Kratos e o filho Atreus atravessam os reinos nórdicos para espalhar cinzas.",
     "coverUrl": _steam(1593500),
     "color": "#7a2f2f"},
    {"title": "Persona 5 Royal", "year": 2020, "developer": "Atlus",
     "genres": ["RPG", "JRPG"], "platforms": ["PS4", "PS5", "PC", "Switch"],
     "summary": "Estudantes de Tóquio vivem vidas duplas como Ladrões Fantasmas de corações.",
     "coverUrl": _steam(1687950),
     "color": "#c4232f"},
    {"title": "Outer Wilds", "year": 2019, "developer": "Mobius Digital",
     "genres": ["Exploração", "Puzzle", "Indie"], "platforms": ["PC", "PS4", "Xbox One", "Switch"],
     "summary": "Um sistema solar preso num ciclo de 22 minutos esconde um mistério antigo.",
     "coverUrl": _steam(753640),
     "color": "#2f6f8f"},
    {"title": "Baldur's Gate 3", "year": 2023, "developer": "Larian Studios",
     "genres": ["RPG", "Estratégia"], "platforms": ["PC", "PS5", "Xbox Series"],
     "summary": "Um grupo infectado por um girino de devorador de mentes busca a cura em Faerûn.",
     "coverUrl": _steam(1086940),
     "color": "#6a3f8f"},
    {"title": "Super Mario Odyssey", "year": 2017, "developer": "Nintendo",
     "genres": ["Plataforma", "Aventura"], "platforms": ["Switch"],
     "summary": "Mario e Cappy viajam por reinos variados para impedir o casamento de Bowser.",
     "coverUrl": WIKI + "8/8d/Super_Mario_Odyssey.jpg",
     "color": "#d23b3b"},
    {"title": "Sekiro: Shadows Die Twice", "year": 2019, "developer": "FromSoftware",
     "genres": ["Ação", "Soulslike"], "platforms": ["PC", "PS4", "Xbox One"],
     "summary": "Um shinobi de um braço só enfrenta um Japão feudal para resgatar seu senhor.",
     "coverUrl": _steam(814380),
     "color": "#8f2a2a"},
    {"title": "Undertale", "year": 2015, "developer": "Toby Fox",
     "genres": ["RPG", "Indie"], "platforms": ["PC", "Switch", "PS4"],
     "summary": "Uma criança cai no subterrâneo dos monstros, onde ninguém precisa morrer.",
     "coverUrl": _steam(391540),
     "color": "#3a3a3a"},
    {"title": "Cyberpunk 2077", "year": 2020, "developer": "CD Projekt Red",
     "genres": ["RPG", "Ação", "Mundo aberto"], "platforms": ["PC", "PS5", "Xbox Series"],
     "summary": "V corre contra o tempo em Night City com um biochip que reescreve sua mente.",
     "coverUrl": _steam(1091500),
     "color": "#c9b520"},
    {"title": "Tetris Effect", "year": 2018, "developer": "Resonair",
     "genres": ["Puzzle", "Música"], "platforms": ["PC", "PS4", "Switch"],
     "summary": "O clássico dos blocos que caem, envolvido por música e luz.",
     "coverUrl": _steam(1003590),
     "color": "#2c4fa8"},
    {"title": "Inside", "year": 2016, "developer": "Playdead",
     "genres": ["Plataforma", "Puzzle", "Indie"], "platforms": ["PC", "PS4", "Switch"],
     "summary": "Um garoto foge de uma instituição sombria num mundo quase sem palavras.",
     "coverUrl": _steam(304430),
     "color": "#55606a"},
    {"title": "Final Fantasy VII Remake", "year": 2020, "developer": "Square Enix",
     "genres": ["RPG", "JRPG", "Ação"], "platforms": ["PS4", "PS5", "PC"],
     "summary": "Cloud e a AVALANCHE enfrentam a Shinra nas ruas de Midgar.",
     "coverUrl": _steam(1462040),
     "color": "#3a6f5a"},
    {"title": "Dead Cells", "year": 2018, "developer": "Motion Twin",
     "genres": ["Roguelike", "Metroidvania", "Ação", "Indie"], "platforms": ["PC", "Switch", "Mobile"],
     "summary": "Uma massa de células toma corpos para explorar uma ilha que muda a cada morte.",
     "coverUrl": _steam(588650),
     "color": "#4f8f8f"},
    {"title": "It Takes Two", "year": 2021, "developer": "Hazelight Studios",
     "genres": ["Cooperativo", "Plataforma", "Aventura"], "platforms": ["PC", "PS5", "Xbox Series", "Switch"],
     "summary": "Um casal em crise vira bonecos e precisa cooperar para voltar ao normal.",
     "coverUrl": _steam(1426210),
     "color": "#d2873b"},
]


class Catalog:
    def __init__(self) -> None:
        self._games: dict[int, Game] = {}
        self._next_id = 1
        self._lock = Lock()
        for data in _SEED:
            self.add(GameCreate(**data))

    def add(self, data: GameCreate) -> Game:
        with self._lock:
            game = Game(id=self._next_id, **data.model_dump())
            self._games[game.id] = game
            self._next_id += 1
            return game

    def get(self, game_id: int) -> Game | None:
        return self._games.get(game_id)

    def all(self) -> list[Game]:
        return list(self._games.values())

    def genres(self) -> list[str]:
        return sorted({g for game in self._games.values() for g in game.genres})

    def platforms(self) -> list[str]:
        return sorted({p for game in self._games.values() for p in game.platforms})


catalog = Catalog()
