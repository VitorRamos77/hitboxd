package br.ime.hitboxd.journal;

import java.time.Instant;
import java.time.LocalDate;

import br.ime.hitboxd.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;

/**
 * Uma atualização no diário de um jogo: o que aconteceu numa sessão.
 * O mesmo dia pode ter várias atualizações.
 */
@Entity
public class JournalEntry {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	private User user;

	/** Id do jogo no serviço de catálogo (Python). */
	@Column(nullable = false)
	private Long gameId;

	@Column(nullable = false, length = 4000)
	private String text;

	/** Dia da sessão; pode ser anterior a hoje para registrar algo que ficou para trás. */
	@Column(nullable = false)
	private LocalDate playedOn;

	/** Duração da sessão em horas. */
	private Double sessionHours;

	private boolean spoilers;

	private Instant createdAt = Instant.now();

	protected JournalEntry() {
	}

	public JournalEntry(User user, Long gameId) {
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

	public String getText() {
		return text;
	}

	public void setText(String text) {
		this.text = text;
	}

	public LocalDate getPlayedOn() {
		return playedOn;
	}

	public void setPlayedOn(LocalDate playedOn) {
		this.playedOn = playedOn;
	}

	public Double getSessionHours() {
		return sessionHours;
	}

	public void setSessionHours(Double sessionHours) {
		this.sessionHours = sessionHours;
	}

	public boolean isSpoilers() {
		return spoilers;
	}

	public void setSpoilers(boolean spoilers) {
		this.spoilers = spoilers;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public void setCreatedAt(Instant createdAt) {
		this.createdAt = createdAt;
	}
}
