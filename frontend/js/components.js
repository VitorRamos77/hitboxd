// Pedaços de interface reutilizados nas páginas (capas, cards, estrelas, avaliações...).

import { CATALOG_API, SOCIAL_API, STATUS_LABEL } from "./config.js";
import { state } from "./state.js";
import { esc, formatDate, formatHours, formatRating, isLong, stars, timeAgo } from "./utils.js";

export function cover(game, cls = "") {
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

export function gameCard(game, extra = "") {
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

export function avatar(user, cls = "") {
  if (user?.avatarVersion) {
    return `<img class="avatar ${cls}" src="${avatarUrl(user)}" alt="" loading="lazy" decoding="async">`;
  }
  const initial = (user?.displayName || user?.username || "?").trim()[0].toUpperCase();
  return `<span class="avatar ${cls}" style="background:${esc(user?.avatarColor || "#555")}">${esc(initial)}</span>`;
}

/** Curtir é um interruptor: clicar curte, clicar de novo descurte. */
export function likeButton(review) {
  const liked = review.likedBy.includes(state.userId);
  return `<button class="like-btn" data-like-review="${review.id}" aria-pressed="${liked}"
    title="${liked ? "Descurtir" : "Curtir"} esta resenha">${liked ? "♥" : "♡"} ${review.likeCount}</button>`;
}

export function reviewItem(review, { showGame = true, showUser = true } = {}) {
  const game = state.games.get(review.gameId);
  const text = review.text
    ? `<p class="review-text user-text ${review.spoilers ? "spoiler" : ""} ${isLong(review.text) ? "clamped" : ""}" ${review.spoilers ? 'title="Contém spoilers: clique para revelar"' : ""}>${esc(review.text)}</p>
       ${isLong(review.text) ? '<button class="link-btn read-more" data-expand>Ler mais</button>' : ""}`
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

export function listCard(list) {
  const covers = list.gameIds.slice(0, 5).map((id) => cover(state.games.get(id))).join("");
  return `<a class="list-card" href="#/list/${list.id}">
    <div class="stack">${covers || '<span class="faint">lista vazia</span>'}</div>
    <h3>${esc(list.title)}</h3>
    <div class="faint">${avatar(list.owner)} ${esc(list.owner.displayName)} · ${list.gameIds.length} ${list.gameIds.length === 1 ? "jogo" : "jogos"}${list.ranked ? " · ranqueada" : ""}</div>
  </a>`;
}

export function section(title, body, link = "") {
  return `<section class="section">
    <div class="section-head"><h2>${title}</h2>${link}</div>
    ${body}
  </section>`;
}

export function hltbBox(hltb) {
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
    <a class="faint" href="${esc(hltb.url)}" target="_blank" rel="noopener">Dados do HowLongToBeat ↗${hltb.updatedAt ? ` · atualizado em ${formatDate(hltb.updatedAt)}` : ""}</a>
  </div>`;
}

export function followButton(target, following) {
  if (!state.userId || target.id === state.userId) return "";
  return `<button class="btn small ${following ? "" : "primary"}" data-follow="${target.id}" data-following="${following}">${following ? "Seguindo ✓" : "Seguir"}</button>`;
}

export function personCard(user, following, note = "") {
  return `<div class="member">
    <a href="#/user/${user.id}" class="member-link">${avatar(user)}<div><b>${esc(user.displayName)}</b><div class="faint">${note ? esc(note) : "@" + esc(user.username)}</div></div></a>
    ${followButton(user, following)}
  </div>`;
}

/**
 * Nota de 0,5 a 5 em meias estrelas. A metade esquerda de cada estrela vale meia,
 * a direita vale inteira; clicar de novo na mesma nota tira a nota.
 * Pelo teclado: setas mudam meia estrela, Home/Delete tiram a nota, End dá 5.
 */
export function starInput(initial) {
  let value = initial ?? null;
  const wrapper = document.createElement("div");
  wrapper.className = "star-input-wrap";
  wrapper.innerHTML = `
    <div class="star-input" role="slider" tabindex="0" aria-label="Nota" aria-valuemin="0" aria-valuemax="5"></div>
    <span class="star-value" aria-hidden="true"></span>
    <button type="button" class="link-btn star-clear">limpar</button>`;
  const stars = wrapper.querySelector(".star-input");
  const label = wrapper.querySelector(".star-value");
  const clear = wrapper.querySelector(".star-clear");

  for (let i = 0; i < 5; i++) {
    const star = document.createElement("span");
    star.className = "star";
    star.innerHTML = '★<span class="fill" aria-hidden="true">★</span>';
    stars.appendChild(star);
  }
  const starEls = [...stars.children];

  // pinta cada estrela recortando a camada dourada: o desenho não sai do lugar
  const draw = (shown) => {
    starEls.forEach((star, i) => {
      const portion = Math.max(0, Math.min(1, (shown ?? 0) - i));
      star.style.setProperty("--fill", `${portion * 100}%`);
    });
    label.textContent = shown ? formatRating(shown) : "sem nota";
  };
  const set = (next) => {
    value = next ? Math.max(0.5, Math.min(5, next)) : null;
    stars.setAttribute("aria-valuenow", value ?? 0);
    stars.setAttribute("aria-valuetext", value ? `${formatRating(value)} de 5 estrelas` : "sem nota");
    clear.hidden = !value;
    draw(value);
    wrapper.dispatchEvent(new Event("change"));
  };
  // a posição é medida na estrela inteira (não no elemento sob o mouse)
  const pointed = (e) => {
    const star = e.target.closest(".star");
    if (!star) return null;
    const rect = star.getBoundingClientRect();
    return starEls.indexOf(star) + (e.clientX - rect.left < rect.width / 2 ? 0.5 : 1);
  };

  stars.addEventListener("mousemove", (e) => { const v = pointed(e); if (v) draw(v); });
  stars.addEventListener("mouseleave", () => draw(value));
  stars.addEventListener("click", (e) => {
    const v = pointed(e);
    if (v) set(v === value ? null : v);
  });
  stars.addEventListener("keydown", (e) => {
    const steps = { ArrowRight: 0.5, ArrowUp: 0.5, ArrowLeft: -0.5, ArrowDown: -0.5 };
    if (e.key in steps) set((value ?? 0) + steps[e.key]);
    else if (e.key === "Home" || e.key === "Delete" || e.key === "Backspace") set(null);
    else if (e.key === "End") set(5);
    else return;
    e.preventDefault();
  });
  clear.addEventListener("click", () => { set(null); stars.focus(); });

  set(value);
  return { element: wrapper, get value() { return value; } };
}
