from typing import Annotated

from pydantic import BaseModel, Field, computed_field


class HowLongToBeat(BaseModel):
    """Tempos médios em horas, segundo o howlongtobeat.com."""

    id: int
    mainStory: float | None = None
    mainExtra: float | None = None
    completionist: float | None = None

    @computed_field
    @property
    def url(self) -> str:
        return f"https://howlongtobeat.com/game/{self.id}"


class GameCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    year: int = Field(ge=1950, le=2100)
    developer: str = Field(min_length=1, max_length=120)
    genres: list[str] = Field(default_factory=list)
    platforms: list[str] = Field(default_factory=list)
    summary: str = ""
    description: str = ""
    # que tipo de jogador deve gostar do jogo
    audience: str = ""
    # na Steam, a capa e as screenshots saem da loja; fora dela, use coverUrl e screenshotUrls
    steamAppId: int | None = Field(default=None, ge=1)
    screenshotUrls: list[Annotated[str, Field(max_length=500, pattern=r"^https://")]] = Field(default_factory=list, max_length=12)
    hltb: HowLongToBeat | None = None
    # imagem original da capa; o serviço baixa uma vez e entrega uma versão reduzida em /cover
    coverUrl: str | None = Field(default=None, max_length=500, pattern=r"^https://")
    # cor de fundo enquanto a capa carrega, ou quando o jogo não tem capa
    color: str = Field(default="#4a5568", pattern=r"^#[0-9a-fA-F]{6}$")


class Game(GameCreate):
    id: int


class GameStats(BaseModel):
    gameId: int
    average: float | None
    reviewCount: int
    likeCount: int
    # quantidade de notas em cada meia estrela, de 0.5 a 5.0
    distribution: dict[str, int]


class GameWithStats(Game):
    average: float | None = None
    reviewCount: int = 0


class GameSummary(BaseModel):
    """Versão enxuta para listagens: sem textos longos, screenshots e tempos."""

    id: int
    title: str
    year: int
    developer: str
    genres: list[str]
    platforms: list[str]
    summary: str
    coverUrl: str | None
    color: str
    average: float | None = None
    reviewCount: int = 0


class AdminLogin(BaseModel):
    username: str = Field(max_length=100)
    password: str = Field(max_length=200)


class AdminSession(BaseModel):
    token: str
    username: str
    expiresIn: int  # segundos


class Screenshot(BaseModel):
    thumb: str
    full: str


class Recommendation(BaseModel):
    game: GameWithStats
    score: float
    reason: str


class RecommendationResponse(BaseModel):
    userId: int
    socialOnline: bool
    items: list[Recommendation]
