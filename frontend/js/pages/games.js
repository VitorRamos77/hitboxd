// Catálogo de jogos com busca e filtros.

import { app } from "../dom.js";
import { esc } from "../utils.js";
import { catalog } from "../api.js";
import { gameCard } from "../components.js";
import { viewToken } from "../router.js";

export async function gamesPage(params) {
  const isCurrent = viewToken(); // se a pessoa já mudou de página, não desenha esta
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
  if (!isCurrent()) return;
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
