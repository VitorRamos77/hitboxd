// Pedidos aos dois serviços: catálogo (FastAPI) e comunidade (Spring Boot).

import { CATALOG_API, SOCIAL_API } from "./config.js";
import { state } from "./state.js";
import { toast } from "./utils.js";
import { setAdminToken, setSession } from "./session.js";

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

export const catalog = (path, options) => request(CATALOG_API, path, options);

/** Pedido ao serviço social; com sessão, envia o token. Um 401 com sessão significa que ela expirou. */
export async function social(path, options = {}) {
  const withAuth = state.token
    ? { ...options, headers: { Authorization: `Bearer ${state.token}`, ...options.headers } }
    : options;
  try {
    return await request(SOCIAL_API, path, withAuth);
  } catch (err) {
    if (err.status === 401 && state.token) {
      setSession(null);
      toast("Sua sessão expirou. Entre de novo.", true);
    }
    throw err;
  }
}

export async function uploadAvatar(userId, blob) {
  const response = await fetch(`${SOCIAL_API}/api/users/${userId}/avatar`, {
    method: "PUT",
    headers: { "Content-Type": blob.type, Authorization: `Bearer ${state.token}` },
    body: blob,
  }).catch(() => { throw new Error("Serviço da comunidade indisponível"); });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? `Erro ${response.status} ao enviar a foto`);
  }
}

/**
 * Pedido ao catálogo como admin. Usa o token do login de admin ou, para contas
 * administradoras, o próprio token de sessão (o FastAPI confere no serviço Java).
 */
export async function adminRequest(path, options = {}) {
  const token = state.adminToken || state.token;
  try {
    return await catalog(path, { ...options, headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    if (err.status === 401 && state.adminToken) {
      setAdminToken(null);
      toast("Sua sessão de administrador expirou", true);
      location.hash = "#/admin";
    }
    throw err;
  }
}
