"""Login do administrador, o único que pode adicionar e editar jogos.

As credenciais vêm das variáveis de ambiente ADMIN_USERNAME (padrão "admin")
e ADMIN_PASSWORD. Sem ADMIN_PASSWORD, uma senha aleatória é gerada a cada
inicialização e mostrada no terminal, para que nunca exista uma senha padrão.
"""

import hmac
import logging
import os
import secrets
import time
from pathlib import Path
from threading import Lock

from fastapi import Header, HTTPException

log = logging.getLogger("uvicorn.error")

SESSION_TTL = 8 * 3600  # segundos
FAILURE_DELAY = 1.0  # atraso após senha errada, para dificultar tentativa e erro

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD") or ""
PASSWORD_FILE = Path(__file__).resolve().parents[1] / ".cache" / "admin-password.txt"
if not ADMIN_PASSWORD:
    ADMIN_PASSWORD = secrets.token_urlsafe(12)
    # também fica num arquivo local (a pasta .cache é ignorada pelo git), para quem não vê o terminal
    PASSWORD_FILE.parent.mkdir(parents=True, exist_ok=True)
    PASSWORD_FILE.write_text(ADMIN_PASSWORD + "\n", encoding="utf-8")
    log.warning("ADMIN_PASSWORD nao definida. Senha do admin %r nesta execucao: %s (salva em %s)",
                ADMIN_USERNAME, ADMIN_PASSWORD, PASSWORD_FILE)

_sessions: dict[str, float] = {}  # token -> expira em (time.monotonic)
_lock = Lock()


def login(username: str, password: str) -> tuple[str, int]:
    """Devolve (token, validade em segundos) ou lança 401."""
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
    """Dependência das rotas de escrita: exige 'Authorization: Bearer <token>' válido."""
    token = authorization.removeprefix("Bearer ").strip() if authorization else ""
    with _lock:
        expires = _sessions.get(token)
        if expires is None or expires < time.monotonic():
            _sessions.pop(token, None)
            raise HTTPException(401, "Sessão de administrador inválida ou expirada",
                                headers={"WWW-Authenticate": "Bearer"})
    return token
