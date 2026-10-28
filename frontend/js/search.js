// Busca do topo com sugestões (jogos e pessoas) enquanto a pessoa digita.

import { state } from "./state.js";
import { esc } from "./utils.js";
import { avatar, cover } from "./components.js";

const searchInput = document.getElementById("search-input");

const suggestBox = document.getElementById("search-suggestions");

export let suggestions = []; // [{ href, html }]

let activeSuggestion = -1;

/** Minúsculas e sem acentos, para "zelda" achar "Zelda" e "pokemon" achar "Pokémon". */
function plain(text) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Destaca o trecho digitado dentro do texto. */
function highlight(text, term) {
  const at = plain(text).indexOf(plain(term));
  if (at < 0 || !term) return esc(text);
  return esc(text.slice(0, at)) + "<mark>" + esc(text.slice(at, at + term.length)) + "</mark>" + esc(text.slice(at + term.length));
}

function rankMatches(items, term, fields) {
  const t = plain(term);
  return items
    .map((item) => {
      const values = fields(item).map(plain);
      const score = values.some((v) => v.startsWith(t)) ? 2 : values.some((v) => v.includes(` ${t}`)) ? 1
        : values.some((v) => v.includes(t)) ? 0 : -1;
      return { item, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score);
}

function updateSuggestions() {
  const term = searchInput.value.trim();
  if (term.length < 1) return closeSuggestions();

  const games = rankMatches([...state.games.values()], term, (g) => [g.title, g.developer])
    .sort((a, b) => b.score - a.score || (b.item.reviewCount ?? 0) - (a.item.reviewCount ?? 0))
    .slice(0, 5).map((x) => x.item);
  const people = rankMatches(state.users.filter((u) => u.id !== state.userId), term.replace(/^@/, ""), (u) => [u.displayName, u.username])
    .slice(0, 4).map((x) => x.item);

  suggestions = [
    ...games.map((g) => ({
      group: "Jogos",
      href: `#/game/${g.id}`,
      html: `${cover(g, "tiny")}<span><b>${highlight(g.title, term)}</b><span class="faint">${g.year} · ${esc(g.developer)}</span></span>`,
    })),
    ...people.map((u) => ({
      group: "Pessoas",
      href: `#/user/${u.id}`,
      html: `${avatar(u)}<span><b>${highlight(u.displayName, term)}</b><span class="faint">@${highlight(u.username, term.replace(/^@/, ""))}</span></span>`,
    })),
    { group: "", href: `#/games?q=${encodeURIComponent(term)}`, html: `<span class="suggest-all">Ver todos os jogos com “${esc(term)}”</span>` },
    { group: "", href: `#/people?q=${encodeURIComponent(term)}`, html: `<span class="suggest-all">Procurar pessoas: “${esc(term)}”</span>` },
  ];
  activeSuggestion = -1;

  let lastGroup = null;
  suggestBox.innerHTML = suggestions.map((sug, i) => {
    const heading = sug.group !== lastGroup && sug.group ? `<div class="suggest-group" role="presentation">${sug.group}</div>` : "";
    const divider = sug.group !== lastGroup && !sug.group ? '<div class="suggest-divider" role="presentation"></div>' : "";
    lastGroup = sug.group;
    return `${heading}${divider}<a class="suggestion" role="option" id="suggestion-${i}" href="${sug.href}" aria-selected="false">${sug.html}</a>`;
  }).join("");
  if (!games.length && !people.length) {
    suggestBox.insertAdjacentHTML("afterbegin", '<div class="suggest-empty">Nenhum jogo ou pessoa com esse nome.</div>');
  }
  suggestBox.hidden = false;
  searchInput.setAttribute("aria-expanded", "true");
}

function closeSuggestions() {
  suggestBox.hidden = true;
  suggestBox.innerHTML = "";
  suggestions = [];
  activeSuggestion = -1;
  searchInput.setAttribute("aria-expanded", "false");
  searchInput.removeAttribute("aria-activedescendant");
}

function moveSuggestion(delta) {
  if (!suggestions.length) return;
  activeSuggestion = (activeSuggestion + delta + suggestions.length) % suggestions.length;
  suggestBox.querySelectorAll(".suggestion").forEach((el, i) => {
    el.setAttribute("aria-selected", i === activeSuggestion);
    if (i === activeSuggestion) el.scrollIntoView({ block: "nearest" });
  });
  searchInput.setAttribute("aria-activedescendant", `suggestion-${activeSuggestion}`);
}

let suggestTimer;

searchInput.addEventListener("input", () => {
  clearTimeout(suggestTimer);
  suggestTimer = setTimeout(updateSuggestions, 80);
});

searchInput.addEventListener("focus", () => searchInput.value.trim() && updateSuggestions());

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { e.preventDefault(); if (suggestBox.hidden) updateSuggestions(); moveSuggestion(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); moveSuggestion(-1); }
  else if (e.key === "Escape") closeSuggestions();
  else if (e.key === "Enter" && activeSuggestion >= 0) {
    e.preventDefault();
    location.hash = suggestions[activeSuggestion].href;
    closeSuggestions();
    searchInput.blur();
  }
});

// clicar numa sugestão não pode tirar o foco antes do clique valer
suggestBox.addEventListener("mousedown", (e) => e.preventDefault());

suggestBox.addEventListener("click", (e) => {
  if (e.target.closest(".suggestion")) {
    closeSuggestions();
    searchInput.blur();
  }
});

searchInput.addEventListener("blur", () => setTimeout(closeSuggestions, 100));

document.getElementById("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  closeSuggestions();
  location.hash = q ? `#/games?q=${encodeURIComponent(q)}` : "#/games";
});
