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
  const init = { ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } };
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
    // erros de validação do FastAPI vêm como lista: mostra o primeiro
    const message = typeof detail === "string" ? detail
      : Array.isArray(detail) ? `${detail[0].loc?.slice(-1)[0] ?? "campo"}: ${detail[0].msg}` : `Erro ${response.status}`;
    throw Object.assign(new Error(message), { status: response.status });
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

function formatRating(rating) {
  return rating.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Cinco estrelas preenchidas na proporção exata da nota, seguidas do valor (ex.: 4,5). */
function stars(rating, { number = true } = {}) {
  if (rating == null) return "";
  return `<span class="rating" title="${formatRating(rating)} de 5">
    <span class="stars-bar" style="--fill:${(rating / 5) * 100}%" aria-hidden="true">★★★★★</span>${number ? `<span class="rating-value">${formatRating(rating)}</span>` : ""}
  </span>`;
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
  loginModal();
  return false;
}

// ---------------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------------
function cover(game, cls = "") {
  if (!game) return `<div class="cover ${cls}" style="--c:#333"><span class="cover-title">?</span></div>`;
  // a cor fica de fundo enquanto a imagem carrega; se a capa falhar, o título volta a aparecer
  const img = game.coverUrl
    ? `<img src="${CATALOG_API}/api/games/${game.id}/cover" alt="" width="360" height="540" loading="lazy" decoding="async"
         onload="this.parentNode.classList.add('has-img')" onerror="this.remove()">`
    : "";
  return `<div class="cover ${cls}" style="--c:${esc(game.color)}" role="img" aria-label="Capa de ${esc(game.title)}">
    ${img}
    <span class="cover-title">${esc(game.title)}</span>
    <span class="cover-year">${esc(game.year)}</span>
  </div>`;
}

function gameCard(game, extra = "") {
  const meta = game.average != null
    ? `${stars(game.average)} <span class="faint">(${game.reviewCount})</span>`
    : `<span class="faint">sem notas</span>`;
  return `<a class="card" href="#/game/${game.id}" title="${esc(game.title)} (${game.year})">
    ${cover(game)}
    <div class="card-meta">${meta}</div>
    ${extra}
  </a>`;
}

function avatarUrl(user) {
  // a versão muda a cada troca de foto, então o navegador pode guardar a imagem em cache sem risco
  return `${SOCIAL_API}/api/users/${user.id}/avatar?v=${user.avatarVersion}`;
}

function avatar(user, cls = "") {
  if (user?.avatarVersion) {
    return `<img class="avatar ${cls}" src="${avatarUrl(user)}" alt="" loading="lazy" decoding="async">`;
  }
  const initial = (user?.displayName || user?.username || "?").trim()[0].toUpperCase();
  return `<span class="avatar ${cls}" style="background:${esc(user?.avatarColor || "#555")}">${esc(initial)}</span>`;
}

/** Curtir é um interruptor: clicar curte, clicar de novo descurte. */
function likeButton(review) {
  const liked = review.likedBy.includes(state.userId);
  return `<button class="like-btn" data-like-review="${review.id}" aria-pressed="${liked}"
    title="${liked ? "Descurtir" : "Curtir"} esta resenha">${liked ? "♥" : "♡"} ${review.likeCount}</button>`;
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
        ${stars(review.rating)}
        ${review.liked ? '<span class="liked" title="Curtiu">♥</span>' : ""}
        <span class="status ${review.status}">${STATUS_LABEL[review.status]}</span>
        ${review.replay ? '<span class="chip">rejogado</span>' : ""}
      </div>
      ${text}
      <div class="review-foot">
        <span>jogou em ${formatDate(review.playedOn)}</span>
        ${review.platform ? `<span>${esc(review.platform)}</span>` : ""}
        ${likeButton(review)}
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
    ? section("Recomendados para você", `<div class="grid">${recs.items.map((r) => gameCard(r.game)).join("")}</div>`)
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
          <button class="btn primary" id="log-game">${mine.length ? "★ Avaliar de novo" : "★ Avaliar jogo"}</button>
          <a class="btn" href="#/diary/${game.id}">📓 Diário do jogo</a>
          ${state.adminToken ? `<a class="btn admin-edit" href="#/admin/game/${game.id}">✎ Editar página</a>` : ""}
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
    </div>`;

  document.getElementById("log-game").addEventListener("click", () => requireUser() && logModal(game));
  document.getElementById("add-to-list").addEventListener("click", () => requireUser() && addToListModal(game));

  // as screenshots chegam depois, sem atrasar o resto da página
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

function formatHours(hours) {
  // arredonda para a meia hora mais próxima, como o próprio HowLongToBeat
  const half = Math.round(hours * 2) / 2;
  return `${Math.floor(half)}${half % 1 ? "½" : ""} h`;
}

function hltbBox(hltb) {
  const rows = [
    ["História principal", hltb.mainStory],
    ["História + extras", hltb.mainExtra],
    ["100%", hltb.completionist],
  ].filter(([, h]) => h);
  const max = Math.max(...rows.map(([, h]) => h));
  return `<div class="hltb">
    ${rows.map(([label, h]) => `<div class="hltb-row">
      <div class="hltb-label"><span>${label}</span><b>${formatHours(h)}</b></div>
      <div class="hltb-bar"><div style="width:${(h / max) * 100}%"></div></div>
    </div>`).join("")}
    <a class="faint" href="${esc(hltb.url)}" target="_blank" rel="noopener">Dados do HowLongToBeat ↗</a>
  </div>`;
}

const lightbox = document.getElementById("lightbox");

function openLightbox(shots, start, title) {
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

async function diaryPage(gameIdParam) {
  const user = currentUser();
  if (!user) {
    app.innerHTML = `<h1 class="page-title">Diário</h1><div class="empty">Entre na sua conta para ver seu diário.</div>`;
    return;
  }
  const games = await social(`/api/users/${user.id}/journal`);
  const gameId = gameIdParam ? Number(gameIdParam) : games[0]?.gameId;

  if (!gameId) {
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
          <textarea id="journal-text" name="text" maxlength="4000" required placeholder="O que aconteceu nesta sessão?"></textarea>
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
    await social(`/api/journal/${btn.dataset.deleteJournal}?userId=${state.userId}`, { method: "DELETE" });
    toast("Atualização excluída");
    render();
  }));
}

function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function dayLabel(iso) {
  const today = todayIso();
  const yesterday = new Date(Date.parse(today + "T12:00:00") - 86400000).toISOString().slice(0, 10);
  if (iso === today) return "Hoje";
  if (iso === yesterday) return "Ontem";
  return formatDate(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function journalBody(data, gameId) {
  const number = (key) => (data.get(key) === "" ? null : Number(data.get(key)));
  return {
    userId: state.userId,
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
      <label>Texto <textarea name="text" maxlength="4000" required>${esc(entry.text)}</textarea></label>
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

/** Popup com quem segue o perfil e quem ele segue, aberto pelos números do perfil. */
async function followModal(userId, tab = "followers") {
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
    ${suggestions}`, (root) => {
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

async function toggleFollow(btn) {
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

async function userPage(id) {
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

// ---------------------------------------------------------------------------
// Modais
// ---------------------------------------------------------------------------
function openModal(html, onReady) {
  modalBody.innerHTML = html;
  if (!modal.open) modal.showModal();
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
      <div><h2>${entry ? "Editar avaliação" : "Avaliar jogo"}</h2><div class="muted">${esc(game.title)} (${game.year})</div></div>
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
        toast(entry ? "Avaliação atualizada" : `${game.title} avaliado`);
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

function loginModal() {
  const others = state.users.filter((u) => u.id !== state.userId);
  openModal(`
    <h2>Entrar no hitBoxd</h2>
    <div class="muted">Este projeto não usa senha: basta informar o nome de usuário.</div>
    <form class="form" id="login-form">
      <label>Nome de usuário <input type="text" name="username" required autocomplete="username" placeholder="ex: ana_souls"></label>
      <div class="form-error" id="form-error"></div>
      <div class="form-actions">
        <button type="button" class="btn" data-close>Cancelar</button>
        <button class="btn primary">Entrar</button>
      </div>
    </form>
    ${others.length ? `<div class="login-divider"><span>ou entre como</span></div>
    <div class="login-users">
      ${others.map((u) => `<button class="login-user" data-login="${u.id}">${avatar(u)}<span><b>${esc(u.displayName)}</b><span class="faint">@${esc(u.username)}</span></span></button>`).join("")}
    </div>` : ""}
    <p class="muted" style="margin:18px 0 0;text-align:center">Não tem conta? <button class="link-btn accent" id="to-signup">Criar perfil</button></p>`, (root) => {
    const login = (user) => {
      modal.close();
      setUser(user.id);
      toast(`Olá, ${user.displayName.split(" ")[0]}!`);
      render();
    };
    root.querySelector("#login-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = new FormData(e.target).get("username").trim().replace(/^@/, "").toLowerCase();
      const user = state.users.find((u) => u.username.toLowerCase() === name);
      if (user) login(user);
      else root.querySelector("#form-error").textContent = `Não existe ninguém com o usuário @${name}`;
    });
    root.querySelectorAll("[data-login]").forEach((btn) => btn.addEventListener("click", () =>
      login(state.users.find((u) => u.id === Number(btn.dataset.login)))));
    root.querySelector("#to-signup").addEventListener("click", signupModal);
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

async function accountModal() {
  const profile = await social(`/api/users/${state.userId}`);
  let photo = null; // Blob com a nova foto, null para manter ou "remove" para tirar
  openModal(`
    <h2>Dados da conta</h2>
    <div class="muted">Membro desde ${formatDate(profile.createdAt, { month: "long", year: "numeric" })}</div>
    <form class="form" id="account-form">
      <div class="photo-field">
        <div id="photo-preview">${avatar(profile, "big")}</div>
        <div class="photo-actions">
          <label class="btn small">Trocar foto<input type="file" accept="image/*" id="photo-input" hidden></label>
          <button type="button" class="btn small danger" id="photo-remove" ${profile.avatarVersion ? "" : "hidden"}>Remover foto</button>
          <span class="faint">JPG, PNG ou WebP. A imagem é recortada em quadrado.</span>
        </div>
      </div>
      <label>Nome de usuário <input type="text" value="@${esc(profile.username)}" disabled></label>
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

async function uploadAvatar(userId, blob) {
  const response = await fetch(`${SOCIAL_API}/api/users/${userId}/avatar`, {
    method: "PUT",
    headers: { "Content-Type": blob.type },
    body: blob,
  }).catch(() => { throw new Error("Serviço da comunidade indisponível"); });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? `Erro ${response.status} ao enviar a foto`);
  }
}

// ---------------------------------------------------------------------------
// Administração: só o admin adiciona e edita jogos
// ---------------------------------------------------------------------------
function setAdminToken(token) {
  state.adminToken = token;
  try {
    if (token) sessionStorage.setItem("hitboxd.admin", token);
    else sessionStorage.removeItem("hitboxd.admin");
  } catch { /* armazenamento indisponível */ }
  renderSession();
}

/** Pedido ao catálogo com o token do admin; um 401 encerra a sessão de admin. */
async function adminRequest(path, options = {}) {
  try {
    return await catalog(path, { ...options, headers: { Authorization: `Bearer ${state.adminToken}` } });
  } catch (err) {
    if (err.status === 401) {
      setAdminToken(null);
      toast("Sua sessão de administrador expirou", true);
      location.hash = "#/admin";
    }
    throw err;
  }
}

async function adminPage() {
  if (!state.adminToken) {
    app.innerHTML = `
      <div class="admin-login">
        <h1 class="page-title">Área do administrador</h1>
        <p class="muted">Entre para adicionar e editar as páginas dos jogos.</p>
        <form class="form" id="admin-login-form">
          <label>Usuário <input type="text" name="username" required autocomplete="username"></label>
          <label>Senha <input type="password" name="password" required autocomplete="current-password"></label>
          <div class="form-error" id="admin-error"></div>
          <div class="form-actions"><button class="btn primary">Entrar como admin</button></div>
        </form>
      </div>`;
    document.getElementById("admin-login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const button = e.target.querySelector("button");
      button.disabled = true;
      try {
        const session = await catalog("/api/admin/login", { method: "POST", body: Object.fromEntries(new FormData(e.target)) });
        setAdminToken(session.token);
        toast("Você entrou como administrador");
        render();
      } catch (err) {
        document.getElementById("admin-error").textContent = err.message;
        button.disabled = false;
      }
    });
    return;
  }

  const games = await catalog("/api/games?sort=title");
  games.forEach((g) => state.games.set(g.id, { ...state.games.get(g.id), ...g }));
  const rows = (term) => games
    .filter((g) => !term || g.title.toLowerCase().includes(term.toLowerCase()))
    .map((g) => `<div class="admin-row">
      ${cover(g, "mini")}
      <div><b>${esc(g.title)}</b><div class="faint">${g.year} · ${esc(g.developer)}</div></div>
      <a class="btn small" href="#/game/${g.id}">Ver página</a>
      <a class="btn small primary" href="#/admin/game/${g.id}">Editar</a>
    </div>`).join("") || '<div class="empty">Nenhum jogo encontrado.</div>';

  app.innerHTML = `
    <div class="admin-top">
      <div>
        <h1 class="page-title">Administração do catálogo</h1>
        <p class="muted">${games.length} jogos</p>
      </div>
      <div class="admin-actions">
        <a class="btn primary" href="#/admin/game/new">+ Adicionar jogo</a>
        <button class="btn" id="admin-logout">Sair do admin</button>
      </div>
    </div>
    <input type="search" class="admin-search" id="admin-search" placeholder="Filtrar jogos…" aria-label="Filtrar jogos">
    <div class="admin-list" id="admin-list">${rows("")}</div>`;

  document.getElementById("admin-search").addEventListener("input", (e) => {
    document.getElementById("admin-list").innerHTML = rows(e.target.value);
  });
  document.getElementById("admin-logout").addEventListener("click", async () => {
    await adminRequest("/api/admin/session", { method: "DELETE" }).catch(() => {});
    setAdminToken(null);
    toast("Você saiu da área do administrador");
    render();
  });
}

const STEAM_COVER = (appId) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;

async function adminGamePage(id) {
  if (!state.adminToken) {
    location.hash = "#/admin";
    return;
  }
  const isNew = id === "new";
  const game = isNew ? null : await catalog(`/api/games/${id}`);
  // a capa padrão da Steam é derivada do steamAppId: no formulário ela aparece como "em branco"
  const coverUrl = game?.coverUrl && game.coverUrl !== STEAM_COVER(game.steamAppId) ? game.coverUrl : "";
  const h = game?.hltb;
  const v = (value) => esc(value ?? "");

  app.innerHTML = `
    <a class="faint" href="#/admin">← Voltar à administração</a>
    <h1 class="page-title" style="margin-top:10px">${isNew ? "Adicionar jogo" : `Editar: ${esc(game.title)}`}</h1>
    <form class="form admin-form" id="admin-game-form">
      <fieldset>
        <legend>Informações básicas</legend>
        <label>Título <input type="text" name="title" required maxlength="200" value="${v(game?.title)}"></label>
        <div class="row">
          <label>Ano <input type="number" name="year" min="1950" max="2100" required value="${v(game?.year)}"></label>
          <label>Desenvolvedora <input type="text" name="developer" required maxlength="120" value="${v(game?.developer)}"></label>
        </div>
        <div class="row">
          <label>Gêneros (separados por vírgula) <input type="text" name="genres" value="${v(game?.genres.join(", "))}" placeholder="RPG, Ação"></label>
          <label>Plataformas (separadas por vírgula) <input type="text" name="platforms" value="${v(game?.platforms.join(", "))}" placeholder="PC, Switch"></label>
        </div>
        <label>Resumo (uma frase, aparece no topo da página) <textarea name="summary" style="min-height:60px">${v(game?.summary)}</textarea></label>
        <label>Descrição <textarea name="description" style="min-height:120px">${v(game?.description)}</textarea></label>
        <label>Para quem é <textarea name="audience" style="min-height:80px">${v(game?.audience)}</textarea></label>
      </fieldset>
      <fieldset>
        <legend>Imagens</legend>
        <div class="row">
          <label>ID do jogo na Steam (capa e screenshots automáticas) <input type="number" name="steamAppId" min="1" value="${v(game?.steamAppId)}" placeholder="ex: 1145360"></label>
          <label>Cor de fundo <input type="color" name="color" value="${v(game?.color ?? "#4a6d8c")}"></label>
        </div>
        <label>URL da capa (deixe em branco para usar a da Steam) <input type="text" name="coverUrl" inputmode="url" pattern="https://.+" value="${v(coverUrl)}" placeholder="https://…"></label>
        <label>URLs das screenshots, uma por linha (substituem as da Steam) <textarea name="screenshotUrls" style="min-height:70px" placeholder="https://…">${v(game?.screenshotUrls.join("\n"))}</textarea></label>
      </fieldset>
      <fieldset>
        <legend>HowLongToBeat (horas)</legend>
        <div class="row">
          <label>ID da página no HowLongToBeat <input type="number" name="hltbId" min="1" value="${v(h?.id)}" placeholder="ex: 62941"></label>
          <label>História principal <input type="number" name="hltbMain" min="0" step="any" value="${v(h?.mainStory)}"></label>
        </div>
        <div class="row">
          <label>História + extras <input type="number" name="hltbExtra" min="0" step="any" value="${v(h?.mainExtra)}"></label>
          <label>100% <input type="number" name="hltbComp" min="0" step="any" value="${v(h?.completionist)}"></label>
        </div>
      </fieldset>
      <div class="form-error" id="form-error"></div>
      <div class="form-actions">
        <a class="btn" href="#/admin">Cancelar</a>
        <button class="btn primary">${isNew ? "Adicionar jogo" : "Salvar alterações"}</button>
      </div>
    </form>`;

  document.getElementById("admin-game-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    const list = (text, sep) => text.split(sep).map((x) => x.trim()).filter(Boolean);
    const num = (x) => (x === "" ? null : Number(x));
    const body = {
      title: d.title.trim(),
      year: Number(d.year),
      developer: d.developer.trim(),
      genres: list(d.genres, ","),
      platforms: list(d.platforms, ","),
      summary: d.summary.trim(),
      description: d.description.trim(),
      audience: d.audience.trim(),
      steamAppId: num(d.steamAppId),
      coverUrl: d.coverUrl.trim() || null,
      screenshotUrls: list(d.screenshotUrls, "\n"),
      color: d.color,
      hltb: d.hltbId ? { id: Number(d.hltbId), mainStory: num(d.hltbMain), mainExtra: num(d.hltbExtra), completionist: num(d.hltbComp) } : null,
    };
    try {
      const saved = await adminRequest(isNew ? "/api/games" : `/api/games/${id}`, { method: isNew ? "POST" : "PUT", body });
      state.games.set(saved.id, saved);
      toast(isNew ? `${saved.title} adicionado ao catálogo` : "Página do jogo atualizada");
      location.hash = `#/game/${saved.id}`;
    } catch (err) {
      document.getElementById("form-error").textContent = err.message;
    }
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
  const user = currentUser();
  const adminBadge = state.adminToken ? '<a class="admin-badge" href="#/admin" title="Área do administrador">Admin</a>' : "";
  if (!user) {
    el.innerHTML = adminBadge + (state.users.length ? '<button class="btn primary" id="login-btn">Entrar</button>' : "");
    el.querySelector("#login-btn")?.addEventListener("click", loginModal);
    return;
  }
  el.innerHTML = `${adminBadge}
    <div class="account">
      <button class="account-btn" id="account-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="account-menu">
        ${avatar(user)}
        <span class="account-name">${esc(user.displayName)}</span>
        <span class="chevron" aria-hidden="true">▾</span>
      </button>
      <div class="account-menu" id="account-menu" role="menu" hidden>
        <div class="account-head">
          ${avatar(user, "medium")}
          <div><b>${esc(user.displayName)}</b><div class="faint">@${esc(user.username)}</div></div>
        </div>
        <a role="menuitem" href="#/user/${user.id}">Meu perfil</a>
        <a role="menuitem" href="#/diary">Meu diário</a>
        <a role="menuitem" href="#/lists">Minhas listas</a>
        <hr>
        <button role="menuitem" data-account="details">Dados da conta</button>
        <button role="menuitem" data-account="switch">Trocar de conta</button>
        <button role="menuitem" data-account="logout" class="danger">Sair</button>
      </div>
    </div>`;

  const button = el.querySelector("#account-btn");
  const menu = el.querySelector("#account-menu");
  const items = () => [...menu.querySelectorAll("[role=menuitem]")];
  const toggle = (open) => {
    menu.hidden = !open;
    button.setAttribute("aria-expanded", open);
    if (open) items()[0].focus();
  };
  button.addEventListener("click", () => toggle(menu.hidden));
  menu.addEventListener("click", (e) => {
    const item = e.target.closest("[role=menuitem]");
    if (!item) return;
    toggle(false);
    const action = item.dataset.account;
    if (action === "details") accountModal();
    if (action === "switch") loginModal();
    if (action === "logout") {
      setUser(null);
      toast("Você saiu da sua conta");
      location.hash = "#/";
      render();
    }
  });
  menu.addEventListener("keydown", (e) => {
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % list.length].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
    if (e.key === "Escape") { toggle(false); button.focus(); }
  });
}

// fecha o menu da conta ao clicar fora dele
document.addEventListener("click", (e) => {
  const menu = document.getElementById("account-menu");
  if (menu && !menu.hidden && !e.target.closest(".account")) {
    menu.hidden = true;
    document.getElementById("account-btn").setAttribute("aria-expanded", "false");
  }
});

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
  [/^\/diary(?:\/(\d+))?$/, ([, id]) => diaryPage(id)],
  [/^\/lists$/, () => listsPage()],
  [/^\/list\/(\d+)$/, ([, id]) => listPage(id)],
  [/^\/user\/(\d+)$/, ([, id]) => userPage(id)],
  [/^\/admin$/, () => adminPage()],
  [/^\/admin\/game\/(new|\d+)$/, ([, id]) => adminGamePage(id)],
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
    if (await toggleFollow(followBtn)) render();
    return;
  }
  const likeBtn = e.target.closest("[data-like-review]");
  if (likeBtn) {
    e.preventDefault();
    if (!requireUser()) return;
    const review = await social(`/api/reviews/${likeBtn.dataset.likeReview}/like?userId=${state.userId}`, { method: "POST" })
      .catch((err) => toast(err.message, true));
    if (review) likeBtn.outerHTML = likeButton(review);
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
lightbox.addEventListener("click", (e) => { if (e.target === lightbox) lightbox.close(); });

window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });

(async function start() {
  try {
    const stored = Number(localStorage.getItem("hitboxd.user"));
    if (stored) state.userId = stored;
    state.adminToken = sessionStorage.getItem("hitboxd.admin");
  } catch { /* armazenamento indisponível */ }

  const [games] = await Promise.all([
    catalog("/api/games?sort=title").catch(() => []),
    loadUsers(),
    checkServices(),
  ]);
  games.forEach((g) => state.games.set(g.id, g));
  if (state.userId && !currentUser()) setUser(null);
  // o token do admin some quando o serviço reinicia: confere antes de mostrar o selo "Admin"
  if (state.adminToken) {
    await catalog("/api/admin/session", { headers: { Authorization: `Bearer ${state.adminToken}` } })
      .catch(() => setAdminToken(null));
  }
  render();
})();
