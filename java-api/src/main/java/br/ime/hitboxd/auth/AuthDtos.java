package br.ime.hitboxd.auth;

import java.time.Instant;

import br.ime.hitboxd.common.Texts;
import br.ime.hitboxd.user.UserDtos.UserSummary;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

	private AuthDtos() {
	}

	public record Register(
			@NotBlank @Pattern(regexp = "^[a-zA-Z0-9_]{3,30}$", message = "use 3 a 30 letras, números ou _") String username,
			@NotBlank @Size(max = 60) String displayName,
			@NotBlank @Size(min = 8, max = 72, message = "a senha deve ter de 8 a 72 caracteres") String password,
			@Email @Size(max = 254) String email,
			@Size(max = Texts.BIO_MAX) String bio) {
	}

	public record Login(@NotBlank String username, @NotBlank String password) {
	}

	/** O "credential" que o botão do Google entrega ao navegador (um ID token JWT). */
	public record GoogleLogin(@NotBlank String credential) {
	}

	public record Session(String token, Instant expiresAt, UserSummary user) {
	}

	/** O que o frontend precisa saber antes do login. */
	public record Config(boolean googleEnabled, String googleClientId) {
	}
}
