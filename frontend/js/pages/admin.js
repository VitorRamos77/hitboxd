// Área do administrador: lista de jogos, editor e atualizações automáticas.

import { canAdmin, state } from "../state.js";
import { app } from "../dom.js";
import { esc, toast } from "../utils.js";
import { adminRequest, catalog } from "../api.js";
import { cover } from "../components.js";
import { setAdminToken } from "../session.js";
import { render, viewToken } from "../router.js";

export async function adminPage() {
  const isCurrent = viewToken(); // se a pessoa já mudou de página, não desenha esta
  if (!canAdmin()) {
    if (!isCurrent()) return;
    app.innerHTML = `
      <div class="admin-login">
        <h1 class="page-title">Área do administrador</h1>
        <p class="muted">Entre para adicionar e editar as páginas dos jogos. Contas administradoras não precisam disso: basta entrar no site com elas.</p>
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

  if (!isCurrent()) return;
  app.innerHTML = `
    <div class="admin-top">
      <div>
        <h1 class="page-title">Administração do catálogo</h1>
        <p class="muted">${games.length} jogos</p>
      </div>
      <div class="admin-actions">
        <a class="btn primary" href="#/admin/game/new">+ Adicionar jogo</a>
        ${state.adminToken ? '<button class="btn" id="admin-logout">Sair do admin</button>' : ""}
      </div>
    </div>
    <div class="admin-updates" id="admin-updates"></div>
    <input type="search" class="admin-search" id="admin-search" placeholder="Filtrar jogos…" aria-label="Filtrar jogos">
    <div class="admin-list" id="admin-list">${rows("")}</div>`;

  renderUpdateStatus();
  document.getElementById("admin-search").addEventListener("input", (e) => {
    document.getElementById("admin-list").innerHTML = rows(e.target.value);
  });
  document.getElementById("admin-logout")?.addEventListener("click", async () => {
    await adminRequest("/api/admin/session", { method: "DELETE" }).catch(() => {});
    setAdminToken(null);
    toast("Você saiu da área do administrador");
    render();
  });
}

/** Situação da atualização automática dos tempos do HowLongToBeat, com botão para rodar agora. */
async function renderUpdateStatus() {
  const box = document.getElementById("admin-updates");
  if (!box) return;
  const st = await adminRequest("/api/admin/updates").catch(() => null);
  if (!st) return;
  const when = (iso) => iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
  box.innerHTML = `
    <div>
      <b>Tempos do HowLongToBeat</b>
      <div class="faint">
        ${st.running ? "Atualizando agora…" : `Última atualização: ${when(st.lastRunAt)}${st.lastRunAt ? ` (${st.lastRunUpdated} atualizados, ${st.lastRunFailed} falhas)` : ""}`}
        · ${!st.enabled ? "atualização automática desligada"
          : `automática a cada ${st.intervalHours} h${st.running ? "" : `, próxima ${when(st.nextRunAt)}`}`}
      </div>
    </div>
    <button class="btn small" id="run-updates" ${st.running ? "disabled" : ""}>Atualizar agora</button>`;
  document.getElementById("run-updates").addEventListener("click", async () => {
    await adminRequest("/api/admin/updates/hltb", { method: "POST" });
    toast("Atualização iniciada; ela leva alguns minutos");
    setTimeout(renderUpdateStatus, 1500);
  });
  // enquanto roda, confere de novo a cada poucos segundos
  if (st.running) setTimeout(() => location.hash === "#/admin" && renderUpdateStatus(), 5000);
}

const STEAM_COVER = (appId) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;

export async function adminGamePage(id) {
  const isCurrent = viewToken(); // se a pessoa já mudou de página, não desenha esta
  if (!canAdmin()) {
    location.hash = "#/admin";
    return;
  }
  const isNew = id === "new";
  const game = isNew ? null : await catalog(`/api/games/${id}`);
  // a capa padrão da Steam é derivada do steamAppId: no formulário ela aparece como "em branco"
  const coverUrl = game?.coverUrl && game.coverUrl !== STEAM_COVER(game.steamAppId) ? game.coverUrl : "";
  const h = game?.hltb;
  const v = (value) => esc(value ?? "");

  if (!isCurrent()) return;
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
        <label>Resumo (uma frase, aparece no topo da página) <textarea name="summary" maxlength="200" style="min-height:60px">${v(game?.summary)}</textarea></label>
        <label>Descrição <textarea name="description" maxlength="2000" style="min-height:120px">${v(game?.description)}</textarea></label>
        <label>Para quem é <textarea name="audience" maxlength="800" style="min-height:80px">${v(game?.audience)}</textarea></label>
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
