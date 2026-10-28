"""hitBoxd — serviço de catálogo e recomendações (FastAPI).

Também serve o frontend estático em "/".
"""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import admin, recommender, updater
from .catalog import catalog
from .images import ImageUnavailable, ShotSize, cover_path, screenshot_count, screenshot_path
from .models import (AdminLogin, AdminSession, Game, GameCreate, GameStats, GameSummary, GameWithStats,
                     RecommendationResponse, Screenshot)
from .social_client import SocialUnavailable, fetch_reviews

@asynccontextmanager
async def lifespan(_: FastAPI):
    updater.start()  # atualização automática dos tempos do HowLongToBeat
    yield


app = FastAPI(
    title="hitBoxd — Catálogo",
    description="Catálogo de jogos, estatísticas da comunidade e recomendações.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def _all_reviews() -> tuple[list[dict], bool]:
    try:
        return fetch_reviews(), True
    except SocialUnavailable:
        return [], False


@app.get("/api/health")
def health():
    _, social_online = _all_reviews()
    return {"status": "ok", "games": len(catalog.all()), "socialOnline": social_online}


# a listagem omite os textos longos e as screenshots, que só a página do jogo usa
@app.get("/api/games", response_model=list[GameSummary])
def list_games(
    q: str | None = Query(None, description="Busca por título ou desenvolvedora"),
    genre: str | None = None,
    platform: str | None = None,
    sort: Literal["popular", "rating", "year", "title"] = "popular",
):
    games = catalog.all()
    if q:
        term = q.lower()
        games = [g for g in games if term in g.title.lower() or term in g.developer.lower()]
    if genre:
        games = [g for g in games if genre in g.genres]
    if platform:
        games = [g for g in games if platform in g.platforms]

    reviews, _ = _all_reviews()
    stats = recommender.community_stats(reviews)
    result = [recommender.with_stats(g, stats) for g in games]

    if sort == "popular":
        result.sort(key=lambda g: (g.reviewCount, g.average or 0), reverse=True)
    elif sort == "rating":
        result.sort(key=lambda g: (g.average is not None, g.average or 0, g.reviewCount), reverse=True)
    elif sort == "year":
        result.sort(key=lambda g: g.year, reverse=True)
    else:
        result.sort(key=lambda g: g.title.lower())
    return result


@app.post("/api/admin/login", response_model=AdminSession)
def admin_login(data: AdminLogin):
    token, ttl = admin.login(data.username, data.password)
    return AdminSession(token=token, username=data.username, expiresIn=ttl)


@app.get("/api/admin/session", status_code=204, dependencies=[Depends(admin.require_admin)])
def admin_session():
    """Só confirma que o token ainda vale (204) ou não (401)."""


@app.delete("/api/admin/session", status_code=204)
def admin_logout(token: str = Depends(admin.require_admin)):
    admin.logout(token)


@app.get("/api/admin/updates", dependencies=[Depends(admin.require_admin)])
def update_status():
    """Situação da atualização automática dos tempos do HowLongToBeat."""
    return updater.status


@app.post("/api/admin/updates/hltb", status_code=202, dependencies=[Depends(admin.require_admin)])
def update_hltb_now():
    """Pede uma atualização imediata; ela roda em segundo plano."""
    updater.run_now()
    return updater.status


def _check_title(title: str, ignore_id: int | None = None) -> None:
    if any(g.title.lower() == title.lower() and g.id != ignore_id for g in catalog.all()):
        raise HTTPException(409, "Já existe um jogo com esse título")


@app.post("/api/games", response_model=Game, status_code=201, dependencies=[Depends(admin.require_admin)])
def create_game(data: GameCreate):
    _check_title(data.title)
    return catalog.add(data)


@app.put("/api/games/{game_id}", response_model=Game, dependencies=[Depends(admin.require_admin)])
def update_game(game_id: int, data: GameCreate):
    if not catalog.get(game_id):
        raise HTTPException(404, "Jogo não encontrado")
    _check_title(data.title, ignore_id=game_id)
    return catalog.update(game_id, data)


@app.get("/api/games/{game_id}", response_model=GameWithStats)
def get_game(game_id: int):
    game = catalog.get(game_id)
    if not game:
        raise HTTPException(404, "Jogo não encontrado")
    reviews, _ = _all_reviews()
    return recommender.with_stats(game, recommender.community_stats(reviews))


IMAGE_CACHE = {"Cache-Control": "public, max-age=86400"}


def _game_or_404(game_id: int) -> Game:
    game = catalog.get(game_id)
    if not game:
        raise HTTPException(404, "Jogo não encontrado")
    return game


@app.get("/api/games/{game_id}/cover", response_class=FileResponse)
def game_cover(game_id: int):
    game = _game_or_404(game_id)
    try:
        path = cover_path(game)
    except ImageUnavailable as exc:
        raise HTTPException(404, f"Capa indisponível: {exc}") from exc
    return FileResponse(path, media_type="image/webp", headers=IMAGE_CACHE)


@app.get("/api/games/{game_id}/screenshots", response_model=list[Screenshot])
def game_screenshots(game_id: int):
    game = _game_or_404(game_id)
    base = f"/api/games/{game_id}/screenshots"
    return [Screenshot(thumb=f"{base}/{i}?size=thumb", full=f"{base}/{i}?size=full")
            for i in range(screenshot_count(game))]


@app.get("/api/games/{game_id}/screenshots/{index}", response_class=FileResponse)
def game_screenshot(game_id: int, index: int, size: ShotSize = "thumb"):
    game = _game_or_404(game_id)
    try:
        path = screenshot_path(game, index, size)
    except ImageUnavailable as exc:
        raise HTTPException(404, f"Imagem indisponível: {exc}") from exc
    return FileResponse(path, media_type="image/webp", headers=IMAGE_CACHE)


@app.get("/api/games/{game_id}/stats", response_model=GameStats)
def game_stats(game_id: int):
    if not catalog.get(game_id):
        raise HTTPException(404, "Jogo não encontrado")
    try:
        reviews = fetch_reviews(game_id=game_id)
    except SocialUnavailable:
        reviews = []
    return recommender.stats_for(game_id, reviews)


@app.get("/api/games/{game_id}/similar", response_model=list[GameSummary])
def similar_games(game_id: int, limit: int = Query(6, ge=1, le=20)):
    """Jogos parecidos: gêneros e desenvolvedora em comum e avaliações parecidas na comunidade."""
    _game_or_404(game_id)
    reviews, _ = _all_reviews()
    stats = recommender.community_stats(reviews)
    return [recommender.with_stats(g, stats) for g, _ in recommender.similar(game_id, catalog.all(), reviews, limit)]


@app.get("/api/genres", response_model=list[str])
def list_genres():
    return catalog.genres()


@app.get("/api/platforms", response_model=list[str])
def list_platforms():
    return catalog.platforms()


@app.get("/api/recommendations/{user_id}", response_model=RecommendationResponse)
def recommendations(user_id: int, limit: int = Query(8, ge=1, le=30)):
    reviews, social_online = _all_reviews()
    items = recommender.recommend(user_id, catalog.all(), reviews, limit)
    return RecommendationResponse(userId=user_id, socialOnline=social_online, items=items)


FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
