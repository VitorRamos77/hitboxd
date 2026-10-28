// Login, cadastro, sessão e o menu da conta no topo.

import { canAdmin, currentUser, state } from "./state.js";
import { modal } from "./dom.js";
import { esc, toast } from "./utils.js";
import { catalog, social } from "./api.js";
import { avatar } from "./components.js";
import { accountModal, openModal } from "./modals.js";
import { render } from "./router.js";

export function requireUser() {
  if (currentUser()) return true;
  loginModal();
  return false;
}

function signupModal() {
  openModal(`
    <h2>Criar conta</h2>
    <div class="muted">Comece seu diário de jogos.</div>
    ${googleBlock("signup")}
    <form class="form" id="signup-form">
      <label>Nome de usuário <input type="text" name="username" pattern="[a-zA-Z0-9_]{3,30}" required autocomplete="username" placeholder="ex: joao_gamer"></label>
      <label>Nome de exibição <input type="text" name="displayName" maxlength="60" required autocomplete="name"></label>
      <label>E-mail (opcional) <input type="email" name="email" maxlength="254" autocomplete="email"></label>
      <div class="row">
        <label>Senha <input type="password" name="password" minlength="8" maxlength="72" required autocomplete="new-password"></label>
        <label>Repita a senha <input type="password" name="confirm" minlength="8" maxlength="72" required autocomplete="new-password"></label>
      </div>
      <div class="faint">A senha precisa ter pelo menos 8 caracteres.</div>
      <div class="form-error" id="form-error"></div>
      <div class="form-actions">
        <button type="button" class="btn" data-close>Cancelar</button>
        <button class="btn primary">Criar conta</button>
      </div>
    </form>
    <p class="muted" style="margin:18px 0 0;text-align:center">Já tem conta? <button class="link-btn accent" id="to-login">Entrar</button></p>`, (root) => {
    mountGoogleButton(root, "signup_with");
    root.querySelector("#to-login").addEventListener("click", loginModal);
    root.querySelector("#signup-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { confirm, ...data } = Object.fromEntries(new FormData(e.target));
      const error = root.querySelector("#form-error");
      if (data.password !== confirm) {
        error.textContent = "As senhas não são iguais";
        return;
      }
      try {
        await startSession(await social("/api/auth/register", { method: "POST", body: { ...data, email: data.email || null } }));
        toast(`Bem-vindo, ${data.displayName}!`);
        location.hash = `#/user/${state.userId}`;
      } catch (err) {
        error.textContent = err.message;
      }
    });
  });
}

function loginModal() {
  openModal(`
    <h2>Entrar no hitBoxd</h2>
    ${googleBlock("login")}
    <form class="form" id="login-form">
      <label>Nome de usuário <input type="text" name="username" required autocomplete="username" placeholder="ex: ana_souls"></label>
      <label>Senha <input type="password" name="password" required autocomplete="current-password"></label>
      <div class="form-error" id="form-error"></div>
      <div class="form-actions">
        <button type="button" class="btn" data-close>Cancelar</button>
        <button class="btn primary">Entrar</button>
      </div>
    </form>
    <p class="muted" style="margin:18px 0 0;text-align:center">Não tem conta? <button class="link-btn accent" id="to-signup">Criar conta</button></p>`, (root) => {
    mountGoogleButton(root, "signin_with");
    root.querySelector("#to-signup").addEventListener("click", signupModal);
    root.querySelector("#login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const button = e.target.querySelector("button.primary");
      button.disabled = true;
      try {
        await startSession(await social("/api/auth/login", { method: "POST", body: Object.fromEntries(new FormData(e.target)) }));
        toast(`Olá, ${currentUser().displayName.split(" ")[0]}!`);
        render();
      } catch (err) {
        root.querySelector("#form-error").textContent = err.message;
        button.disabled = false;
      }
    });
  });
}

/** Espaço do botão do Google nos modais de login e cadastro (só aparece se o serviço tiver um client ID). */
function googleBlock(kind) {
  if (!state.authConfig.googleEnabled) return "";
  return `<div class="google-slot" id="google-slot"></div>
    <div class="login-divider"><span>ou ${kind === "signup" ? "cadastre-se" : "entre"} com usuário e senha</span></div>`;
}

let googleScript = null;

function loadGoogleScript() {
  googleScript ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = resolve;
    script.onerror = () => { googleScript = null; reject(new Error("Não foi possível carregar o login do Google")); };
    document.head.appendChild(script);
  });
  return googleScript;
}

async function mountGoogleButton(root, text) {
  const slot = root.querySelector("#google-slot");
  if (!slot) return;
  try {
    await loadGoogleScript();
    google.accounts.id.initialize({
      client_id: state.authConfig.googleClientId,
      // o Google entrega um ID token assinado; o serviço Java confere a assinatura antes de aceitar
      callback: async ({ credential }) => {
        try {
          await startSession(await social("/api/auth/google", { method: "POST", body: { credential } }));
          toast(`Olá, ${currentUser().displayName.split(" ")[0]}!`);
          render();
        } catch (err) {
          const error = modal.querySelector("#form-error");
          if (error) error.textContent = err.message;
          else toast(err.message, true);
        }
      },
    });
    google.accounts.id.renderButton(slot, { theme: "filled_black", size: "large", text, shape: "pill", width: 300 });
  } catch (err) {
    slot.innerHTML = `<div class="faint">${esc(err.message)}</div>`;
  }
}

/** Guarda a sessão recebida do login/cadastro e carrega o usuário. */
async function startSession(session) {
  modal.close();
  setSession(session.token, session.user.id);
  state.isAdmin = (await social("/api/auth/me").catch(() => null))?.admin ?? false;
  await loadUsers();
}

export function setAdminToken(token) {
  state.adminToken = token;
  try {
    if (token) sessionStorage.setItem("hitboxd.admin", token);
    else sessionStorage.removeItem("hitboxd.admin");
  } catch { /* armazenamento indisponível */ }
  renderSession();
}

export async function loadUsers() {
  try {
    state.users = await social("/api/users");
  } catch {
    state.users = [];
  }
  renderSession();
}

export function setSession(token, userId = null) {
  state.token = token;
  state.userId = token ? userId : null;
  if (!token) state.isAdmin = false;
  try {
    if (token) localStorage.setItem("hitboxd.session", token);
    else localStorage.removeItem("hitboxd.session");
  } catch { /* armazenamento indisponível */ }
  renderSession();
}

export async function logout() {
  await social("/api/auth/logout", { method: "POST" }).catch(() => {});
  setSession(null);
}

function renderSession() {
  const el = document.getElementById("session");
  const user = currentUser();
  const adminBadge = canAdmin() ? '<a class="admin-badge" href="#/admin" title="Área do administrador">Admin</a>' : "";
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
        <a role="menuitem" href="#/people">Encontrar pessoas</a>
        ${state.isAdmin ? '<a role="menuitem" href="#/admin">Administração</a>' : ""}
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
    if (action === "switch") logout().then(loginModal);
    if (action === "logout") {
      logout().then(() => {
        toast("Você saiu da sua conta");
        location.hash = "#/";
        render();
      });
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

export async function checkServices() {
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
