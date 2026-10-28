package br.ime.hitboxd.auth;

import java.time.Instant;

import br.ime.hitboxd.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;

/**
 * Uma sessão de login. O banco guarda só o hash SHA-256 do token: quem lê o
 * banco não consegue se passar pelo usuário.
 */
@Entity
public class AuthSession {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, length = 64)
	private String tokenHash;

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	private User user;

	private Instant createdAt = Instant.now();

	@Column(nullable = false)
	private Instant expiresAt;

	protected AuthSession() {
	}

	public AuthSession(String tokenHash, User user, Instant expiresAt) {
		this.tokenHash = tokenHash;
		this.user = user;
		this.expiresAt = expiresAt;
	}

	public User getUser() {
		return user;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}
}
