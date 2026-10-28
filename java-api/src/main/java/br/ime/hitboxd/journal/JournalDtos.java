package br.ime.hitboxd.journal;

import java.time.Instant;
import java.time.LocalDate;

import br.ime.hitboxd.review.PlayStatus;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public final class JournalDtos {

	private JournalDtos() {
	}

	public record EntryInput(
			@NotNull @Positive Long gameId,
			@NotBlank @Size(max = 4000) String text,
			@PastOrPresent LocalDate playedOn,
			@DecimalMin("0.1") @DecimalMax("24") Double sessionHours,
			boolean spoilers) {
	}

	public record EntryView(
			Long id,
			Long userId,
			Long gameId,
			String text,
			LocalDate playedOn,
			Double sessionHours,
			boolean spoilers,
			Instant createdAt) {

		public static EntryView of(JournalEntry e) {
			return new EntryView(e.getId(), e.getUser().getId(), e.getGameId(), e.getText(), e.getPlayedOn(),
					e.getSessionHours(), e.isSpoilers(), e.getCreatedAt());
		}
	}

	/**
	 * Um jogo no diário do usuário: os que ele tem atualizações ou marcou como "jogando".
	 * {@code status} é a situação do último registro do jogo, se houver.
	 */
	public record JournalGame(
			Long gameId,
			int entryCount,
			double totalHours,
			LocalDate lastPlayedOn,
			Instant lastEntryAt,
			PlayStatus status) {
	}
}
