"""Cliente HTTP do serviço social (Spring Boot), dono das avaliações."""

import os

import httpx

SOCIAL_API_URL = os.getenv("SOCIAL_API_URL", "http://localhost:8080")


class SocialUnavailable(Exception):
    pass


def fetch_reviews(user_id: int | None = None, game_id: int | None = None) -> list[dict]:
    params = {}
    if user_id is not None:
        params["userId"] = user_id
    if game_id is not None:
        params["gameId"] = game_id
    try:
        response = httpx.get(f"{SOCIAL_API_URL}/api/reviews", params=params, timeout=3.0)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise SocialUnavailable(str(exc)) from exc
