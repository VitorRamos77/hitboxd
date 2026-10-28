"use strict";

// ---------------------------------------------------------------------------
// Configuração: o catálogo (FastAPI) serve esta página; a comunidade (Spring)
// roda na porta 8080. Se a página for aberta direto do disco, usa localhost.
// ---------------------------------------------------------------------------
const CATALOG_API = location.protocol === "file:" ? "http://localhost:8000" : "";
const SOCIAL_API = `${location.protocol === "file:" ? "http:" : location.protocol}//${location.hostname || "localhost"}:8080`;

const STATUS_LABEL = {
  JOGANDO: "Jogando",
  JOGADO: "Jogado",
  ZERADO: "Zerado",
  PLATINADO: "Platinado",
  ABANDONADO: "Abandonado",
};

const state = {
  games: new Map(),
  users: [],
  userId: null,
};

const app = document.getElementById("app");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modal-body");

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

async function request(base, path, options = {}) {
  const init = { ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}) } };
  if (options.body && typeof options.body !== "string") init.body = JSON.stringify(options.body);
  let response;
  try {
    response = await fetch(base + path, init);
  } catch {
    throw new Error(base === SOCIAL_API
      ? "Serviço da comunidade (Spring Boot, porta 8080) indisponível"
      : "Serviço de catálogo (FastAPI, porta 8000) indisponível");
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    throw new Error(typeof detail === "string" ? detail : `Erro ${response.status}`);
  }
  return data;
}

const catalog = (path, options) => request(CATALOG_API, path, options);
const social = (path, options) => request(SOCIAL_API, path, options);

function toast(message, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}

function stars(rating) {
  if (rating == null) return "";
  const full = Math.floor(rating);
  return "★".repeat(full) + (rating - full >= 0.5 ? "½" : "");
}

function formatDate(iso, opts = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "";
  const date = iso.length === 10 ? new Date(iso + "T12:00:00") : new Date(iso);
  return date.toLocaleDateString("pt-BR", opts);
}

function timeAgo(iso) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "agora";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h`;
  if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)} d`;
  return formatDate(iso, { day: "numeric", month: "short" });
}

function currentUser() {
  return state.users.find((u) => u.id === state.userId) ?? null;
}

function requireUser() {
  if (currentUser()) return true;
  toast("Escolha ou crie um perfil no canto superior direito", true);
  return false;
}

// ---------------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------------
function cover(game, cls = "") {
  if (!game) return `<div class="cover ${cls}" style="--c:#333"><span class="cover-title">?</span></div>`;
  return `<div class="cover ${cls}" style="--c:${esc(game.color)}">
    <span class="cover-title">${esc(game.title)}</span>
    <span class="cover-year">${esc(game.year)}</span>
  </div>`;
}

function gameCard(game, extra = "") {
  const meta = game.average != null
    ? `<span class="stars">${stars(game.average)}</span> (${game.reviewCount})`
    : `<span class="faint">sem notas</span>`;
  return `<a class="card" href="#/game/${game.id}" title="${esc(game.title)} (${game.year})">
    ${cover(game)}
    <div class="card-meta">${meta}</div>
    ${extra}
  </a>`;
}

function avatar(user, cls = "") {
  const initial = (user?.displayName || user?.username || "?").trim()[0].toUpperCase();
  return `<span class="avatar ${cls}" style="background:${esc(user?.avatarColor || "#555")}">${esc(initial)}</span>`;
}

function reviewItem(review, { showGame = true, showUser = true } = {}) {
  const game = state.games.get(review.gameId);
  const text = review.text
    ? `<p class="review-text ${review.spoilers ? "spoiler" : ""}" ${review.spoilers ? 'title="Contém spoilers: clique para revelar"' : ""}>${esc(review.text)}</p>`
    : "";
  return `<article class="review">
    <a href="#/game/${review.gameId}">${cover(game, "mini")}</a>
    <div>
      ${showGame ? `<a class="review-game" href="#/game/${review.gameId}">${esc(game?.title ?? "Jogo #" + review.gameId)}</a> <span class="faint">${esc(game?.year ?? "")}</span>` : ""}
      <div class="review-head">
        ${showUser ? `<a class="who" href="#/user/${review.user.id}">${avatar(review.user)} ${esc(review.user.displayName)}</a>` : ""}
        <span class="stars">${stars(review.rating)}</span>
        ${review.liked ? '<span class="liked" title="Curtiu">♥</span>' : ""}
        <span class="status ${review.status}">${STATUS_LABEL[review.status]}</span>
        ${review.replay ? '<span class="chip">rejogado</span>' : ""}
      </div>
      ${text}
      <div class="review-foot">
        <span>jogou em ${formatDate(review.playedOn)}</span>
        ${review.platform ? `<span>${esc(review.platform)}</span>` : ""}
        <button class="link-btn" data-like-review="${review.id}">♥ ${review.likeCount}</button>
        <span>${timeAgo(review.createdAt)}</span>
      </div>
    </div>
  </article>`;
}

function listCard(list) {
  const covers = list.gameIds.slice(0, 5).map((id) => cover(state.games.get(id))).join("");
  return `<a class="list-card" href="#/list/${list.id}">
    <div class="stack">${covers || '<span class="faint">lista vazia</span>'}</div>
    <h3>${esc(list.title)}</h3>
    <div class="faint">${avatar(list.owner)} ${esc(list.owner.displayName)} · ${list.gameIds.length} ${list.gameIds.length === 1 ? "jogo" : "jogos"}${list.ranked ? " · ranqueada" : ""}</div>
  </a>`;
}

function section(title, body, link = "") {
  return `<section class="section">
    <div class="section-head"><h2>${title}</h2>${link}</div>
    ${body}
  </section>`;
}

// ---------------------------------------------------------------------------
// Páginas
// ---------------------------------------------------------------------------
async function homePage() {
  const user = currentUser();
  const [popular, feed, lists, recs] = await Promise.all([
    catalog("/api/games?sort=popular"),
    social(`/api/feed?limit=8${user ? "&userId=" + user.id : ""}`).catch(() => []),
    social("/api/lists").catch(() => []),
    user ? catalog(`/api/recommendations/${user.id}?limit=6`).catch(() => null) : null,
  ]);

  const hero = user
    ? `<div class="hero"><h1>Bem-vindo de volta, <em>${esc(user.displayName.split(" ")[0])}</em>.</h1>
        <p>Aqui está o que a sua comunidade andou jogando.</p></div>`
    : `<div class="hero"><h1>Registre cada partida. <em>Avalie cada jogo.</em> Descubra o próximo.</h1>
        <p>O hitBoxd é o seu diário de jogos: catalogue o que jogou, escreva resenhas, monte listas e receba recomendações da comunidade.</p></div>`;

  const recSection = recs?.items?.length
    ? section("Recomendados para você",
        `<div class="grid">${recs.items.map((r) => gameCard(r.game, `<span class="card-reason">${esc(r.reason)}</span>`)).join("")}</div>`)
    : "";

  app.innerHTML = hero + recSection +
    section("Populares na comunidade",
      `<div class="grid">${popular.slice(0, 12).map((g) => gameCard(g)).join("")}</div>`,
      '<a href="#/games">ver todos →</a>') +
    `<div class="two-col">
      ${section(user && feed.length ? "Atividade de quem você segue" : "Atividade recente",
        feed.length ? feed.map((r) => reviewItem(r)).join("") : '<div class="empty">Nenhuma atividade ainda.</div>')}
      ${section("Listas recentes",
        lists.length ? `<div style="display:grid;gap:14px">${lists.slice(0, 3).map(listCard).join("")}</div>` : '<div class="empty">Nenhuma lista ainda.</div>',
        '<a href="#/lists">todas →</a>')}
    </div>`;
}

async function gamesPage(params) {
  const [genres, platforms] = await Promise.all([catalog("/api/genres"), catalog("/api/platforms")]);
  const q = params.get("q") ?? "";
  const genre = params.get("genre") ?? "";
  const platform = params.get("platform") ?? "";
  const sort = params.get("sort") ?? "popular";

  const query = new URLSearchParams({ sort });
  if (q) query.set("q", q);
  if (genre) query.set("genre", genre);
  if (platform) query.set("platform", platform);
  const games = await catalog(`/api/games?${query}`);

  const option = (value, label, selected) => `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(label)}</option>`;
  app.innerHTML = `
    <h1 class="page-title">Jogos</h1>
    <p class="muted">${games.length} ${games.length === 1 ? "jogo" : "jogos"}${q ? ` para “${esc(q)}”` : ""}</p>
    <form class="filters" id="filters">
      <input type="search" name="q" value="${esc(q)}" placeholder="Título ou desenvolvedora" aria-label="Buscar">
      <select name="genre" aria-label="Gênero">${option("", "Todos os gêneros", genre)}${genres.map((g) => option(g, g, genre)).join("")}</select>
      <select name="platform" aria-label="Plataforma">${option("", "Todas as plataformas", platform)}${platforms.map((p) => option(p, p, platform)).join("")}</select>
      <select name="sort" aria-label="Ordenar">
        ${option("popular", "Mais populares", sort)}${option("rating", "Melhor avaliados", sort)}
        ${option("year", "Mais recentes", sort)}${option("title", "Título (A–Z)", sort)}
      </select>
      <button class="btn" type="button" id="new-game">+ Adicionar jogo</button>
    </form>
    ${games.length ? `<div class="grid">${games.map((g) => gameCard(g)).join("")}</div>` : '<div class="empty">Nenhum jogo encontrado.</div>'}`;

  const form = document.getElementById("filters");
  const apply = () => {
    const next = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (v && !(k === "sort" && v === "popular")) next.set(k, v);
    location.hash = `#/games${next.toString() ? "?" + next : ""}`;
  };
  form.addEventListener("change", apply);
  form.addEventListener("submit", (e) => { e.preventDefault(); apply(); });
  document.getElementById("new-game").addEventListener("click", () => newGameModal(genres));
}

async function gamePage(id) {
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
          <button class="btn primary" id="log-game">${mine.length ? "+ Registrar de novo" : "+ Registrar no diário"}</button>
          <button class="btn" id="add-to-list">Adicionar a uma lista</button>
          ${mine.length ? `<span class="muted">Sua nota: <span class="stars">${stars(mine[0].rating) || "—"}</span> ${mine[0].liked ? '<span class="liked">♥</span>' : ""}</span>` : ""}
        </div>
        <div class="stat-box">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <span class="avg">${stats.average != null ? stats.average.toFixed(1) : "—"} <span class="stars" style="font-size:18px">${stars(stats.average)}</span></span>
            <span class="faint">${stats.reviewCount} registros · ${stats.likeCount} ♥</span>
          </div>
          <div class="histogram" aria-label="Distribuição das notas">
            ${Object.entries(stats.distribution).map(([k, v]) => `<div style="height:${(v / maxBucket) * 100}%" title="${k}★: ${v}"></div>`).join("")}
          </div>
          <div class="histogram-labels"><span>½★</span><span>★★★★★</span></div>
        </div>
      </div>
    </div>
    <div class="two-col">
      ${section("Avaliações da comunidade",
        reviews.length ? reviews.map((r) => reviewItem(r, { showGame: false })).join("") : '<div class="empty">Ninguém registrou este jogo ainda. Seja o primeiro!</div>')}
      ${section("Aparece nas listas",
        lists.length ? `<div style="display:grid;gap:14px">${lists.map(listCard).join("")}</div>` : '<div class="empty">Em nenhuma lista ainda.</div>')}
    </div>`;

  document.getElementById("log-game").addEventListener("click", () => requireUser() && logModal(game));
  document.getElementById("add-to-list").addEventListener("click", () => requireUser() && addToListModal(game));
}

async function diaryPage() {
  const user = currentUser();
  if (!user) {
    app.innerHTML = `<h1 class="page-title">Diário</h1><div class="empty">Escolha ou crie um perfil para ver seu diário.</div>`;
    return;
  }
  const entries = await social(`/api/users/${user.id}/diary`);
  const months = new Map();
  for (const entry of entries) {
    const key = entry.playedOn.slice(0, 7);
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(entry);
  }

  const rows = [...months].map(([month, items]) => `
    <div class="diary-month">
      <h3>${formatDate(month + "-15", { month: "long", year: "numeric" })}</h3>
      ${items.map((e) => {
        const game = state.games.get(e.gameId);
        return `<div class="diary-row">
          <div class="diary-day">${Number(e.playedOn.slice(8, 10))}</div>
          <a href="#/game/${e.gameId}">${cover(game, "mini")}</a>
          <div>
            <a class="diary-title" href="#/game/${e.gameId}">${esc(game?.title ?? "Jogo #" + e.gameId)}</a>
            <span class="faint">${esc(game?.year ?? "")}</span>
            <div><span class="status ${e.status}">${STATUS_LABEL[e.status]}</span> ${e.replay ? '<span class="chip">rejogado</span>' : ""} ${e.text ? '<span class="faint">✎ resenha</span>' : ""}</div>
          </div>
          <div class="diary-rating"><span class="stars">${stars(e.rating)}</span> ${e.liked ? '<span class="liked">♥</span>' : ""}</div>
          <div class="diary-actions">
            <button class="link-btn" data-edit-entry="${e.id}">editar</button>
            <button class="link-btn" data-delete-entry="${e.id}">excluir</button>
          </div>
        </div>`;
      }).join("")}
    </div>`).join("");

  app.innerHTML = `
    <h1 class="page-title">Diário de ${esc(user.displayName)}</h1>
    <p class="muted">${entries.length} ${entries.length === 1 ? "entrada" : "entradas"}. Cada vez que você joga, vira uma linha aqui.</p>
    ${entries.length ? rows : '<div class="empty">Seu diário está vazio. Abra um jogo e clique em “Registrar no diário”.</div>'}`;

  app.querySelectorAll("[data-edit-entry]").forEach((btn) => btn.addEventListener("click", () => {
    const entry = entries.find((e) => e.id === Number(btn.dataset.editEntry));
    logModal(state.games.get(entry.gameId), entry);
  }));
  app.querySelectorAll("[data-delete-entry]").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("Excluir esta entrada do diário?")) return;
    await social(`/api/reviews/${btn.dataset.deleteEntry}`, { method: "DELETE" });
    toast("Entrada excluída");
    render();
  }));
}

async function listsPage() {
  const lists = await social("/api/lists");
  const user = currentUser();
  const mine = user ? lists.filter((l) => l.owner.id === user.id) : [];
  const others = user ? lists.filter((l) => l.owner.id !== user.id) : lists;
  app.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <h1 class="page-title">Listas</h1>
      <button class="btn primary" id="new-list">+ Nova lista</button>
    </div>
    ${user ? section("Suas listas", mine.length ? `<div class="lists-grid">${mine.map(listCard).join("")}</div>` : '<div class="empty">Você ainda não criou listas.</div>') : ""}
    ${section("Da comunidade", others.length ? `<div class="lists-grid">${others.map(listCard).join("")}</div>` : '<div class="empty">Nenhuma lista.</div>')}`;
  document.getElementById("new-list").addEventListener("click", () => requireUser() && listModal());
}

async function listPage(id) {
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

  app.innerHTML = `
    <div class="faint"><a href="#/user/${list.owner.id}">${avatar(list.owner)} ${esc(list.owner.displayName)}</a> · criada em ${formatDate(list.createdAt)}</div>
    <h1 class="page-title" style="margin-top:10px">${esc(list.title)}</h1>
    ${list.description ? `<p class="muted">${esc(list.description)}</p>` : ""}
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

function followButton(target, following) {
  if (!state.userId || target.id === state.userId) return "";
  return `<button class="btn small ${following ? "" : "primary"}" data-follow="${target.id}" data-following="${following}">${following ? "Seguindo ✓" : "Seguir"}</button>`;
}

function personCard(user, following, note = "") {
  return `<div class="member">
    <a href="#/user/${user.id}" class="member-link">${avatar(user)}<div><b>${esc(user.displayName)}</b><div class="faint">${note ? esc(note) : "@" + esc(user.username)}</div></div></a>
    ${followButton(user, following)}
  </div>`;
}

async function networkPage() {
  await loadUsers();
  const me = currentUser();
  if (!me) {
    app.innerHTML = `
      <h1 class="page-title">Seguidores</h1>
      <p class="muted">Escolha um perfil no topo para seguir pessoas e ver quem segue você.</p>
      ${section("Pessoas no hitBoxd", `<div class="members">${state.users.map((u) => personCard(u, false)).join("")}</div>`)}`;
    return;
  }

  const [profile, followers] = await Promise.all([
    social(`/api/users/${me.id}`),
    social(`/api/users/${me.id}/followers`),
  ]);
  const followingIds = new Set(profile.following.map((u) => u.id));

  // sugestões: quem é seguido pelas pessoas que você segue vem primeiro
  const theirFollowing = await Promise.all(profile.following.map((u) => social(`/api/users/${u.id}`).catch(() => null)));
  const followedBy = new Map();
  for (const p of theirFollowing.filter(Boolean)) {
    for (const u of p.following) {
      if (!followedBy.has(u.id)) followedBy.set(u.id, p.displayName);
    }
  }
  const suggestions = state.users
    .filter((u) => u.id !== me.id && !followingIds.has(u.id))
    .sort((a, b) => followedBy.has(b.id) - followedBy.has(a.id));
  const followerIds = new Set(followers.map((u) => u.id));

  app.innerHTML = `
    <h1 class="page-title">Seguidores</h1>
    <p class="muted">Quem você segue aparece no seu feed na página inicial.</p>
    ${section(`Seguindo (${profile.following.length})`, profile.following.length
      ? `<div class="members">${profile.following.map((u) => personCard(u, true, followerIds.has(u.id) ? "segue você" : "")).join("")}</div>`
      : '<div class="empty">Você ainda não segue ninguém.</div>')}
    ${section(`Seguidores (${followers.length})`, followers.length
      ? `<div class="members">${followers.map((u) => personCard(u, followingIds.has(u.id))).join("")}</div>`
      : '<div class="empty">Ninguém segue você ainda.</div>')}
    ${suggestions.length ? section("Sugestões para seguir",
      `<div class="members">${suggestions.map((u) => personCard(u, false, followedBy.has(u.id) ? `seguido por ${followedBy.get(u.id)}` : "")).join("")}</div>`) : ""}`;
}

async function userPage(id) {
  const [profile, diary, lists, followers] = await Promise.all([
    social(`/api/users/${id}`),
    social(`/api/users/${id}/diary`),
    social(`/api/lists?ownerId=${id}`),
    social(`/api/users/${id}/followers`),
  ]);
  const iFollow = followers.some((u) => u.id === state.userId);
  const people = (users) => users.length
    ? users.map((u) => `<div style="margin-bottom:8px"><a href="#/user/${u.id}">${avatar(u)} ${esc(u.displayName)}</a></div>`).join("")
    : '<div class="faint">Ninguém ainda.</div>';
  const favorites = diary.filter((r) => r.liked || r.rating >= 4.5)
    .filter((r, i, all) => all.findIndex((x) => x.gameId === r.gameId) === i)
    .slice(0, 6);

  app.innerHTML = `
    <div class="profile-head">
      ${avatar(profile, "big")}
      <div>
        <h1>${esc(profile.displayName)}</h1>
        <div class="faint">@${esc(profile.username)}</div>
        ${profile.bio ? `<p class="muted" style="margin:6px 0 0">${esc(profile.bio)}</p>` : ""}
      </div>
      ${followButton(profile, iFollow)}
      <div class="profile-stats">
        <div><b>${profile.gamesLogged}</b><span>jogos</span></div>
        <div><b>${profile.reviewsWritten}</b><span>resenhas</span></div>
        <div><b>${profile.listsCreated}</b><span>listas</span></div>
        <div><b>${profile.followers}</b><span>seguidores</span></div>
        <div><b>${profile.following.length}</b><span>seguindo</span></div>
      </div>
    </div>
    ${favorites.length ? section("Favoritos", `<div class="grid small">${favorites.map((r) => gameCard(state.games.get(r.gameId) ?? { id: r.gameId, title: "?", year: "", color: "#333" })).join("")}</div>`) : ""}
    <div class="two-col">
      ${section("Atividade recente", diary.length ? diary.slice(0, 8).map((r) => reviewItem(r, { showUser: false })).join("") : '<div class="empty">Nada registrado ainda.</div>')}
      <div>
        ${section("Listas", lists.length ? `<div style="display:grid;gap:14px">${lists.map(listCard).join("")}</div>` : '<div class="empty">Nenhuma lista.</div>')}
        ${section(`Seguindo (${profile.following.length})`, people(profile.following))}
        ${section(`Seguidores (${followers.length})`, people(followers))}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Modais
// ---------------------------------------------------------------------------
function openModal(html, onReady) {
  modalBody.innerHTML = html;
  modal.showModal();
  modalBody.querySelector("[data-close]")?.addEventListener("click", () => modal.close());
  onReady?.(modalBody);
}

function starInput(initial) {
  let value = initial ?? null;
  const wrapper = document.createElement("div");
  wrapper.className = "star-input";
  wrapper.setAttribute("role", "radiogroup");
  wrapper.setAttribute("aria-label", "Nota");
  const draw = (shown) => {
    wrapper.querySelectorAll(".fill").forEach((fill, i) => {
      const portion = Math.max(0, Math.min(1, (shown ?? 0) - i));
      fill.style.width = `${portion * 100}%`;
    });
  };
  for (let i = 0; i < 5; i++) {
    const star = document.createElement("button");
    star.type = "button";
    star.innerHTML = `★<span class="fill">★</span><span class="half-hit left"></span><span class="half-hit right"></span>`;
    star.setAttribute("aria-label", `${i + 1} estrela${i ? "s" : ""}`);
    star.addEventListener("mousemove", (e) => {
      const half = e.offsetX < star.clientWidth / 2 ? 0.5 : 1;
      draw(i + half);
    });
    star.addEventListener("click", (e) => {
      const half = e.detail === 0 || e.offsetX >= star.clientWidth / 2 ? 1 : 0.5;
      const next = i + half;
      value = value === next ? null : next; // clicar de novo na mesma nota remove
      draw(value);
      wrapper.dispatchEvent(new Event("change"));
    });
    wrapper.appendChild(star);
  }
  wrapper.addEventListener("mouseleave", () => draw(value));
  draw(value);
  return { element: wrapper, get value() { return value; } };
}

function logModal(game, entry = null) {
  const today = new Date().toISOString().slice(0, 10);
  const statusOptions = Object.entries(STATUS_LABEL)
    .map(([k, label]) => `<option value="${k}" ${k === (entry?.status ?? "JOGADO") ? "selected" : ""}>${label}</option>`).join("");
  const platformOptions = ['<option value="">—</option>', ...game.platforms.map((p) =>
    `<option ${p === entry?.platform ? "selected" : ""}>${esc(p)}</option>`)].join("");

  openModal(`
    <div style="display:flex;gap:16px;align-items:center">
      ${cover(game, "mini")}
      <div><h2>${entry ? "Editar entrada" : "Registrar no diário"}</h2><div class="muted">${esc(game.title)} (${game.year})</div></div>
    </div>
    <form class="form" id="log-form">
      <div class="row">
        <label>Joguei em <input type="date" name="playedOn" value="${entry?.playedOn ?? today}" max="${today}" required></label>
        <label>Situação <select name="status">${statusOptions}</select></label>
      </div>
      <div class="row">
        <label>Plataforma <select name="platform">${platformOptions}</select></label>
        <label>Nota <span id="stars-slot"></span></label>
      </div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <button type="button" class="like-toggle" id="like-toggle" aria-pressed="${entry?.liked ?? false}">♥ Curti</button>
        <label class="check"><input type="checkbox" name="replay" ${entry?.replay ? "checked" : ""}> Rejogando</label>
        <label class="check"><input type="checkbox" name="spoilers" ${entry?.spoilers ? "checked" : ""}> Contém spoilers</label>
      </div>
      <label>Resenha <textarea name="text" maxlength="4000" placeholder="O que achou?">${esc(entry?.text ?? "")}</textarea></label>
      <div class="form-error" id="form-error"></div>
      <div class="form-actions">
        <button type="button" class="btn" data-close>Cancelar</button>
        <button class="btn primary">${entry ? "Salvar" : "Registrar"}</button>
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
        userId: state.userId,
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
        toast(entry ? "Entrada atualizada" : `${game.title} registrado no seu diário`);
        render();
      } catch (err) {
        root.querySelector("#form-error").textContent = err.message;
      }
    });
  });
}

function listModal(list = null) {
  openModal(`
    <h2>${list ? "Editar lista" : "Nova lista"}</h2>
    <form class="form" id="list-form">
      <label>Título <input type="text" name="title" maxlength="100" required value="${esc(list?.title ?? "")}"></label>
      <label>Descrição <textarea name="description" maxlength="1000" style="min-height:80px">${esc(list?.description ?? "")}</textarea></label>
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
        ownerId: state.userId,
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

async function addToListModal(game) {
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

function signupModal() {
  openModal(`
    <h2>Criar perfil</h2>
    <div class="muted">Comece seu diário de jogos.</div>
    <form class="form" id="signup-form">
      <label>Nome de usuário <input type="text" name="username" pattern="[a-zA-Z0-9_]{3,30}" required placeholder="ex: joao_gamer"></label>
      <label>Nome de exibição <input type="text" name="displayName" maxlength="60" required></label>
      <label>Bio <textarea name="bio" maxlength="280" style="min-height:70px" placeholder="Que tipo de jogo você curte?"></textarea></label>
      <div class="form-error" id="form-error"></div>
      <div class="form-actions">
        <button type="button" class="btn" data-close>Cancelar</button>
        <button class="btn primary">Criar</button>
      </div>
    </form>`, (root) => {
    root.querySelector("#signup-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      try {
        const user = await social("/api/users", { method: "POST", body: data });
        modal.close();
        await loadUsers();
        setUser(user.id);
        toast(`Bem-vindo, ${user.displayName}!`);
        location.hash = `#/user/${user.id}`;
      } catch (err) {
        root.querySelector("#form-error").textContent = err.message;
      }
    });
  });
}

function newGameModal(genres) {
  openModal(`
    <h2>Adicionar jogo ao catálogo</h2>
    <form class="form" id="game-form">
      <label>Título <input type="text" name="title" required maxlength="200"></label>
      <div class="row">
        <label>Ano <input type="text" name="year" inputmode="numeric" pattern="[0-9]{4}" required></label>
        <label>Desenvolvedora <input type="text" name="developer" required maxlength="120"></label>
      </div>
      <label>Gêneros (separados por vírgula) <input type="text" name="genres" list="genre-list" placeholder="RPG, Ação"></label>
      <datalist id="genre-list">${genres.map((g) => `<option value="${esc(g)}">`).join("")}</datalist>
      <label>Plataformas (separadas por vírgula) <input type="text" name="platforms" placeholder="PC, Switch"></label>
      <label>Resumo <textarea name="summary" style="min-height:70px"></textarea></label>
      <label>Cor da capa <input type="color" name="color" value="#4a6d8c"></label>
      <div class="form-error" id="form-error"></div>
      <div class="form-actions">
        <button type="button" class="btn" data-close>Cancelar</button>
        <button class="btn primary">Adicionar</button>
      </div>
    </form>`, (root) => {
    root.querySelector("#game-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      const split = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
      try {
        const game = await catalog("/api/games", {
          method: "POST",
          body: { ...data, year: Number(data.year), genres: split(data.genres), platforms: split(data.platforms) },
        });
        state.games.set(game.id, game);
        modal.close();
        toast(`${game.title} adicionado ao catálogo`);
        location.hash = `#/game/${game.id}`;
      } catch (err) {
        root.querySelector("#form-error").textContent = err.message;
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Sessão e roteamento
// ---------------------------------------------------------------------------
async function loadUsers() {
  try {
    state.users = await social("/api/users");
  } catch {
    state.users = [];
  }
  renderSession();
}

function setUser(id) {
  state.userId = id;
  try { localStorage.setItem("hitboxd.user", String(id ?? "")); } catch { /* armazenamento indisponível */ }
  renderSession();
}

function renderSession() {
  const el = document.getElementById("session");
  if (!state.users.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    ${currentUser() ? `<a href="#/user/${state.userId}" title="Meu perfil">${avatar(currentUser())}</a>` : ""}
    <select id="user-select" aria-label="Perfil ativo">
      <option value="">Entrar como…</option>
      ${state.users.map((u) => `<option value="${u.id}" ${u.id === state.userId ? "selected" : ""}>${esc(u.displayName)}</option>`).join("")}
    </select>
    <button class="btn small" id="header-signup">Criar perfil</button>`;
  el.querySelector("#user-select").addEventListener("change", (e) => {
    setUser(e.target.value ? Number(e.target.value) : null);
    render();
  });
  el.querySelector("#header-signup").addEventListener("click", signupModal);
}

async function checkServices() {
  const banner = document.getElementById("status-banner");
  const problems = [];
  try {
    const health = await catalog("/api/health");
    if (!health.socialOnline) problems.push("o serviço da comunidade (Spring Boot, porta 8080) não está respondendo");
  } catch {
    problems.push("o serviço de catálogo (FastAPI, porta 8000) não está respondendo");
  }
  banner.hidden = !problems.length;
  banner.textContent = problems.length ? `Atenção: ${problems.join(" e ")}.` : "";
}

const routes = [
  [/^\/?$/, () => homePage()],
  [/^\/games$/, (_, params) => gamesPage(params)],
  [/^\/game\/(\d+)$/, ([, id]) => gamePage(id)],
  [/^\/diary$/, () => diaryPage()],
  [/^\/lists$/, () => listsPage()],
  [/^\/list\/(\d+)$/, ([, id]) => listPage(id)],
  [/^\/network$/, () => networkPage()],
  [/^\/user\/(\d+)$/, ([, id]) => userPage(id)],
];

async function render() {
  const [path, query = ""] = location.hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(query);
  document.querySelectorAll("[data-nav]").forEach((a) =>
    a.classList.toggle("active", path.startsWith("/" + a.dataset.nav)));
  document.getElementById("search-input").value = path === "/games" ? params.get("q") ?? "" : "";

  const route = routes.find(([pattern]) => pattern.test(path));
  if (!route) {
    app.innerHTML = '<div class="empty">Página não encontrada. <a href="#/">Voltar ao início</a></div>';
    return;
  }
  const renderId = (render.current = (render.current ?? 0) + 1);
  if (!app.innerHTML) app.innerHTML = '<div class="loading">Carregando…</div>';
  try {
    await route[1](path.match(route[0]), params);
  } catch (err) {
    if (renderId === render.current) {
      app.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    }
  }
}

// cliques delegados: seguir, curtir avaliação e revelar spoiler
app.addEventListener("click", async (e) => {
  const followBtn = e.target.closest("[data-follow]");
  if (followBtn) {
    const following = followBtn.dataset.following === "true";
    const target = state.users.find((u) => u.id === Number(followBtn.dataset.follow));
    try {
      await social(`/api/users/${state.userId}/following/${followBtn.dataset.follow}`, { method: following ? "DELETE" : "POST" });
      toast(following ? `Você deixou de seguir ${target?.displayName}` : `Agora você segue ${target?.displayName}`);
      render();
    } catch (err) {
      toast(err.message, true);
    }
    return;
  }
  const likeBtn = e.target.closest("[data-like-review]");
  if (likeBtn) {
    e.preventDefault();
    const review = await social(`/api/reviews/${likeBtn.dataset.likeReview}/like`, { method: "POST" }).catch((err) => toast(err.message, true));
    if (review) likeBtn.textContent = `♥ ${review.likeCount}`;
    return;
  }
  const spoiler = e.target.closest(".spoiler");
  if (spoiler) spoiler.classList.add("revealed");
});

document.getElementById("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = document.getElementById("search-input").value.trim();
  location.hash = q ? `#/games?q=${encodeURIComponent(q)}` : "#/games";
});

modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });

window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });

(async function start() {
  try {
    const stored = Number(localStorage.getItem("hitboxd.user"));
    if (stored) state.userId = stored;
  } catch { /* armazenamento indisponível */ }

  const [games] = await Promise.all([
    catalog("/api/games?sort=title").catch(() => []),
    loadUsers(),
    checkServices(),
  ]);
  games.forEach((g) => state.games.set(g.id, g));
  if (state.userId && !currentUser()) setUser(null);
  render();
})();
