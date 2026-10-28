package br.ime.hitboxd.review;

import java.time.Instant;
import java.time.LocalDate;

import br.ime.hitboxd.user.UserDtos.UserSummary;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public final class ReviewDtos {

	private ReviewDtos() {
	}

	public record ReviewInput(
			@NotNull @Positive Long userId,
			@NotNull @Positive Long gameId,
			@DecimalMin("0.5") @DecimalMax("5.0") Double rating,
			boolean liked,
			@Size(max = 4000) String text,
			PlayStatus status,
			@Size(max = 40) String platform,
			@PastOrPresent LocalDate playedOn,
			boolean replay,
			boolean spoilers) {
	}

	public record ReviewView(
			Long id,
			Long userId,
			UserSummary user,
			Long gameId,
			Double rating,
			boolean liked,
			String text,
			PlayStatus status,
			String platform,
			LocalDate playedOn,
			boolean replay,
			boolean spoilers,
			int likeCount,
			Instant createdAt) {

		public static ReviewView of(Review r) {
			return new ReviewView(r.getId(), r.getUser().getId(), UserSummary.of(r.getUser()), r.getGameId(),
					r.getRating(), r.isLiked(), r.getText(), r.getStatus(), r.getPlatform(), r.getPlayedOn(),
					r.isReplay(), r.isSpoilers(), r.getLikeCount(), r.getCreatedAt());
		}
	}
}
