// Rotas por #hash: decide qual página desenhar.

import { app } from "./dom.js";
import { esc } from "./utils.js";
import { homePage } from "./pages/home.js";
import { gamesPage } from "./pages/games.js";
import { gamePage } from "./pages/game.js";
import { diaryPage } from "./pages/diary.js";
import { listPage, listsPage } from "./pages/lists.js";
import { peoplePage } from "./pages/people.js";
import { userPage } from "./pages/user.js";
import { adminGamePage, adminPage } from "./pages/admin.js";

const routes = [
  [/^\/?$/, () => homePage()],
  [/^\/games$/, (_, params) => gamesPage(params)],
  [/^\/game\/(\d+)$/, ([, id]) => gamePage(id)],
  [/^\/diary(?:\/(\d+))?$/, ([, id]) => diaryPage(id)],
  [/^\/lists$/, () => listsPage()],
  [/^\/list\/(\d+)$/, ([, id]) => listPage(id)],
  [/^\/user\/(\d+)$/, ([, id]) => userPage(id)],
  [/^\/people$/, (_, params) => peoplePage(params)],
  [/^\/admin$/, () => adminPage()],
  [/^\/admin\/game\/(new|\d+)$/, ([, id]) => adminGamePage(id)],
];

/**
 * Cada navegação ganha um número. Uma página que terminou de carregar depois
 * de a pessoa ir para outra (corrida entre requisições) não se desenha por cima.
 */
export function viewToken() {
  const id = render.current;
  return () => id === render.current;
}

export async function render() {
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
