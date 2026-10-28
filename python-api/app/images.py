"""Capas e screenshots dos jogos.

Cada imagem é baixada da origem uma única vez, reduzida para WebP e guardada
em disco. O navegador recebe arquivos de ~15-30 KB (capas e miniaturas) em vez
de JPGs de 50 KB a 1 MB vindos de vários sites.
"""

import hashlib
import io
import json
import time
import urllib.request
from pathlib import Path
from threading import Lock
from typing import Literal

from PIL import Image, ImageOps

from .models import Game

CACHE_DIR = Path(__file__).resolve().parents[1] / ".cache"
COVER_SIZE = (360, 540)  # 2:3, nítido até ~2x no maior tamanho exibido (230 px)
SHOT_SIZES = {"thumb": (480, 270), "full": (1280, 720)}  # 16:9
MAX_SCREENSHOTS = 6
QUALITY = 78
MAX_BYTES = 8 * 1024 * 1024
RETRY_AFTER_FAILURE = 600  # segundos
STEAM_INFO_TTL = 7 * 24 * 3600
# a Wikimedia recusa pedidos sem um User-Agent identificável
HEADERS = {"User-Agent": "hitBoxd/1.0 (academic project; game covers)"}

ShotSize = Literal["thumb", "full"]

_locks: dict[str, Lock] = {}
_locks_guard = Lock()
_failures: dict[str, float] = {}


class ImageUnavailable(Exception):
    pass


def cover_path(game: Game) -> Path:
    if not game.coverUrl:
        raise ImageUnavailable("Jogo sem capa")
    return _cached(game.coverUrl, COVER_SIZE, "cover", game.color)


def screenshot_count(game: Game) -> int:
    return len(_screenshot_sources(game))


def screenshot_path(game: Game, index: int, size: ShotSize) -> Path:
    sources = _screenshot_sources(game)
    if not 0 <= index < len(sources):
        raise ImageUnavailable("Screenshot inexistente")
    thumb_url, full_url = sources[index]
    return _cached(thumb_url if size == "thumb" else full_url, SHOT_SIZES[size], "within", None)


def _screenshot_sources(game: Game) -> list[tuple[str, str]]:
    """Pares (origem da miniatura, origem da imagem grande)."""
    if game.screenshotUrls:
        return [(url, url) for url in game.screenshotUrls[:MAX_SCREENSHOTS]]
    if game.steamAppId:
        shots = _steam_screenshots(game.steamAppId)
        # a Steam já oferece uma versão 600x338: usar como origem da miniatura evita baixar a de 1920x1080
        return [(s["path_thumbnail"], s["path_full"]) for s in shots[:MAX_SCREENSHOTS]]
    return []


def _steam_screenshots(app_id: int) -> list[dict]:
    """Lista de screenshots da loja Steam, guardada em disco por uma semana."""
    path = CACHE_DIR / "steam" / f"{app_id}.json"
    if path.exists() and time.time() - path.stat().st_mtime < STEAM_INFO_TTL:
        return json.loads(path.read_text(encoding="utf-8"))
    key = f"steam:{app_id}"
    if _recently_failed(key):
        return []
    url = f"https://store.steampowered.com/api/appdetails?appids={app_id}&filters=screenshots"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=10) as response:
            data = json.load(response)[str(app_id)]
        shots = data["data"]["screenshots"] if data.get("success") else []
    except (OSError, ValueError, KeyError):
        _failures[key] = time.monotonic()
        return []
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(shots), encoding="utf-8")
    return shots


def _cached(url: str, size: tuple[int, int], mode: str, background: str | None) -> Path:
    """Caminho da imagem reduzida; gera e guarda no primeiro pedido."""
    key = hashlib.sha1(f"{url}|{size}|{mode}|{background}|{QUALITY}".encode()).hexdigest()[:20]
    path = CACHE_DIR / "images" / f"{key}.webp"
    if path.exists():
        return path
    if _recently_failed(key):
        raise ImageUnavailable("Falha recente ao baixar a imagem")

    with _locks_guard:
        lock = _locks.setdefault(key, Lock())
    with lock:  # evita baixar a mesma imagem duas vezes em pedidos simultâneos
        if path.exists():
            return path
        try:
            source = _download(url)
            image = _fill(source, size, background) if mode == "cover" else _within(source, size)
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(".tmp")
            image.save(tmp, "WEBP", quality=QUALITY, method=6)
            tmp.replace(path)
            return path
        except (OSError, ValueError) as exc:  # URLError e HTTPError herdam de OSError
            _failures[key] = time.monotonic()
            raise ImageUnavailable(str(exc)) from exc


def _recently_failed(key: str) -> bool:
    return time.monotonic() - _failures.get(key, -RETRY_AFTER_FAILURE) < RETRY_AFTER_FAILURE


def _download(url: str) -> Image.Image:
    # urllib em vez de httpx: a Wikimedia recusa (403) os pedidos do httpx mesmo com User-Agent
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=10) as response:
        if not response.headers.get("Content-Type", "").startswith("image/"):
            raise ValueError("O endereço não é uma imagem")
        data = response.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError("Imagem grande demais")
    image = Image.open(io.BytesIO(data))
    image.load()
    return image


def _fill(image: Image.Image, size: tuple[int, int], background: str | None) -> Image.Image:
    """Preenche o quadro todo; capas com proporção muito diferente são encaixadas sobre a cor."""
    image = image.convert("RGBA")
    width, height = size
    ratio = image.width / image.height
    target = width / height
    if abs(ratio - target) / target <= 0.25:
        # proporção parecida: recorta as bordas e preenche tudo
        return ImageOps.fit(image, size, Image.Resampling.LANCZOS).convert("RGB")
    # capa quadrada ou logo: encaixa inteira sobre a cor do jogo, sem cortar
    canvas = Image.new("RGBA", size, background or "#000000")
    contained = ImageOps.contain(image, (width - 24, height - 24), Image.Resampling.LANCZOS)
    canvas.alpha_composite(contained, ((width - contained.width) // 2, (height - contained.height) // 2))
    return canvas.convert("RGB")


def _within(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Reduz mantendo a proporção, sem nunca ampliar."""
    image = image.convert("RGB")
    image.thumbnail(size, Image.Resampling.LANCZOS)
    return image
