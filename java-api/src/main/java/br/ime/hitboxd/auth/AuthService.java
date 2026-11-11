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
import br.ime.hitboxd.common.ConflictException;
import br.ime.hitboxd.common.Texts;
import br.ime.hitboxd.common.UnauthorizedException;
import br.ime.hitboxd.user.User;
import br.ime.hitboxd.user.UserDtos.Me;
import br.ime.hitboxd.user.UserDtos.UserSummary;
import br.ime.hitboxd.user.UserRepository;
import br.ime.hitboxd.user.UserService;

/** Cadastro, login com usuário e senha e sessões. */
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
	private final SecureRandom random = new SecureRandom();

	public AuthService(UserRepository users, UserService userService, AuthSessionRepository sessions,
			PasswordEncoder passwords) {
		this.users = users;
		this.userService = userService;
		this.sessions = sessions;
		this.passwords = passwords;
	}

	@Transactional
	public Session register(Register input) {
		String email = blankToNull(input.email());
		if (email != null && users.existsByEmailIgnoreCase(email)) {
			throw new ConflictException("Já existe uma conta com esse e-mail");
		}
		User user = userService.newUser(input.username(), input.displayName().strip(), Texts.clean(input.bio()));
		user.setPasswordHash(passwords.encode(input.password()));
		user.setEmail(email == null ? null : email.toLowerCase(Locale.ROOT));
		return issue(user);
	}

	@Transactional
	public Session login(String username, String password) {
		User user = users.findByUsernameIgnoreCase(username.strip().replaceFirst("^@", "")).orElse(null);
		if (user == null || user.getPasswordHash() == null || !passwords.matches(password, user.getPasswordHash())) {
			sleep(FAILURE_DELAY);
			throw new UnauthorizedException("Usuário ou senha incorretos");
		}
		return issue(user);
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
		return Me.of(userService.find(me.id()));
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
