// Encontrar pessoas para seguir.

import { state } from "../state.js";
import { app } from "../dom.js";
import { esc } from "../utils.js";
import { social } from "../api.js";
import { personCard, section } from "../components.js";
import { viewToken } from "../router.js";

/** Encontrar pessoas: busca por nome ou @usuário, com botão de seguir em cada resultado. */
export async function peoplePage(params) {
  const isCurrent = viewToken(); // se a pessoa já mudou de página, não desenha esta
  const q = params.get("q") ?? "";
  if (!isCurrent()) return;
  app.innerHTML = `
    <h1 class="page-title">Encontrar pessoas</h1>
    <p class="muted">Siga outros jogadores para ver o que eles andam jogando no seu feed.</p>
    <input type="search" class="people-search" id="people-search" value="${esc(q)}"
      placeholder="Buscar por nome ou @usuário" aria-label="Buscar pessoas" autocomplete="off">
    <div id="people-results"><div class="loading">Carregando…</div></div>`;

  const input = document.getElementById("people-search");
  const box = document.getElementById("people-results");
  let iFollow = new Set();
  if (state.userId) {
    iFollow = new Set((await social(`/api/users/${state.userId}`)).following.map((u) => u.id));
  }

  const show = async (term) => {
    const people = (await social(`/api/users?q=${encodeURIComponent(term)}&limit=60`))
      .filter((u) => u.id !== state.userId);
    if (box.isConnected) {
      box.innerHTML = people.length
        ? section(term ? `${people.length} ${people.length === 1 ? "pessoa encontrada" : "pessoas encontradas"}` : "Todos os membros",
            `<div class="members">${people.map((u) => personCard(u, iFollow.has(u.id))).join("")}</div>`)
        : `<div class="empty">Ninguém encontrado para “${esc(term)}”.</div>`;
    }
  };

  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const term = input.value.trim();
      // atualiza o endereço sem recarregar a página (o campo não perde o foco)
      history.replaceState(null, "", term ? `#/people?q=${encodeURIComponent(term)}` : "#/people");
      show(term);
    }, 200);
  });
  await show(q);
  if (!q) input.focus();
}
