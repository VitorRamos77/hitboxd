"""Estatísticas da comunidade e recomendações personalizadas.

A recomendação mistura três sinais:
- afinidade do usuário com gêneros e desenvolvedoras (a partir das próprias notas);
- o que jogadores com gosto parecido avaliaram bem;
- a nota média da comunidade.
"""

import math
from collections import defaultdict

from .models import Game, GameStats, GameWithStats, Recommendation

HALF_STARS = [str(x / 2) for x in range(1, 11)]


def community_stats(reviews: list[dict]) -> dict[int, GameStats]:
    grouped: dict[int, list[dict]] = defaultdict(list)
    for review in reviews:
        grouped[review["gameId"]].append(review)
    return {game_id: stats_for(game_id, items) for game_id, items in grouped.items()}


def stats_for(game_id: int, reviews: list[dict]) -> GameStats:
    rated = [r["rating"] for r in reviews if r.get("rating") is not None]
    distribution = {key: 0 for key in HALF_STARS}
    for rating in rated:
        key = str(min(max(round(rating * 2) / 2, 0.5), 5.0))
        distribution[key] += 1
    return GameStats(
        gameId=game_id,
        average=round(sum(rated) / len(rated), 2) if rated else None,
        reviewCount=len(reviews),
        likeCount=sum(1 for r in reviews if r.get("liked")),
        distribution=distribution,
    )


def with_stats(game: Game, stats: dict[int, GameStats]) -> GameWithStats:
    s = stats.get(game.id)
    return GameWithStats(
        **game.model_dump(),
        average=s.average if s else None,
        reviewCount=s.reviewCount if s else 0,
    )


def _preference(review: dict) -> float:
    """Converte uma avaliação em gosto: positivo acima de 2.5 estrelas, negativo abaixo."""
    value = (review["rating"] - 2.75) if review.get("rating") is not None else 0.0
    if review.get("liked"):
        value += 0.75
    return value


def recommend(user_id: int, games: list[Game], reviews: list[dict], limit: int = 8) -> list[Recommendation]:
    stats = community_stats(reviews)
    by_id = {g.id: g for g in games}
    mine = [r for r in reviews if r["userId"] == user_id and r["gameId"] in by_id]
    seen = {r["gameId"] for r in mine}

    genre_affinity: dict[str, float] = defaultdict(float)
    dev_affinity: dict[str, float] = defaultdict(float)
    for review in mine:
        game = by_id[review["gameId"]]
        pref = _preference(review)
        for genre in game.genres:
            genre_affinity[genre] += pref / len(game.genres)
        dev_affinity[game.developer] += pref

    neighbor_score = _neighbor_scores(user_id, mine, reviews)

    results = []
    for game in games:
        if game.id in seen:
            continue
        s = stats.get(game.id)
        genre_part = sum(genre_affinity.get(g, 0.0) for g in game.genres) / max(len(game.genres), 1)
        dev_part = 0.5 * dev_affinity.get(game.developer, 0.0)
        neighbor_part = neighbor_score.get(game.id, 0.0)
        community_part = 0.0
        if s and s.average is not None:
            # a confiança na média cresce com o número de avaliações
            community_part = (s.average - 2.75) * min(1.0, math.log1p(s.reviewCount) / 2)
        score = 1.2 * genre_part + dev_part + neighbor_part + 0.6 * community_part

        reason = _reason(game, genre_affinity, dev_affinity, neighbor_part, s)
        results.append(Recommendation(game=with_stats(game, stats), score=round(score, 3), reason=reason))

    results.sort(key=lambda r: (r.score, r.game.reviewCount), reverse=True)
    return results[:limit]


def _neighbor_scores(user_id: int, mine: list[dict], reviews: list[dict]) -> dict[int, float]:
    """Filtragem colaborativa simples: similaridade entre usuários pelos jogos em comum."""
    my_pref = {r["gameId"]: _preference(r) for r in mine}
    if not my_pref:
        return {}

    by_user: dict[int, dict[int, float]] = defaultdict(dict)
    for review in reviews:
        if review["userId"] != user_id:
            by_user[review["userId"]][review["gameId"]] = _preference(review)

    scores: dict[int, float] = defaultdict(float)
    for prefs in by_user.values():
        common = my_pref.keys() & prefs.keys()
        if not common:
            continue
        dot = sum(my_pref[g] * prefs[g] for g in common)
        norm = math.sqrt(sum(my_pref[g] ** 2 for g in common)) * math.sqrt(sum(prefs[g] ** 2 for g in common))
        similarity = dot / norm if norm else 0.0
        if similarity <= 0:
            continue
        for game_id, pref in prefs.items():
            if game_id not in my_pref and pref > 0:
                scores[game_id] += similarity * pref * 0.5
    return scores


def _reason(game: Game, genre_affinity, dev_affinity, neighbor_part: float, stats: GameStats | None) -> str:
    liked_genres = [g for g in game.genres if genre_affinity.get(g, 0) > 0.3]
    if neighbor_part > 0.6:
        return "Jogadores com gosto parecido com o seu adoraram"
    if dev_affinity.get(game.developer, 0) > 1:
        return f"Você curte os jogos da {game.developer}"
    if liked_genres:
        return "Porque você curte " + " e ".join(liked_genres[:2])
    if stats and stats.average is not None:
        return f"Bem avaliado pela comunidade ({stats.average:.1f}★)"
    return "Uma descoberta para o seu diário"
