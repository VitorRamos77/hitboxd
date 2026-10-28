package br.ime.hitboxd.gamelist;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import br.ime.hitboxd.user.User;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;

/** Lista personalizada de jogos ("Melhores RPGs", "Para jogar em 2026"...). */
@Entity
public class GameList {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	private User owner;

	@Column(nullable = false, length = 100)
	private String title;

	@Column(length = 1000)
	private String description;

	/** Lista ranqueada: a ordem dos jogos importa e é exibida numerada. */
	private boolean ranked;

	@ElementCollection
	@CollectionTable(name = "game_list_items")
	@Column(name = "game_id")
	@OrderColumn(name = "position")
	private List<Long> gameIds = new ArrayList<>();

	private Instant createdAt = Instant.now();

	protected GameList() {
	}

	public GameList(User owner, String title) {
		this.owner = owner;
		this.title = title;
	}

	public Long getId() {
		return id;
	}

	public User getOwner() {
		return owner;
	}

	public String getTitle() {
		return title;
	}

	public void setTitle(String title) {
		this.title = title;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public boolean isRanked() {
		return ranked;
	}

	public void setRanked(boolean ranked) {
		this.ranked = ranked;
	}

	public List<Long> getGameIds() {
		return gameIds;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
