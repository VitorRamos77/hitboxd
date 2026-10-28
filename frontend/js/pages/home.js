// Página inicial.

import { currentUser } from "../state.js";
import { app } from "../dom.js";
import { esc } from "../utils.js";
import { catalog, social } from "../api.js";
import { gameCard, listCard, reviewItem, section } from "../components.js";
import { viewToken } from "../router.js";

export async function homePage() {
  const isCurrent = viewToken(); // se a pessoa já mudou de página, não desenha esta
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

  if (!isCurrent()) return;
  app.innerHTML = hero + recSection +
    section("Populares na comunidade",
      `<div class="grid">${popular.slice(0, 12).map((g) => gameCard(g)).join("")}</div>`,
      '<a href="#/games">ver todos →</a>') +
    `<div class="two-col">
      ${section(user && feed.length ? "Atividade de quem você segue" : "Atividade recente",
        feed.length ? feed.map((r) => reviewItem(r)).join("") : '<div class="empty">Nenhuma atividade ainda.</div>',
        '<a href="#/people">encontrar pessoas →</a>')}
      ${section("Listas recentes",
        lists.length ? `<div style="display:grid;gap:14px">${lists.slice(0, 3).map(listCard).join("")}</div>` : '<div class="empty">Nenhuma lista ainda.</div>',
        '<a href="#/lists">todas →</a>')}
    </div>`;
}
