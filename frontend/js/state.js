// Estado compartilhado do site (sessão, usuários, jogos carregados).

export const state = {
  games: new Map(),
  users: [],
  userId: null,
  token: null, // token da sessão do usuário (serviço Java)
  isAdmin: false, // a conta logada é administradora (e-mail em ADMIN_EMAILS, confirmado pelo Google)
  authConfig: { googleEnabled: false, googleClientId: null },
};

export function currentUser() {
  return state.users.find((u) => u.id === state.userId) ?? null;
}

/** Pode administrar: pelo login próprio do admin ou por ser uma conta administradora. */
export function canAdmin() {
  return Boolean(state.adminToken || state.isAdmin);
}
