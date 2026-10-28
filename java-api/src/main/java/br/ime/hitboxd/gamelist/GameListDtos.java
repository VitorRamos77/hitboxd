package br.ime.hitboxd.gamelist;

import java.time.Instant;
import java.util.List;

import br.ime.hitboxd.user.UserDtos.UserSummary;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public final class GameListDtos {

	private GameListDtos() {
	}

	public record ListInput(
			@NotBlank @Size(max = 100) String title,
			@Size(max = 1000) String description,
			boolean ranked,
			List<@Positive Long> gameIds) {
	}

	public record AddGame(@NotNull @Positive Long gameId) {
	}

	public record ListView(
			Long id,
			UserSummary owner,
			String title,
			String description,
			boolean ranked,
			List<Long> gameIds,
			Instant createdAt) {

		public static ListView of(GameList l) {
			return new ListView(l.getId(), UserSummary.of(l.getOwner()), l.getTitle(), l.getDescription(),
					l.isRanked(), List.copyOf(l.getGameIds()), l.getCreatedAt());
		}
	}
}
