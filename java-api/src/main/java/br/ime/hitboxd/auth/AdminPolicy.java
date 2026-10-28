package br.ime.hitboxd.auth;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import br.ime.hitboxd.user.User;

/**
 * Quem é administrador: as contas cujo e-mail está em {@code hitboxd.admin-emails}.
 * Só vale para e-mail verificado (confirmado pelo Google): quem digita o e-mail
 * de outra pessoa no cadastro com senha não vira admin.
 */
@Component
public class AdminPolicy {

	private final Set<String> adminEmails;

	public AdminPolicy(@Value("${hitboxd.admin-emails:}") String adminEmails) {
		this.adminEmails = Arrays.stream(adminEmails.split(","))
				.map(e -> e.strip().toLowerCase(Locale.ROOT))
				.filter(e -> !e.isEmpty())
				.collect(Collectors.toUnmodifiableSet());
	}

	public boolean isAdmin(User user) {
		return user.isEmailVerified() && user.getEmail() != null
				&& adminEmails.contains(user.getEmail().toLowerCase(Locale.ROOT));
	}
}
