package br.ime.hitboxd.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.ime.hitboxd.auth.AuthDtos.Register;
import br.ime.hitboxd.auth.AuthDtos.Session;
import br.ime.hitboxd.auth.GoogleTokenVerifier.GoogleIdentity;
import br.ime.hitboxd.common.ConflictException;
import br.ime.hitboxd.common.UnauthorizedException;
import br.ime.hitboxd.user.User;
import br.ime.hitboxd.user.UserDtos.Me;
import br.ime.hitboxd.user.UserDtos.UserSummary;
import br.ime.hitboxd.user.UserRepository;
import br.ime.hitboxd.user.UserService;

/** Cadastro, login (senha ou Google) e sessões. */
@Service
@Transactional(readOnly = true)
public class AuthService {

	static final Duration SESSION_TTL = Duration.ofDays(30);
	/** Atraso após senha errada, para dificultar tentativa e erro. */
	private static final Duration FAILURE_DELAY = Duration.ofSeconds(1);

	private final UserRepository users;
	private final UserService userService;
	private final AuthSessionRepository sessions;
	private final PasswordEncoder passwords;
	private final GoogleTokenVerifier google;
	private final AdminPolicy adminPolicy;
	private final SecureRandom random = new SecureRandom();

	public AuthService(UserRepository users, UserService userService, AuthSessionRepository sessions,
			PasswordEncoder passwords, GoogleTokenVerifier google, AdminPolicy adminPolicy) {
		this.users = users;
		this.userService = userService;
		this.sessions = sessions;
		this.passwords = passwords;
		this.google = google;
		this.adminPolicy = adminPolicy;
	}

	@Transactional
	public Session register(Register input) {
		String email = blankToNull(input.email());
		if (email != null && users.existsByEmailIgnoreCase(email)) {
			throw new ConflictException("Já existe uma conta com esse e-mail");
		}
		User user = userService.newUser(input.username(), input.displayName().strip(), blankToNull(input.bio()));
		user.setPasswordHash(passwords.encode(input.password()));
		user.setEmail(email == null ? null : email.toLowerCase(Locale.ROOT));
		return issue(user);
	}

	@Transactional
	public Session login(String username, String password) {
		User user = users.findByUsernameIgnoreCase(username.strip().replaceFirst("^@", "")).orElse(null);
		if (user == null || user.getPasswordHash() == null || !passwords.matches(password, user.getPasswordHash())) {
			sleep(FAILURE_DELAY);
			throw new UnauthorizedException(user != null && user.getPasswordHash() == null && user.getGoogleSub() != null
					? "Esta conta entra pelo Google: use o botão \"Entrar com o Google\""
					: "Usuário ou senha incorretos");
		}
		return issue(user);
	}

	/**
	 * Entra com o Google. A conta é a já ligada a esse Google; senão, uma conta
	 * cujo e-mail já foi confirmado pelo Google; senão, uma conta nova.
	 *
	 * Uma conta criada com senha e com esse e-mail digitado NÃO é ligada: o e-mail
	 * dela nunca foi confirmado e pode ser de outra pessoa. Nesse caso o e-mail
	 * passa para a conta do Google, que provou ser dona dele.
	 */
	@Transactional
	public Session loginWithGoogle(String credential) {
		GoogleIdentity identity = google.verify(credential);
		if (identity.email() == null || !identity.emailVerified()) {
			throw new UnauthorizedException("O e-mail da conta Google precisa estar verificado");
		}
		String email = identity.email().toLowerCase(Locale.ROOT);
		User user = users.findByGoogleSub(identity.subject())
				.or(() -> users.findByEmailIgnoreCase(email).filter(User::isEmailVerified))
				.orElse(null);
		if (user == null) {
			releaseUnverifiedEmail(email);
			String name = identity.name() == null || identity.name().isBlank() ? email.split("@")[0] : identity.name();
			user = userService.newUser(freeUsername(email), name.length() > 60 ? name.substring(0, 60) : name, null);
		} else if (!email.equalsIgnoreCase(user.getEmail())) {
			// o e-mail da conta Google mudou; se outra conta já o confirmou, mantém o e-mail antigo
			User owner = users.findByEmailIgnoreCase(email).orElse(null);
			if (owner != null && owner.isEmailVerified()) {
				user.setGoogleSub(identity.subject());
				return issue(user);
			}
			releaseUnverifiedEmail(email);
		}
		user.setGoogleSub(identity.subject());
		user.setEmail(email);
		user.setEmailVerified(true);
		return issue(user);
	}

	/** Tira o e-mail de uma conta que o digitou sem confirmar, para entregá-lo a quem provou ser dono. */
	private void releaseUnverifiedEmail(String email) {
		users.findByEmailIgnoreCase(email).filter(u -> !u.isEmailVerified()).ifPresent(other -> {
			other.setEmail(null);
			users.saveAndFlush(other);
		});
	}

	/** Usuário dono do token, se o token existe e não expirou. */
	public Optional<AuthUser> authenticate(String token) {
		if (token == null || token.isBlank()) {
			return Optional.empty();
		}
		return sessions.findByTokenHash(hash(token))
				.filter(s -> s.getExpiresAt().isAfter(Instant.now()))
				.map(s -> new AuthUser(s.getUser().getId(), s.getUser().getUsername()));
	}

	public Me me(AuthUser me) {
		User user = userService.find(me.id());
		return Me.of(user, adminPolicy.isAdmin(user));
	}

	@Transactional
	public void logout(String token) {
		if (token != null) {
			sessions.deleteByTokenHash(hash(token));
		}
	}

	private Session issue(User user) {
		sessions.deleteExpired(Instant.now());
		byte[] bytes = new byte[32];
		random.nextBytes(bytes);
		String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		Instant expiresAt = Instant.now().plus(SESSION_TTL);
		sessions.save(new AuthSession(hash(token), user, expiresAt));
		return new Session(token, expiresAt, UserSummary.of(user));
	}

	/** Nome de usuário livre a partir do e-mail (ex.: "joao.silva@gmail.com" vira "joao_silva"). */
	private String freeUsername(String email) {
		String base = email.split("@")[0].toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_]", "_");
		base = base.length() < 3 ? base + "_gamer" : base.length() > 24 ? base.substring(0, 24) : base;
		String candidate = base;
		for (int i = 2; users.existsByUsernameIgnoreCase(candidate); i++) {
			candidate = base + i;
		}
		return candidate;
	}

	static String hash(String token) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(digest);
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.strip();
	}

	private static void sleep(Duration duration) {
		try {
			Thread.sleep(duration);
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
		}
	}
}
