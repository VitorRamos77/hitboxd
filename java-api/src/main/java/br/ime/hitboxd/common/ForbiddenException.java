package br.ime.hitboxd.common;

/** Usuário logado tentando mexer no que não é dele (403). */
public class ForbiddenException extends RuntimeException {

	public ForbiddenException(String message) {
		super(message);
	}
}
