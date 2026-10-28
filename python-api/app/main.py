"""hitBoxd — serviço de catálogo e recomendações (FastAPI).

Também serve o frontend estático em "/".
"""

from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import recommender
from .catalog import catalog
from .models import Game, GameCreate, GameStats, GameWithStats, RecommendationResponse
from .social_client import SocialUnavailable, fetch_reviews

app = FastAPI(
    title="hitBoxd — Catálogo",
    description="Catálogo de jogos, estatísticas da comunidade e recomendações.",
    version="1.0.0",
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


@app.get("/api/games", response_model=list[GameWithStats])
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


@app.post("/api/games", response_model=Game, status_code=201)
def create_game(data: GameCreate):
    if any(g.title.lower() == data.title.lower() for g in catalog.all()):
        raise HTTPException(409, "Já existe um jogo com esse título")
    return catalog.add(data)


@app.get("/api/games/{game_id}", response_model=GameWithStats)
def get_game(game_id: int):
    game = catalog.get(game_id)
    if not game:
        raise HTTPException(404, "Jogo não encontrado")
    reviews, _ = _all_reviews()
    return recommender.with_stats(game, recommender.community_stats(reviews))


@app.get("/api/games/{game_id}/stats", response_model=GameStats)
def game_stats(game_id: int):
    if not catalog.get(game_id):
        raise HTTPException(404, "Jogo não encontrado")
    try:
        reviews = fetch_reviews(game_id=game_id)
    except SocialUnavailable:
        reviews = []
    return recommender.stats_for(game_id, reviews)


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
