"""Capas dos jogos: baixa a imagem original uma única vez, reduz para WebP
e guarda em disco. O navegador recebe arquivos de ~15-30 KB em vez de
JPGs de 50-110 KB vindos de vários sites.
"""

import hashlib
import io
import time
import urllib.request
from pathlib import Path
from threading import Lock

from PIL import Image, ImageOps

from .models import Game

CACHE_DIR = Path(__file__).resolve().parents[1] / ".cache" / "covers"
WIDTH, HEIGHT = 360, 540  # 2:3, nítido até ~2x no maior tamanho exibido (230 px)
QUALITY = 78
MAX_BYTES = 8 * 1024 * 1024
RETRY_AFTER_FAILURE = 600  # segundos
# a Wikimedia recusa pedidos sem um User-Agent identificável
HEADERS = {"User-Agent": "hitBoxd/1.0 (academic project; game covers)"}

_locks: dict[str, Lock] = {}
_locks_guard = Lock()
_failures: dict[str, float] = {}


class CoverUnavailable(Exception):
    pass


def cover_path(game: Game) -> Path:
    """Caminho da capa reduzida; gera e guarda no primeiro pedido."""
    if not game.coverUrl:
        raise CoverUnavailable("Jogo sem capa")

    key = hashlib.sha1(f"{game.coverUrl}|{game.color}|{WIDTH}x{HEIGHT}|{QUALITY}".encode()).hexdigest()[:20]
    path = CACHE_DIR / f"{key}.webp"
    if path.exists():
        return path
    if time.monotonic() - _failures.get(key, -RETRY_AFTER_FAILURE) < RETRY_AFTER_FAILURE:
        raise CoverUnavailable("Falha recente ao baixar a capa")

    with _locks_guard:
        lock = _locks.setdefault(key, Lock())
    with lock:  # evita baixar a mesma capa duas vezes em pedidos simultâneos
        if path.exists():
            return path
        try:
            image = _resize(_download(game.coverUrl), game.color)
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(".tmp")
            image.save(tmp, "WEBP", quality=QUALITY, method=6)
            tmp.replace(path)
            return path
        except (OSError, ValueError) as exc:  # URLError e HTTPError herdam de OSError
            _failures[key] = time.monotonic()
            raise CoverUnavailable(str(exc)) from exc


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


def _resize(image: Image.Image, color: str) -> Image.Image:
    image = image.convert("RGBA")
    ratio = image.width / image.height
    target = WIDTH / HEIGHT
    if abs(ratio - target) / target <= 0.25:
        # proporção parecida com 2:3: recorta as bordas e preenche tudo
        return ImageOps.fit(image, (WIDTH, HEIGHT), Image.Resampling.LANCZOS).convert("RGB")
    # capa quadrada ou logo: encaixa inteira sobre a cor do jogo, sem cortar
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), color)
    contained = ImageOps.contain(image, (WIDTH - 24, HEIGHT - 24), Image.Resampling.LANCZOS)
    canvas.alpha_composite(contained, ((WIDTH - contained.width) // 2, (HEIGHT - contained.height) // 2))
    return canvas.convert("RGB")
