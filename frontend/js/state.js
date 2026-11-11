// Estado compartilhado do site (sessão, usuários, jogos carregados).

export const state = {
  games: new Map(),
  users: [],
  userId: null,
  token: null, // token da sessão do usuário (serviço Java)
};

export function currentUser() {
  return state.users.find((u) => u.id === state.userId) ?? null;
}

/** Pode administrar: entrou pelo login do admin em #/admin. */
export function canAdmin() {
  return Boolean(state.adminToken);
}
