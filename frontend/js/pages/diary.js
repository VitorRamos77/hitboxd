// Diário de jogo.

import { STATUS_LABEL } from "../config.js";
import { currentUser, state } from "../state.js";
import { app, modal } from "../dom.js";
import { dayLabel, esc, formatHours, formatTime, toast, todayIso } from "../utils.js";
import { catalog, social } from "../api.js";
import { cover } from "../components.js";
import { logModal, openModal } from "../modals.js";
import { render, viewToken } from "../router.js";

export async function diaryPage(gameIdParam) {
  const isCurrent = viewToken(); // se a pessoa já mudou de página, não desenha esta
  const user = currentUser();
  if (!user) {
    if (!isCurrent()) return;
    app.innerHTML = `<h1 class="page-title">Diário</h1><div class="empty">Entre na sua conta para ver seu diário.</div>`;
    return;
  }
  const games = await social(`/api/users/${user.id}/journal`);
  const gameId = gameIdParam ? Number(gameIdParam) : games[0]?.gameId;

  if (!gameId) {
    if (!isCurrent()) return;
    app.innerHTML = `
      <h1 class="page-title">Diário</h1>
      <div class="empty">
        <p>Escolha um jogo que você está jogando e registre o que acontece em cada sessão:
        o que descobriu, onde travou, quanto tempo jogou.</p>
        <button class="btn primary" id="new-journal">+ Começar um diário</button>
      </div>`;
    document.getElementById("new-journal").addEventListener("click", pickJournalGame);
    return;
  }

  const game = state.games.get(gameId) ?? await catalog(`/api/games/${gameId}`);
  const entries = await social(`/api/users/${user.id}/journal/${gameId}`);
  const summary = games.find((g) => g.gameId === gameId);
  const totalHours = entries.reduce((sum, e) => sum + (e.sessionHours ?? 0), 0);
  const status = summary?.status;

  // agrupa as atualizações pelo dia da sessão (já vêm da mais recente para a mais antiga)
  const days = new Map();
  for (const entry of entries) {
    if (!days.has(entry.playedOn)) days.set(entry.playedOn, []);
    days.get(entry.playedOn).push(entry);
  }

  const sidebar = games.map((g) => {
    const item = state.games.get(g.gameId);
    return `<a class="journal-game ${g.gameId === gameId ? "active" : ""}" href="#/diary/${g.gameId}">
      ${cover(item, "mini")}
      <div class="journal-game-info">
        <b>${esc(item?.title ?? "Jogo #" + g.gameId)}</b>
        <span class="faint">${g.entryCount ? `${g.entryCount} ${g.entryCount === 1 ? "atualização" : "atualizações"}` : "sem atualizações"}${g.totalHours ? ` · ${formatHours(g.totalHours)}` : ""}</span>
      </div>
    </a>`;
  }).join("");

  const timeline = [...days].map(([day, items]) => `
    <div class="journal-day">
      <h3>${dayLabel(day)}</h3>
      ${items.map((e) => `
        <article class="journal-entry">
          <time datetime="${e.createdAt}">${formatTime(e.createdAt)}</time>
          <div class="journal-entry-body">
            <p class="${e.spoilers ? "spoiler" : ""}" ${e.spoilers ? 'title="Contém spoilers: clique para revelar"' : ""}>${esc(e.text)}</p>
            <div class="journal-entry-foot">
              ${e.sessionHours ? `<span class="chip">⏱ ${formatHours(e.sessionHours)}</span>` : ""}
              <span class="journal-entry-actions">
                <button class="link-btn" data-edit-journal="${e.id}">editar</button>
                <button class="link-btn" data-delete-journal="${e.id}">excluir</button>
              </span>
            </div>
          </div>
        </article>`).join("")}
    </div>`).join("");

  if (!isCurrent()) return;
  app.innerHTML = `
    <div class="journal-layout">
      <aside class="journal-games" aria-label="Jogos do diário">
        <div class="journal-games-head">
          <h2>Meus diários</h2>
          <button class="btn small primary" id="new-journal">+ Novo</button>
        </div>
        ${sidebar || '<div class="faint">Nenhum diário ainda.</div>'}
      </aside>
      <section class="journal-main">
        <div class="journal-head">
          <a href="#/game/${gameId}">${cover(game, "medium")}</a>
          <div class="journal-head-info">
            <div class="faint">Diário de jogo</div>
            <h1><a href="#/game/${gameId}">${esc(game?.title ?? "")}</a></h1>
            <div class="journal-stats">
              ${status ? `<span class="status ${status}">${STATUS_LABEL[status]}</span>` : ""}
              <span><b>${entries.length}</b> ${entries.length === 1 ? "atualização" : "atualizações"}</span>
              <span><b>${formatHours(totalHours)}</b> jogadas</span>
            </div>
          </div>
          <button class="btn" id="finish-game" title="Registre a situação e dê sua nota">★ Avaliar jogo</button>
        </div>

        <form class="journal-composer" id="journal-form">
          <label class="sr-only" for="journal-text">Nova atualização</label>
          <textarea id="journal-text" name="text" maxlength="2000" required placeholder="O que aconteceu nesta sessão?"></textarea>
          <div class="journal-composer-row">
            <label>Dia <input type="date" name="playedOn" value="${todayIso()}" max="${todayIso()}" required></label>
            <label>Horas jogadas <input type="number" name="sessionHours" min="0.1" max="24" step="any" placeholder="ex: 1,5"></label>
            <label class="check"><input type="checkbox" name="spoilers"> Spoilers</label>
            <button class="btn primary">Adicionar atualização</button>
          </div>
          <div class="form-error" id="journal-error"></div>
        </form>

        ${entries.length ? timeline : '<div class="empty">Nenhuma atualização ainda. Conte como foi a primeira sessão!</div>'}
      </section>
    </div>`;

  document.getElementById("new-journal").addEventListener("click", pickJournalGame);
  document.getElementById("finish-game").addEventListener("click", () => game && logModal(game));
  document.getElementById("journal-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await social("/api/journal", { method: "POST", body: journalBody(new FormData(e.target), gameId) });
      toast("Atualização adicionada ao diário");
      render();
    } catch (err) {
      document.getElementById("journal-error").textContent = err.message;
    }
  });
  app.querySelectorAll("[data-edit-journal]").forEach((btn) => btn.addEventListener("click", () =>
    journalEntryModal(entries.find((x) => x.id === Number(btn.dataset.editJournal)), game)));
  app.querySelectorAll("[data-delete-journal]").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("Excluir esta atualização do diário?")) return;
    await social(`/api/journal/${btn.dataset.deleteJournal}`, { method: "DELETE" });
    toast("Atualização excluída");
    render();
  }));
}

function journalBody(data, gameId) {
  const number = (key) => (data.get(key) === "" ? null : Number(data.get(key)));
  return {
    gameId,
    text: data.get("text"),
    playedOn: data.get("playedOn"),
    sessionHours: number("sessionHours"),
    spoilers: data.has("spoilers"),
  };
}

function journalEntryModal(entry, game) {
  openModal(`
    <h2>Editar atualização</h2>
    <div class="muted">${esc(game?.title ?? "")}</div>
    <form class="form" id="entry-form">
      <label>Texto <textarea name="text" maxlength="2000" required>${esc(entry.text)}</textarea></label>
      <div class="row">
        <label>Dia <input type="date" name="playedOn" value="${entry.playedOn}" max="${todayIso()}" required></label>
        <label>Horas jogadas <input type="number" name="sessionHours" min="0.1" max="24" step="any" value="${entry.sessionHours ?? ""}"></label>
      </div>
      <label class="check"><input type="checkbox" name="spoilers" ${entry.spoilers ? "checked" : ""}> Contém spoilers</label>
      <div class="form-error" id="form-error"></div>
      <div class="form-actions">
        <button type="button" class="btn" data-close>Cancelar</button>
        <button class="btn primary">Salvar</button>
      </div>
    </form>`, (root) => {
    root.querySelector("#entry-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await social(`/api/journal/${entry.id}`, { method: "PUT", body: journalBody(new FormData(e.target), entry.gameId) });
        modal.close();
        toast("Atualização salva");
        render();
      } catch (err) {
        root.querySelector("#form-error").textContent = err.message;
      }
    });
  });
}

/** Escolhe o jogo para começar um diário novo. */
function pickJournalGame() {
  const games = [...state.games.values()].sort((a, b) => a.title.localeCompare(b.title));
  const results = (term) => games
    .filter((g) => g.title.toLowerCase().includes(term.toLowerCase()))
    .slice(0, 8)
    .map((g) => `<button class="pick-game" data-pick="${g.id}">${cover(g, "mini")}<span><b>${esc(g.title)}</b><span class="faint">${g.year} · ${esc(g.developer)}</span></span></button>`)
    .join("") || '<div class="faint">Nenhum jogo encontrado.</div>';
  openModal(`
    <h2>Começar um diário</h2>
    <div class="muted">Qual jogo você está jogando?</div>
    <div class="form">
      <input type="search" id="pick-search" placeholder="Buscar jogo…" aria-label="Buscar jogo" autofocus>
      <div class="pick-results" id="pick-results">${results("")}</div>
      <div class="form-actions"><button type="button" class="btn" data-close>Cancelar</button></div>
    </div>`, (root) => {
    const list = root.querySelector("#pick-results");
    root.querySelector("#pick-search").addEventListener("input", (e) => { list.innerHTML = results(e.target.value); });
    list.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pick]");
      if (!btn) return;
      modal.close();
      location.hash = `#/diary/${btn.dataset.pick}`;
    });
  });
}
