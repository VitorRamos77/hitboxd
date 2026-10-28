// Ponto de entrada: liga os eventos globais e inicia o site.

import { state } from "./state.js";
import { app, lightbox, modal } from "./dom.js";
import { toast } from "./utils.js";
import { catalog, social } from "./api.js";
import { likeButton } from "./components.js";
import { toggleFollow } from "./modals.js";
import { checkServices, loadUsers, requireUser, setAdminToken } from "./session.js";
import { render } from "./router.js";
import "./search.js"; // a busca do topo se liga sozinha ao carregar

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
    const review = await social(`/api/reviews/${likeBtn.dataset.likeReview}/like`, { method: "POST" })
      .catch((err) => toast(err.message, true));
    if (review) likeBtn.outerHTML = likeButton(review);
    return;
  }
  const expand = e.target.closest("[data-expand]");
  if (expand) {
    const text = expand.previousElementSibling;
    const open = text.classList.toggle("clamped") === false;
    expand.textContent = open ? "Ler menos" : "Ler mais";
    return;
  }
  const spoiler = e.target.closest(".spoiler");
  if (spoiler) spoiler.classList.add("revealed");
});

/** Mostra "123/2000" embaixo de cada caixa de texto com limite; fica em destaque perto do fim. */
function attachCounter(field) {
  if (field.dataset.counter) return;
  field.dataset.counter = "on";
  const counter = document.createElement("span");
  counter.className = "char-count";
  const update = () => {
    const used = field.value.length;
    counter.textContent = `${used}/${field.maxLength}`;
    counter.classList.toggle("near", used >= field.maxLength * 0.9);
  };
  field.addEventListener("input", update);
  field.after(counter);
  update();
}

new MutationObserver(() => document.querySelectorAll("textarea[maxlength]").forEach(attachCounter))
  .observe(document.body, { childList: true, subtree: true });

modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });

lightbox.addEventListener("click", (e) => { if (e.target === lightbox) lightbox.close(); });

window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });

(async function start() {
  try {
    state.token = localStorage.getItem("hitboxd.session");
    state.adminToken = sessionStorage.getItem("hitboxd.admin");
    localStorage.removeItem("hitboxd.user"); // sobra da versão sem senha
  } catch { /* armazenamento indisponível */ }

  const [games, config, me] = await Promise.all([
    catalog("/api/games?sort=title").catch(() => []),
    social("/api/auth/config").catch(() => null),
    // confere se a sessão guardada ainda vale e descobre de quem é
    state.token ? social("/api/auth/me").catch(() => null) : null,
    checkServices(),
  ]);
  if (config) state.authConfig = config;
  state.userId = me?.user.id ?? null;
  state.isAdmin = me?.admin ?? false;
  if (!me) state.token = null;
  await loadUsers();
  games.forEach((g) => state.games.set(g.id, g));
  // o token do admin some quando o serviço reinicia: confere antes de mostrar o selo "Admin"
  if (state.adminToken) {
    await catalog("/api/admin/session", { headers: { Authorization: `Bearer ${state.adminToken}` } })
      .catch(() => setAdminToken(null));
  }
  render();
})();
