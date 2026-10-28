package br.ime.hitboxd.common;

/** Pedido sem login válido (401). */
public class UnauthorizedException extends RuntimeException {

	public UnauthorizedException(String message) {
		super(message);
	}
}
