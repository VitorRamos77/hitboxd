package br.ime.hitboxd.auth;

/** O usuário do pedido, identificado pelo token de login (nunca pelo corpo do pedido). */
public record AuthUser(Long id, String username) {
}
