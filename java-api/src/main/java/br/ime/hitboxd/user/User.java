package br.ime.hitboxd.user;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class User {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, length = 30)
	private String username;

	@Column(nullable = false, length = 60)
	private String displayName;

	@Column(length = 280)
	private String bio;

	@Column(length = 7)
	private String avatarColor;

	private Instant createdAt = Instant.now();

	/** Hash BCrypt da senha; nulo para contas que só entram com o Google. */
	@Column(length = 100)
	private String passwordHash;

	@Column(unique = true, length = 254)
	private String email;

	/** E-mail confirmado pelo Google. E-mail digitado no cadastro com senha não é verificado. */
	private boolean emailVerified;

	/** Identificador da conta Google ("sub" do token), quando a conta está ligada ao Google. */
	@Column(unique = true, length = 64)
	private String googleSub;

	/** Foto de perfil já reduzida pelo navegador (no máximo 256 KB). */
	@Basic(fetch = FetchType.LAZY)
	@Column(length = UserService.MAX_AVATAR_BYTES)
	private byte[] avatar;

	@Column(length = 20)
	private String avatarType;

	/** Muda a cada troca de foto, para o navegador não usar a versão antiga em cache. */
	private Long avatarVersion;

	@ManyToMany
	@JoinTable(name = "follows")
	private Set<User> following = new HashSet<>();

	protected User() {
	}

	public User(String username, String displayName, String bio, String avatarColor) {
		this.username = username;
		this.displayName = displayName;
		this.bio = bio;
		this.avatarColor = avatarColor;
	}

	public Long getId() {
		return id;
	}

	public String getUsername() {
		return username;
	}

	public String getDisplayName() {
		return displayName;
	}

	public void setDisplayName(String displayName) {
		this.displayName = displayName;
	}

	public String getBio() {
		return bio;
	}

	public void setBio(String bio) {
		this.bio = bio;
	}

	public String getAvatarColor() {
		return avatarColor;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public void setPasswordHash(String passwordHash) {
		this.passwordHash = passwordHash;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public boolean isEmailVerified() {
		return emailVerified;
	}

	public void setEmailVerified(boolean emailVerified) {
		this.emailVerified = emailVerified;
	}

	public String getGoogleSub() {
		return googleSub;
	}

	public void setGoogleSub(String googleSub) {
		this.googleSub = googleSub;
	}

	public byte[] getAvatar() {
		return avatar;
	}

	public String getAvatarType() {
		return avatarType;
	}

	public Long getAvatarVersion() {
		return avatarVersion;
	}

	public void setAvatar(byte[] avatar, String avatarType) {
		this.avatar = avatar;
		this.avatarType = avatarType;
		this.avatarVersion = avatar == null ? null : System.currentTimeMillis();
	}

	public Set<User> getFollowing() {
		return following;
	}
}
