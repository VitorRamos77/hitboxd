// Janelas (modais): avaliar jogo, listas, seguidores, dados da conta e ampliação de imagens.

import { CATALOG_API, STATUS_LABEL } from "./config.js";
import { state } from "./state.js";
import { lightbox, modal, modalBody } from "./dom.js";
import { esc, formatDate, toast } from "./utils.js";
import { social, uploadAvatar } from "./api.js";
import { avatar, cover, personCard, starInput } from "./components.js";
import { loadUsers } from "./session.js";
import { render } from "./router.js";

export function openLightbox(shots, start, title) {
  let index = start;
  const img = lightbox.querySelector("img");
  const show = () => {
    img.src = CATALOG_API + shots[index].full;
    img.alt = `${title}: imagem ${index + 1} de ${shots.length}`;
    lightbox.querySelector(".lightbox-count").textContent = `${index + 1} / ${shots.length}`;
  };
  const step = (delta) => { index = (index + delta + shots.length) % shots.length; show(); };
  lightbox.querySelector("[data-prev]").onclick = () => step(-1);
  lightbox.querySelector("[data-next]").onclick = () => step(1);
  lightbox.onkeydown = (e) => {
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  };
  show();
  lightbox.showModal();
}

/** Popup com quem segue o perfil e quem ele segue, aberto pelos números do perfil. */
export async function followModal(userId, tab = "followers") {
  const [profile, followers] = await Promise.all([
    social(`/api/users/${userId}`),
    social(`/api/users/${userId}/followers`),
  ]);
  const isMe = profile.id === state.userId;
  // o que importa para os botões é quem EU sigo e quem ME segue, não o dono do perfil
  const [myFollowing, myFollowers] = !state.userId ? [[], []]
    : isMe ? [profile.following, followers]
    : await Promise.all([
      social(`/api/users/${state.userId}`).then((p) => p.following),
      social(`/api/users/${state.userId}/followers`),
    ]);
  const iFollow = new Set(myFollowing.map((u) => u.id));
  const followsMe = new Set(myFollowers.map((u) => u.id));
  const list = tab === "followers" ? followers : profile.following;
  // na aba Seguidores do próprio perfil, todo mundo segue você: o aviso seria redundante
  const showFollowsMe = (u) => followsMe.has(u.id) && u.id !== state.userId && !(isMe && tab === "followers");

  // no próprio perfil, a aba "Seguindo" sugere pessoas seguidas por quem você segue
  let suggestions = "";
  if (isMe && tab === "following") {
    const theirs = await Promise.all(profile.following.map((u) => social(`/api/users/${u.id}`).catch(() => null)));
    const followedBy = new Map();
    for (const p of theirs.filter(Boolean)) {
      for (const u of p.following) if (!followedBy.has(u.id)) followedBy.set(u.id, p.displayName);
    }
    const people = state.users
      .filter((u) => u.id !== profile.id && !iFollow.has(u.id))
      .sort((a, b) => followedBy.has(b.id) - followedBy.has(a.id));
    if (people.length) {
      suggestions = `<h3 class="follow-subtitle">Sugestões para seguir</h3>
        <div class="members">${people.map((u) => personCard(u, false, followedBy.has(u.id) ? `seguido por ${followedBy.get(u.id)}` : followsMe.has(u.id) ? "segue você" : "")).join("")}</div>`;
    }
  }

  const empty = tab === "followers"
    ? (isMe ? "Ninguém segue você ainda." : `Ninguém segue ${profile.displayName} ainda.`)
    : (isMe ? "Você ainda não segue ninguém." : `${profile.displayName} ainda não segue ninguém.`);

  openModal(`
    <div class="follow-head">
      <h2>${esc(profile.displayName)}</h2>
      <button class="link-btn" data-close aria-label="Fechar">✕</button>
    </div>
    <div class="follow-tabs" role="tablist">
      <button role="tab" aria-selected="${tab === "followers"}" data-follow-tab="followers">${followers.length} seguidores</button>
      <button role="tab" aria-selected="${tab === "following"}" data-follow-tab="following">${profile.following.length} seguindo</button>
    </div>
    ${list.length
      ? `<div class="members">${list.map((u) => personCard(u, iFollow.has(u.id), showFollowsMe(u) ? "segue você" : "")).join("")}</div>`
      : `<div class="empty">${esc(empty)}</div>`}
    ${suggestions}
    <p style="margin:18px 0 0;text-align:center"><a class="accent-link" href="#/people">Encontrar mais pessoas →</a></p>`, (root) => {
    root.querySelectorAll("[data-follow-tab]").forEach((btn) =>
      btn.addEventListener("click", () => followModal(userId, btn.dataset.followTab)));
    // seguir/deixar de seguir pelo popup: atualiza o popup e a página por trás
    root.querySelectorAll("[data-follow]").forEach((btn) => btn.addEventListener("click", async () => {
      if (await toggleFollow(btn)) {
        render();
        followModal(userId, tab);
      }
    }));
    root.querySelectorAll(".member-link").forEach((link) => link.addEventListener("click", () => modal.close()));
  });
}

export async function toggleFollow(btn) {
  const following = btn.dataset.following === "true";
  const target = state.users.find((u) => u.id === Number(btn.dataset.follow));
  try {
    await social(`/api/users/${state.userId}/following/${btn.dataset.follow}`, { method: following ? "DELETE" : "POST" });
    toast(following ? `Você deixou de seguir ${target?.displayName}` : `Agora você segue ${target?.displayName}`);
    return true;
  } catch (err) {
    toast(err.message, true);
    return false;
  }
}

export function openModal(html, onReady) {
  modalBody.innerHTML = html;
  if (!modal.open) modal.showModal();
  modalBody.querySelector("[data-close]")?.addEventListener("click", () => modal.close());
  onReady?.(modalBody);
}

export function logModal(game, entry = null) {
  const today = new Date().toISOString().slice(0, 10);
  const statusOptions = Object.entries(STATUS_LABEL)
    .map(([k, label]) => `<option value="${k}" ${k === (entry?.status ?? "JOGADO") ? "selected" : ""}>${label}</option>`).join("");
  const platformOptions = ['<option value="">—</option>', ...game.platforms.map((p) =>
    `<option ${p === entry?.platform ? "selected" : ""}>${esc(p)}</option>`)].join("");

  openModal(`
    <div style="display:flex;gap:16px;align-items:center">
      ${cover(game, "mini")}
      <div><h2>${entry ? "Editar avaliação" : "Avaliar jogo"}</h2><div class="muted">${esc(game.title)} (${game.year})</div></div>
    </div>
    <form class="form" id="log-form">
      <div class="row">
        <label>Joguei em <input type="date" name="playedOn" value="${entry?.playedOn ?? today}" max="${today}" required></label>
        <label>Situação <select name="status">${statusOptions}</select></label>
      </div>
      <div class="row">
        <label>Plataforma <select name="platform">${platformOptions}</select></label>
        <!-- não é <label>: um clique dentro de label é repassado ao primeiro botão e apagava a nota -->
        <div class="field"><span>Nota</span><div id="stars-slot"></div></div>
      </div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <button type="button" class="like-toggle" id="like-toggle" aria-pressed="${entry?.liked ?? false}">♥ Curti</button>
        <label class="check"><input type="checkbox" name="replay" ${entry?.replay ? "checked" : ""}> Rejogando</label>
        <label class="check"><input type="checkbox" name="spoilers" ${entry?.spoilers ? "checked" : ""}> Contém spoilers</label>
      </div>
      <label>Resenha <textarea name="text" maxlength="2000" placeholder="O que achou?">${esc(entry?.text ?? "")}</textarea></label>
      <div class="form-error" id="form-error"></div>
      <div class="form-actions">
        <button type="button" class="btn" data-close>Cancelar</button>
        <button class="btn primary">${entry ? "Salvar" : "Avaliar"}</button>
      </div>
    </form>`, (root) => {
    const rating = starInput(entry?.rating);
    root.querySelector("#stars-slot").appendChild(rating.element);
    const like = root.querySelector("#like-toggle");
    like.addEventListener("click", () => like.setAttribute("aria-pressed", like.getAttribute("aria-pressed") !== "true"));

    root.querySelector("#log-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      const body = {
        gameId: game.id,
        rating: rating.value,
        liked: like.getAttribute("aria-pressed") === "true",
        text: data.get("text"),
        status: data.get("status"),
        platform: data.get("platform") || null,
        playedOn: data.get("playedOn"),
        replay: data.has("replay"),
        spoilers: data.has("spoilers"),
      };
      try {
        await social(entry ? `/api/reviews/${entry.id}` : "/api/reviews", { method: entry ? "PUT" : "POST", body });
        modal.close();
        toast(entry ? "Avaliação atualizada" : `${game.title} avaliado`);
        render();
      } catch (err) {
        root.querySelector("#form-error").textContent = err.message;
      }
    });
  });
}

export function listModal(list = null) {
  openModal(`
    <h2>${list ? "Editar lista" : "Nova lista"}</h2>
    <form class="form" id="list-form">
      <label>Título <input type="text" name="title" maxlength="100" required value="${esc(list?.title ?? "")}"></label>
      <label>Descrição <textarea name="description" maxlength="500" style="min-height:80px">${esc(list?.description ?? "")}</textarea></label>
      <label class="check"><input type="checkbox" name="ranked" ${list?.ranked ? "checked" : ""}> Lista ranqueada (numerada)</label>
      <div class="form-error" id="form-error"></div>
      <div class="form-actions">
        <button type="button" class="btn" data-close>Cancelar</button>
        <button class="btn primary">${list ? "Salvar" : "Criar"}</button>
      </div>
    </form>`, (root) => {
    root.querySelector("#list-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      const body = {
        title: data.get("title"),
        description: data.get("description") || null,
        ranked: data.has("ranked"),
        gameIds: list?.gameIds ?? [],
      };
      try {
        const saved = await social(list ? `/api/lists/${list.id}` : "/api/lists", { method: list ? "PUT" : "POST", body });
        modal.close();
        toast(list ? "Lista atualizada" : "Lista criada");
        location.hash = `#/list/${saved.id}`;
        render();
      } catch (err) {
        root.querySelector("#form-error").textContent = err.message;
      }
    });
  });
}

export async function addToListModal(game) {
  const lists = await social(`/api/lists?ownerId=${state.userId}`);
  openModal(`
    <h2>Adicionar a uma lista</h2>
    <div class="muted">${esc(game.title)}</div>
    <div class="form">
      ${lists.length ? lists.map((l) => {
        const inList = l.gameIds.includes(game.id);
        return `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
          <span>${esc(l.title)} <span class="faint">· ${l.gameIds.length} jogos</span></span>
          <button class="btn small ${inList ? "" : "primary"}" data-list="${l.id}" ${inList ? "disabled" : ""}>${inList ? "Já está" : "Adicionar"}</button>
        </div>`;
      }).join("") : '<div class="empty">Você ainda não tem listas.</div>'}
      <div class="form-actions">
        <button type="button" class="btn" id="create-list">+ Nova lista</button>
        <button type="button" class="btn" data-close>Fechar</button>
      </div>
    </div>`, (root) => {
    root.querySelectorAll("[data-list]").forEach((btn) => btn.addEventListener("click", async () => {
      await social(`/api/lists/${btn.dataset.list}/games`, { method: "POST", body: { gameId: game.id } });
      btn.textContent = "Adicionado ✓";
      btn.disabled = true;
      toast("Jogo adicionado à lista");
    }));
    root.querySelector("#create-list").addEventListener("click", () => { modal.close(); listModal(); });
    modal.addEventListener("close", render, { once: true });
  });
}

/** Recorta a foto no centro e reduz para 256x256 em JPEG (cerca de 15-25 KB). */
async function resizePhoto(file, size = 256) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  canvas.getContext("2d").drawImage(bitmap,
    (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
}

export async function accountModal() {
  const [profile, me] = await Promise.all([social(`/api/users/${state.userId}`), social("/api/auth/me")]);
  const how = [me.hasPassword && "usuário e senha", me.googleLinked && "conta Google"].filter(Boolean).join(" ou ");
  let photo = null; // Blob com a nova foto, null para manter ou "remove" para tirar
  openModal(`
    <h2>Dados da conta</h2>
    <div class="muted">Membro desde ${formatDate(profile.createdAt, { month: "long", year: "numeric" })}${how ? ` · entra com ${how}` : ""}</div>
    <form class="form" id="account-form">
      <div class="photo-field">
        <div id="photo-preview">${avatar(profile, "big")}</div>
        <div class="photo-actions">
          <label class="btn small">Trocar foto<input type="file" accept="image/*" id="photo-input" hidden></label>
          <button type="button" class="btn small danger" id="photo-remove" ${profile.avatarVersion ? "" : "hidden"}>Remover foto</button>
          <span class="faint">JPG, PNG ou WebP. A imagem é recortada em quadrado.</span>
        </div>
      </div>
      <div class="row">
        <label>Nome de usuário <input type="text" value="@${esc(profile.username)}" disabled></label>
        <label>E-mail <input type="text" value="${esc(me.email ?? "—")}" disabled></label>
      </div>
      <label>Nome de exibição <input type="text" name="displayName" maxlength="60" required value="${esc(profile.displayName)}"></label>
      <label>Bio <textarea name="bio" maxlength="280" style="min-height:70px">${esc(profile.bio ?? "")}</textarea></label>
      <div class="form-error" id="form-error"></div>
      <div class="form-actions">
        <button type="button" class="btn" data-close>Cancelar</button>
        <button class="btn primary">Salvar</button>
      </div>
    </form>`, (root) => {
    const preview = root.querySelector("#photo-preview");
    const removeBtn = root.querySelector("#photo-remove");
    let previewUrl = null;
    root.querySelector("#photo-input").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        photo = await resizePhoto(file);
      } catch {
        root.querySelector("#form-error").textContent = "Não foi possível ler essa imagem";
        return;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(photo);
      preview.innerHTML = `<img class="avatar big" src="${previewUrl}" alt="">`;
      removeBtn.hidden = false;
    });
    removeBtn.addEventListener("click", () => {
      photo = "remove";
      preview.innerHTML = avatar({ ...profile, avatarVersion: null }, "big");
      removeBtn.hidden = true;
    });
    root.querySelector("#account-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      try {
        if (photo === "remove") {
          await social(`/api/users/${profile.id}/avatar`, { method: "DELETE" });
        } else if (photo) {
          await uploadAvatar(profile.id, photo);
        }
        await social(`/api/users/${profile.id}`, { method: "PUT", body: { displayName: data.displayName, bio: data.bio || null } });
        modal.close();
        await loadUsers();
        toast("Dados da conta atualizados");
        render();
      } catch (err) {
        root.querySelector("#form-error").textContent = err.message;
      }
    });
  });
}
