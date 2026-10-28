package br.ime.hitboxd.review;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

import org.hibernate.annotations.BatchSize;

import br.ime.hitboxd.common.Texts;
import br.ime.hitboxd.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;

/**
 * Uma entrada do diário: o usuário registra que jogou um jogo numa data,
 * com nota, curtida e resenha opcionais. Rejogar gera uma nova entrada.
 */
@Entity
public class Review {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	private User user;

	/** Id do jogo no serviço de catálogo (Python). */
	@Column(nullable = false)
	private Long gameId;

	/** De 0.5 a 5.0 em meias estrelas; nulo quando o usuário não deu nota. */
	private Double rating;

	private boolean liked;

	@Column(length = Texts.REVIEW_MAX)
	private String text;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private PlayStatus status = PlayStatus.JOGADO;

	@Column(length = 40)
	private String platform;

	@Column(nullable = false)
	private LocalDate playedOn;

	private boolean replay;

	private boolean spoilers;

	/** Quem curtiu a resenha: cada usuário curte uma vez e pode descurtir. */
	@ManyToMany
	@JoinTable(name = "review_likes")
	@BatchSize(size = 50)
	private Set<User> likedBy = new HashSet<>();

	private Instant createdAt = Instant.now();

	protected Review() {
	}

	public Review(User user, Long gameId) {
		this.user = user;
		this.gameId = gameId;
	}

	public Long getId() {
		return id;
	}

	public User getUser() {
		return user;
	}

	public Long getGameId() {
		return gameId;
	}

	public Double getRating() {
		return rating;
	}

	public void setRating(Double rating) {
		this.rating = rating;
	}

	public boolean isLiked() {
		return liked;
	}

	public void setLiked(boolean liked) {
		this.liked = liked;
	}

	public String getText() {
		return text;
	}

	public void setText(String text) {
		this.text = text;
	}

	public PlayStatus getStatus() {
		return status;
	}

	public void setStatus(PlayStatus status) {
		this.status = status;
	}

	public String getPlatform() {
		return platform;
	}

	public void setPlatform(String platform) {
		this.platform = platform;
	}

	public LocalDate getPlayedOn() {
		return playedOn;
	}

	public void setPlayedOn(LocalDate playedOn) {
		this.playedOn = playedOn;
	}

	public boolean isReplay() {
		return replay;
	}

	public void setReplay(boolean replay) {
		this.replay = replay;
	}

	public boolean isSpoilers() {
		return spoilers;
	}

	public void setSpoilers(boolean spoilers) {
		this.spoilers = spoilers;
	}

	public Set<User> getLikedBy() {
		return likedBy;
	}

	/** Curte se ainda não curtiu; descurte se já curtiu. Devolve se ficou curtida. */
	public boolean toggleLike(User user) {
		if (likedBy.remove(user)) {
			return false;
		}
		likedBy.add(user);
		return true;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public void setCreatedAt(Instant createdAt) {
		this.createdAt = createdAt;
	}
}
