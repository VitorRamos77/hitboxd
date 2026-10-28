package br.ime.hitboxd.user;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

	public Set<User> getFollowing() {
		return following;
	}
}
