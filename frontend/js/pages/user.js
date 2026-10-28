// Perfil de um usuário.

import { state } from "../state.js";
import { app } from "../dom.js";
import { esc } from "../utils.js";
import { social } from "../api.js";
import { avatar, followButton, gameCard, listCard, reviewItem, section } from "../components.js";
import { followModal } from "../modals.js";
import { viewToken } from "../router.js";

export async function userPage(id) {
  const isCurrent = viewToken(); // se a pessoa já mudou de página, não desenha esta
  const [profile, diary, lists, followers] = await Promise.all([
    social(`/api/users/${id}`),
    social(`/api/users/${id}/diary`),
    social(`/api/lists?ownerId=${id}`),
    social(`/api/users/${id}/followers`),
  ]);
  const iFollow = followers.some((u) => u.id === state.userId);
  const favorites = diary.filter((r) => r.liked || r.rating >= 4.5)
    .filter((r, i, all) => all.findIndex((x) => x.gameId === r.gameId) === i)
    .slice(0, 6);

  if (!isCurrent()) return;
  app.innerHTML = `
    <div class="profile-head">
      ${avatar(profile, "big")}
      <div>
        <h1>${esc(profile.displayName)}</h1>
        <div class="faint">@${esc(profile.username)}</div>
        ${profile.bio ? `<p class="muted user-text" style="margin:6px 0 0">${esc(profile.bio)}</p>` : ""}
      </div>
      ${followButton(profile, iFollow)}
      <div class="profile-stats">
        <div><b>${profile.gamesLogged}</b><span>jogos</span></div>
        <div><b>${profile.reviewsWritten}</b><span>resenhas</span></div>
        <div><b>${profile.listsCreated}</b><span>listas</span></div>
        <button class="stat-link" data-follow-list="followers"><b>${profile.followers}</b><span>seguidores</span></button>
        <button class="stat-link" data-follow-list="following"><b>${profile.following.length}</b><span>seguindo</span></button>
      </div>
    </div>
    ${favorites.length ? section("Favoritos", `<div class="grid small">${favorites.map((r) => gameCard(state.games.get(r.gameId) ?? { id: r.gameId, title: "?", year: "", color: "#333" })).join("")}</div>`) : ""}
    <div class="two-col">
      ${section("Atividade recente", diary.length ? diary.slice(0, 8).map((r) => reviewItem(r, { showUser: false })).join("") : '<div class="empty">Nada registrado ainda.</div>')}
      ${section("Listas", lists.length ? `<div style="display:grid;gap:14px">${lists.map(listCard).join("")}</div>` : '<div class="empty">Nenhuma lista.</div>')}
    </div>`;

  app.querySelectorAll("[data-follow-list]").forEach((btn) =>
    btn.addEventListener("click", () => followModal(profile.id, btn.dataset.followList)));
}
