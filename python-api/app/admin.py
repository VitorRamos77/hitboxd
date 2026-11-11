"""Login do administrador, o único que pode adicionar e editar jogos.

O admin entra com ADMIN_USERNAME (padrão "admin") e ADMIN_PASSWORD. Sem
ADMIN_PASSWORD a área do admin fica desativada: não existe senha padrão.
"""

import hmac
import logging
import os
import secrets
import time
from threading import Lock

from fastapi import Header, HTTPException

log = logging.getLogger("uvicorn.error")

SESSION_TTL = 8 * 3600  # segundos
FAILURE_DELAY = 1.0  # atraso após senha errada, para dificultar tentativa e erro

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD") or ""
if not ADMIN_PASSWORD:
    log.warning("ADMIN_PASSWORD nao definida: area do administrador desativada.")

_sessions: dict[str, float] = {}  # token -> expira em (time.monotonic)
_lock = Lock()


def login(username: str, password: str) -> tuple[str, int]:
    """Devolve (token, validade em segundos) ou lança 401."""
    if not ADMIN_PASSWORD:
        raise HTTPException(503, "Área do administrador desativada: defina a variável ADMIN_PASSWORD")
    ok_user = hmac.compare_digest(username.encode(), ADMIN_USERNAME.encode())
    ok_pass = hmac.compare_digest(password.encode(), ADMIN_PASSWORD.encode())
    if not (ok_user and ok_pass):
        time.sleep(FAILURE_DELAY)
        raise HTTPException(401, "Usuário ou senha incorretos")
    token = secrets.token_urlsafe(32)
    with _lock:
        now = time.monotonic()
        for expired in [t for t, exp in _sessions.items() if exp < now]:
            del _sessions[expired]
        _sessions[token] = now + SESSION_TTL
    return token, SESSION_TTL


def logout(token: str) -> None:
    with _lock:
        _sessions.pop(token, None)


def require_admin(authorization: str | None = Header(default=None)) -> str:
    """Dependência das rotas de escrita: exige 'Authorization: Bearer <token>' com o token do login de admin."""
    token = authorization.removeprefix("Bearer ").strip() if authorization else ""
    with _lock:
        expires = _sessions.get(token)
        if expires is not None and expires >= time.monotonic():
            return token
        _sessions.pop(token, None)
    raise HTTPException(401, "Sessão de administrador inválida ou expirada", headers={"WWW-Authenticate": "Bearer"})
