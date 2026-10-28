"""Cliente HTTP do serviço social (Spring Boot), dono das avaliações."""

import os
import time

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


_admin_cache: dict[str, tuple[float, bool]] = {}  # token -> (válido até, é admin)
ADMIN_CACHE_SECONDS = 60


def is_admin_session(token: str) -> bool:
    """Pergunta ao serviço Java se o token é de uma conta administradora (cache de 1 min)."""
    now = time.monotonic()
    cached = _admin_cache.get(token)
    if cached and cached[0] > now:
        return cached[1]
    try:
        response = httpx.get(f"{SOCIAL_API_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=3.0)
        admin = response.status_code == 200 and bool(response.json().get("admin"))
    except (httpx.HTTPError, ValueError):
        return False  # sem o serviço Java não dá para confirmar: nega, sem guardar em cache
    if len(_admin_cache) > 1000:
        _admin_cache.clear()
    _admin_cache[token] = (now + ADMIN_CACHE_SECONDS, admin)
    return admin
