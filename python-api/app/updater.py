"""Atualizações automáticas dos dados dos jogos.

Hoje atualiza os tempos do HowLongToBeat: uma tarefa em segundo plano busca,
pelo id de cada jogo, os tempos atuais no site e grava no catálogo. Os
resultados também ficam em .cache/hltb.json, para sobreviverem a um reinício.

O HowLongToBeat não tem API pública; a busca usa a biblioteca não oficial
howlongtobeatpy. Por isso a tarefa é espaçada (um jogo a cada poucos segundos,
uma vez por intervalo) e qualquer falha só mantém os tempos anteriores.

Variável de ambiente HLTB_REFRESH_HOURS: intervalo entre atualizações
(padrão 24 horas; 0 desliga a atualização automática).
"""

import json
import logging
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from .catalog import catalog
from .models import HowLongToBeat

log = logging.getLogger("uvicorn.error")

CACHE_FILE = Path(__file__).resolve().parents[1] / ".cache" / "hltb.json"
REFRESH_HOURS = float(os.getenv("HLTB_REFRESH_HOURS", "24"))
FIRST_RUN_DELAY = 15  # segundos depois de subir o serviço
PAUSE_BETWEEN_GAMES = 3  # segundos, para não sobrecarregar o site

_run_lock = threading.Lock()
_wake = threading.Event()
status = {
    "enabled": REFRESH_HOURS > 0,
    "intervalHours": REFRESH_HOURS,
    "running": False,
    "lastRunAt": None,
    "lastRunUpdated": 0,
    "lastRunFailed": 0,
    "nextRunAt": None,
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def load_cached() -> None:
    """Aplica ao catálogo os tempos gravados na última atualização."""
    if not CACHE_FILE.exists():
        return
    try:
        cached = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return
    for game in catalog.all():
        entry = game.hltb and cached.get(str(game.hltb.id))
        if entry:
            catalog.set_hltb(game.id, HowLongToBeat(id=game.hltb.id, **entry))


def _save_cache() -> None:
    data = {
        str(g.hltb.id): g.hltb.model_dump(mode="json", exclude={"id", "url"})
        for g in catalog.all() if g.hltb and g.hltb.updatedAt
    }
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(data, indent=1), encoding="utf-8")


def _fetch(hltb_id: int):
    from howlongtobeatpy import HowLongToBeat as Client  # importa só quando precisa (é pesada)

    return Client().search_from_id(hltb_id)


def refresh_hltb() -> dict:
    """Atualiza os tempos de todos os jogos que têm id do HowLongToBeat."""
    if not _run_lock.acquire(blocking=False):
        return status  # já está rodando
    updated = failed = 0
    status["running"] = True
    try:
        games = [g for g in catalog.all() if g.hltb]
        for i, game in enumerate(games):
            if i:
                time.sleep(PAUSE_BETWEEN_GAMES)
            try:
                entry = _fetch(game.hltb.id)
            except Exception as exc:  # rede, mudança no site etc.: mantém os tempos atuais
                log.warning("HowLongToBeat: falha ao atualizar %s: %s", game.title, exc)
                failed += 1
                continue
            if entry is None or not (entry.main_story or entry.main_extra or entry.completionist):
                failed += 1
                continue
            catalog.set_hltb(game.id, HowLongToBeat(
                id=game.hltb.id,
                mainStory=entry.main_story or None,
                mainExtra=entry.main_extra or None,
                completionist=entry.completionist or None,
                updatedAt=_now(),
            ))
            updated += 1
        _save_cache()
        log.info("HowLongToBeat: %d jogos atualizados, %d falhas", updated, failed)
    finally:
        status.update(running=False, lastRunAt=_now().isoformat(), lastRunUpdated=updated, lastRunFailed=failed)
        _run_lock.release()
    return status


def run_now() -> None:
    """Pede uma atualização imediata à tarefa em segundo plano."""
    _wake.set()


def _loop() -> None:
    """Roda no intervalo configurado, ou antes se o admin pedir; com intervalo 0, só quando pedido."""
    delay = FIRST_RUN_DELAY if REFRESH_HOURS > 0 else None
    while True:
        status["nextRunAt"] = (datetime.fromtimestamp(time.time() + delay, timezone.utc).isoformat()
                               if delay is not None else None)
        _wake.wait(delay)
        _wake.clear()
        refresh_hltb()
        if REFRESH_HOURS > 0:
            delay = REFRESH_HOURS * 3600


def start() -> None:
    load_cached()
    if REFRESH_HOURS <= 0:
        log.info("HowLongToBeat: atualizacao automatica desligada (HLTB_REFRESH_HOURS=0)")
    threading.Thread(target=_loop, name="hltb-updater", daemon=True).start()
