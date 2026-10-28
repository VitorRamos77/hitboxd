package br.ime.hitboxd.common;

import java.text.Normalizer;
import java.util.Locale;

/** Limites e limpeza dos textos que os usuários escrevem. */
public final class Texts {

	public static final int REVIEW_MAX = 2000;
	public static final int JOURNAL_MAX = 2000;
	public static final int LIST_DESCRIPTION_MAX = 500;
	public static final int BIO_MAX = 280;

	private Texts() {
	}

	/**
	 * Mantém as quebras de linha do usuário, mas tira espaços no fim das linhas e
	 * junta mais de uma linha em branco seguida numa só. Texto vazio vira nulo.
	 */
	public static String clean(String text) {
		if (text == null) {
			return null;
		}
		String cleaned = text.replace("\r\n", "\n").replace('\r', '\n')
				.replaceAll("[ \\t]+\\n", "\n")
				.replaceAll("\\n{3,}", "\n\n")
				.strip();
		return cleaned.isEmpty() ? null : cleaned;
	}

	/** Forma usada nas buscas: minúsculas e sem acentos ("Lúcia" encontra "lucia"). */
	public static String searchKey(String text) {
		String noAccents = Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
		return noAccents.toLowerCase(Locale.ROOT).strip();
	}
}
