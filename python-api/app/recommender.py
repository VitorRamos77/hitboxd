"""Estatísticas da comunidade e recomendações baseadas nos jogos avaliados.

A recomendação é "item a item": para cada jogo que o usuário ainda não
registrou, soma o quanto ele se parece com cada jogo que o usuário avaliou,
pesado pela nota que o usuário deu. A semelhança entre dois jogos mistura:
- conteúdo: gêneros em comum (Jaccard) e mesma desenvolvedora;
- comunidade: se quem avaliou um avaliou o outro do mesmo jeito (cosseno).
A média da comunidade entra como desempate.
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
    """Converte uma avaliação em gosto: positivo acima de 2,75 estrelas, negativo abaixo."""
    value = (review["rating"] - 2.75) if review.get("rating") is not None else 0.0
    if review.get("liked"):
        value += 0.75
    return value


def _preferences_by_user(reviews: list[dict], known: set[int]) -> dict[int, dict[int, float]]:
    """{usuário: {jogo: gosto}}; rejogos do mesmo jogo viram a média das avaliações."""
    collected: dict[int, dict[int, list[float]]] = defaultdict(lambda: defaultdict(list))
    for review in reviews:
        if review["gameId"] in known:
            collected[review["userId"]][review["gameId"]].append(_preference(review))
    return {user: {game: sum(v) / len(v) for game, v in games.items()} for user, games in collected.items()}


class Similarity:
    """Semelhança entre dois jogos, de -1 a 1, com cache."""

    CONTENT_WEIGHT = 0.65
    COMMUNITY_WEIGHT = 0.35

    def __init__(self, games: list[Game], prefs_by_user: dict[int, dict[int, float]]):
        self.by_id = {g.id: g for g in games}
        # vetor de cada jogo: {usuário: gosto}
        self.item_vectors: dict[int, dict[int, float]] = defaultdict(dict)
        for user, prefs in prefs_by_user.items():
            for game_id, pref in prefs.items():
                self.item_vectors[game_id][user] = pref
        self._cache: dict[tuple[int, int], float] = {}

    def __call__(self, a: int, b: int) -> float:
        key = (a, b) if a < b else (b, a)
        if key not in self._cache:
            self._cache[key] = self.CONTENT_WEIGHT * self.content(a, b) + self.COMMUNITY_WEIGHT * self.community(a, b)
        return self._cache[key]

    def content(self, a: int, b: int) -> float:
        ga, gb = self.by_id[a], self.by_id[b]
        genres_a, genres_b = set(ga.genres), set(gb.genres)
        union = genres_a | genres_b
        jaccard = len(genres_a & genres_b) / len(union) if union else 0.0
        same_dev = 1.0 if ga.developer.lower() == gb.developer.lower() else 0.0
        return 0.75 * jaccard + 0.25 * same_dev

    def community(self, a: int, b: int) -> float:
        va, vb = self.item_vectors.get(a, {}), self.item_vectors.get(b, {})
        common = va.keys() & vb.keys()
        if not common:
            return 0.0
        dot = sum(va[u] * vb[u] for u in common)
        norm = math.sqrt(sum(va[u] ** 2 for u in common)) * math.sqrt(sum(vb[u] ** 2 for u in common))
        cosine = dot / norm if norm else 0.0
        # com poucas pessoas em comum, a semelhança "encolhe" em direção a zero
        return cosine * len(common) / (len(common) + 2)


def recommend(user_id: int, games: list[Game], reviews: list[dict], limit: int = 8) -> list[Recommendation]:
    stats = community_stats(reviews)
    known = {g.id for g in games}
    prefs_by_user = _preferences_by_user(reviews, known)
    mine = prefs_by_user.get(user_id, {})
    sim = Similarity(games, prefs_by_user)

    results = []
    for game in games:
        if game.id in mine:
            continue
        # soma pesada pela semelhança com cada jogo avaliado pelo usuário
        weighted, total_weight, best = 0.0, 0.0, (0.0, None)
        for rated_id, pref in mine.items():
            s = sim(game.id, rated_id)
            if s <= 0:
                continue
            weighted += s * pref
            total_weight += s
            if s * pref > best[0]:
                best = (s * pref, rated_id)
        # divide por (peso + 1) para que um único jogo parecido não domine a lista
        personal = weighted / (total_weight + 1) if total_weight else 0.0

        community = 0.0
        st = stats.get(game.id)
        if st and st.average is not None:
            # a confiança na média cresce com o número de avaliações
            community = (st.average - 2.75) * min(1.0, math.log1p(st.reviewCount) / 2)
        score = (2.0 * personal + 0.35 * community) if mine else community

        if best[1] is not None:
            reason = f"Porque você gostou de {sim.by_id[best[1]].title}"
        elif st and st.average is not None:
            reason = f"Bem avaliado pela comunidade ({st.average:.1f}★)".replace(".", ",")
        else:
            reason = "Uma descoberta para o seu diário"
        results.append(Recommendation(game=with_stats(game, stats), score=round(score, 3), reason=reason))

    results.sort(key=lambda r: (r.score, r.game.reviewCount), reverse=True)
    return results[:limit]


def similar(game_id: int, games: list[Game], reviews: list[dict], limit: int = 6) -> list[tuple[Game, float]]:
    """Jogos mais parecidos com um jogo, pelo conteúdo e pelas avaliações da comunidade."""
    known = {g.id for g in games}
    sim = Similarity(games, _preferences_by_user(reviews, known))
    scored = [(g, sim(game_id, g.id)) for g in games if g.id != game_id]
    scored = [item for item in scored if item[1] > 0.1]
    scored.sort(key=lambda item: item[1], reverse=True)
    return scored[:limit]
