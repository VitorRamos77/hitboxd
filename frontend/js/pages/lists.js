// Listas: as suas, as de quem você segue e a página de cada lista.

import { currentUser, state } from "../state.js";
import { app } from "../dom.js";
import { esc, formatDate, toast } from "../utils.js";
import { social } from "../api.js";
import { avatar, cover, gameCard, listCard, section } from "../components.js";
import { listModal } from "../modals.js";
import { requireUser } from "../session.js";
import { render, viewToken } from "../router.js";

/** Suas listas e as listas de quem você segue. */
export async function listsPage() {
  const isCurrent = viewToken(); // se a pessoa já mudou de página, não desenha esta
  const user = currentUser();
  const header = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <h1 class="page-title">Listas</h1>
      <button class="btn primary" id="new-list">+ Nova lista</button>
    </div>`;
  if (!user) {
    if (!isCurrent()) return;
    app.innerHTML = header + `<div class="empty">Entre na sua conta para criar listas e ver as listas de quem você segue.</div>`;
    document.getElementById("new-list").addEventListener("click", () => requireUser() && listModal());
    return;
  }

  const [lists, profile] = await Promise.all([social("/api/lists"), social(`/api/users/${user.id}`)]);
  const followed = new Set(profile.following.map((u) => u.id));
  const mine = lists.filter((l) => l.owner.id === user.id);
  const fromFollowed = lists.filter((l) => followed.has(l.owner.id));
  const followedEmpty = followed.size
    ? '<div class="empty">Quem você segue ainda não criou listas.</div>'
    : '<div class="empty">Você ainda não segue ninguém. <a class="accent-link" href="#/people">Encontrar pessoas →</a></div>';

  if (!isCurrent()) return;
  app.innerHTML = header + `
    ${section("Suas listas", mine.length ? `<div class="lists-grid">${mine.map(listCard).join("")}</div>` : '<div class="empty">Você ainda não criou listas.</div>')}
    ${section("De quem você segue", fromFollowed.length ? `<div class="lists-grid">${fromFollowed.map(listCard).join("")}</div>` : followedEmpty,
      '<a href="#/people">encontrar pessoas →</a>')}`;
  document.getElementById("new-list").addEventListener("click", () => requireUser() && listModal());
}

export async function listPage(id) {
  const isCurrent = viewToken(); // se a pessoa já mudou de página, não desenha esta
  const list = await social(`/api/lists/${id}`);
  const isOwner = list.owner.id === state.userId;
  const items = list.gameIds.map((gameId, i) => {
    const game = state.games.get(gameId);
    return `<div class="ranked-item">
      ${list.ranked ? `<span class="rank">${i + 1}</span>` : ""}
      ${isOwner ? `<button class="remove-from-list" data-remove-game="${gameId}" aria-label="Remover ${esc(game?.title)}">×</button>` : ""}
      ${game ? gameCard(game) : cover(null)}
    </div>`;
  }).join("");

  if (!isCurrent()) return;
  app.innerHTML = `
    <div class="faint"><a href="#/user/${list.owner.id}">${avatar(list.owner)} ${esc(list.owner.displayName)}</a> · criada em ${formatDate(list.createdAt)}</div>
    <h1 class="page-title" style="margin-top:10px">${esc(list.title)}</h1>
    ${list.description ? `<p class="muted user-text">${esc(list.description)}</p>` : ""}
    ${isOwner ? `<div class="game-actions" style="margin:0 0 24px"><button class="btn" id="edit-list">Editar</button><button class="btn danger" id="delete-list">Excluir lista</button></div>` : ""}
    ${items ? `<div class="grid">${items}</div>` : '<div class="empty">Lista vazia. Abra um jogo e use “Adicionar a uma lista”.</div>'}`;

  if (isOwner) {
    document.getElementById("edit-list").addEventListener("click", () => listModal(list));
    document.getElementById("delete-list").addEventListener("click", async () => {
      if (!confirm("Excluir esta lista?")) return;
      await social(`/api/lists/${list.id}`, { method: "DELETE" });
      toast("Lista excluída");
      location.hash = "#/lists";
    });
    app.querySelectorAll("[data-remove-game]").forEach((btn) => btn.addEventListener("click", async (e) => {
      e.preventDefault();
      await social(`/api/lists/${list.id}/games/${btn.dataset.removeGame}`, { method: "DELETE" });
      render();
    }));
  }
}
