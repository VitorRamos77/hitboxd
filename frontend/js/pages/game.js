// Página de um jogo.

import { CATALOG_API } from "../config.js";
import { canAdmin, currentUser, state } from "../state.js";
import { app } from "../dom.js";
import { esc, formatRating, stars } from "../utils.js";
import { catalog, social } from "../api.js";
import { cover, gameCard, hltbBox, listCard, reviewItem, section } from "../components.js";
import { addToListModal, logModal, openLightbox } from "../modals.js";
import { requireUser } from "../session.js";
import { viewToken } from "../router.js";

export async function gamePage(id) {
  const isCurrent = viewToken(); // se a pessoa já mudou de página, não desenha esta
  const [game, stats, reviews, lists] = await Promise.all([
    catalog(`/api/games/${id}`),
    catalog(`/api/games/${id}/stats`),
    social(`/api/reviews?gameId=${id}`).catch(() => []),
    social(`/api/lists?gameId=${id}`).catch(() => []),
  ]);
  state.games.set(game.id, game);
  const user = currentUser();
  const mine = user ? reviews.filter((r) => r.userId === user.id) : [];
  const maxBucket = Math.max(1, ...Object.values(stats.distribution));

  if (!isCurrent()) return;
  app.innerHTML = `
    <div class="game-head">
      <div>${cover(game, "big")}</div>
      <div>
        <h1>${esc(game.title)}</h1>
        <div class="game-sub">${game.year} · ${esc(game.developer)}</div>
        <div class="chips">${game.genres.map((g) => `<a class="chip" href="#/games?genre=${encodeURIComponent(g)}">${esc(g)}</a>`).join("")}</div>
        <p class="game-summary">${esc(game.summary)}</p>
        <div class="faint">Plataformas: ${game.platforms.map(esc).join(", ")}</div>
        <div class="game-actions">
          <button class="btn primary" id="log-game">${mine.length ? "★ Avaliar de novo" : "★ Avaliar jogo"}</button>
          <a class="btn" href="#/diary/${game.id}">📓 Diário do jogo</a>
          ${canAdmin() ? `<a class="btn admin-edit" href="#/admin/game/${game.id}">✎ Editar página</a>` : ""}
          <button class="btn" id="add-to-list">Adicionar a uma lista</button>
          ${mine.length ? `<span class="muted">Sua nota: ${stars(mine[0].rating) || "—"} ${mine[0].liked ? '<span class="liked">♥</span>' : ""}</span>` : ""}
        </div>
        <div class="stat-box">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <span class="avg">${stats.average != null ? formatRating(stats.average) : "—"} <span style="font-size:18px">${stars(stats.average, { number: false })}</span></span>
            <span class="faint">${stats.reviewCount} registros · ${stats.likeCount} ♥</span>
          </div>
          <div class="histogram" aria-label="Distribuição das notas">
            ${Object.entries(stats.distribution).map(([k, v]) => `<div style="height:${(v / maxBucket) * 100}%" title="${k}★: ${v}"></div>`).join("")}
          </div>
          <div class="histogram-labels"><span>½★</span><span>★★★★★</span></div>
        </div>
      </div>
    </div>
    <div id="gallery"></div>
    <div class="two-col">
      <div>
        ${game.description || game.audience ? section("Sobre o jogo", `
          ${game.description ? `<p class="game-description">${esc(game.description)}</p>` : ""}
          ${game.audience ? `<div class="audience"><h3>Para quem é</h3><p>${esc(game.audience)}</p></div>` : ""}`) : ""}
        ${section("Avaliações da comunidade",
          reviews.length ? reviews.map((r) => reviewItem(r, { showGame: false })).join("") : '<div class="empty">Ninguém registrou este jogo ainda. Seja o primeiro!</div>')}
      </div>
      <div>
        ${game.hltb ? section("Quanto tempo leva", hltbBox(game.hltb)) : ""}
        ${section("Aparece nas listas",
          lists.length ? `<div style="display:grid;gap:14px">${lists.map(listCard).join("")}</div>` : '<div class="empty">Em nenhuma lista ainda.</div>')}
      </div>
    </div>
    <div id="similar"></div>`;

  document.getElementById("log-game").addEventListener("click", () => requireUser() && logModal(game));
  document.getElementById("add-to-list").addEventListener("click", () => requireUser() && addToListModal(game));

  // jogos parecidos e screenshots chegam depois, sem atrasar o resto da página
  catalog(`/api/games/${id}/similar?limit=6`).then((games) => {
    const box = document.getElementById("similar");
    if (box && games.length) box.innerHTML = section("Jogos parecidos", `<div class="grid">${games.map((g) => gameCard(g)).join("")}</div>`);
  }).catch(() => {});
  const shots = await catalog(`/api/games/${id}/screenshots`).catch(() => []);
  const gallery = document.getElementById("gallery");
  if (!gallery || !shots.length) return;
  gallery.innerHTML = section("Imagens", `<div class="gallery">${shots.map((s, i) => `
    <button class="shot" data-shot="${i}" aria-label="Ampliar imagem ${i + 1} de ${shots.length}">
      <img src="${CATALOG_API}${s.thumb}" alt="" width="480" height="270" loading="lazy" decoding="async"
           onload="this.classList.add('loaded')" onerror="this.parentNode.remove()">
    </button>`).join("")}</div>`);
  gallery.querySelectorAll("[data-shot]").forEach((btn) =>
    btn.addEventListener("click", () => openLightbox(shots, Number(btn.dataset.shot), game.title)));
}
