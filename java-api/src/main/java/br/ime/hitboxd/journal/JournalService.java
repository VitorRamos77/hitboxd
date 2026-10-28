package br.ime.hitboxd.journal;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.ime.hitboxd.common.ForbiddenException;
import br.ime.hitboxd.common.NotFoundException;
import br.ime.hitboxd.journal.JournalDtos.EntryInput;
import br.ime.hitboxd.journal.JournalDtos.EntryView;
import br.ime.hitboxd.journal.JournalDtos.JournalGame;
import br.ime.hitboxd.review.PlayStatus;
import br.ime.hitboxd.review.Review;
import br.ime.hitboxd.review.ReviewRepository;
import br.ime.hitboxd.user.UserService;

@Service
@Transactional(readOnly = true)
public class JournalService {

	private final JournalRepository entries;
	private final ReviewRepository reviews;
	private final UserService users;

	public JournalService(JournalRepository entries, ReviewRepository reviews, UserService users) {
		this.entries = entries;
		this.reviews = reviews;
		this.users = users;
	}

	public List<EntryView> entries(Long userId, Long gameId) {
		return entries.findByUserIdAndGameIdOrderByPlayedOnDescCreatedAtDesc(userId, gameId).stream()
				.map(EntryView::of)
				.toList();
	}

	/** Os jogos do diário: com atualizações ou marcados como "jogando", do mais recente ao mais antigo. */
	public List<JournalGame> games(Long userId) {
		users.find(userId);

		// o último registro de cada jogo diz a situação atual (jogando, zerado...)
		Map<Long, Review> latestReview = new LinkedHashMap<>();
		for (Review r : reviews.findByUserIdOrderByPlayedOnDescCreatedAtDesc(userId)) {
			latestReview.putIfAbsent(r.getGameId(), r);
		}

		Map<Long, List<JournalEntry>> byGame = new LinkedHashMap<>();
		for (JournalEntry e : entries.findByUserIdOrderByPlayedOnDescCreatedAtDesc(userId)) {
			byGame.computeIfAbsent(e.getGameId(), id -> new ArrayList<>()).add(e);
		}

		List<JournalGame> result = new ArrayList<>();
		byGame.forEach((gameId, list) -> {
			Review review = latestReview.get(gameId);
			JournalEntry last = list.getFirst();
			result.add(new JournalGame(gameId, list.size(),
					list.stream().mapToDouble(e -> e.getSessionHours() == null ? 0 : e.getSessionHours()).sum(),
					last.getPlayedOn(), last.getCreatedAt(), review == null ? null : review.getStatus()));
		});
		latestReview.forEach((gameId, review) -> {
			if (review.getStatus() == PlayStatus.JOGANDO && !byGame.containsKey(gameId)) {
				result.add(new JournalGame(gameId, 0, 0, review.getPlayedOn(), null, PlayStatus.JOGANDO));
			}
		});
		result.sort(Comparator.comparing(JournalGame::lastPlayedOn, Comparator.reverseOrder())
				.thenComparing(JournalGame::entryCount, Comparator.reverseOrder()));
		return result;
	}

	@Transactional
	public EntryView create(Long userId, EntryInput input) {
		JournalEntry entry = new JournalEntry(users.find(userId), input.gameId());
		apply(entry, input);
		return EntryView.of(entries.save(entry));
	}

	@Transactional
	public EntryView update(Long id, Long userId, EntryInput input) {
		JournalEntry entry = find(id);
		checkOwner(entry, userId);
		if (!entry.getGameId().equals(input.gameId())) {
			throw new IllegalArgumentException("Não é possível mover a atualização para outro jogo");
		}
		apply(entry, input);
		return EntryView.of(entry);
	}

	@Transactional
	public void delete(Long id, Long userId) {
		JournalEntry entry = find(id);
		checkOwner(entry, userId);
		entries.delete(entry);
	}

	private void apply(JournalEntry entry, EntryInput input) {
		entry.setText(input.text().strip());
		entry.setPlayedOn(input.playedOn() == null ? LocalDate.now() : input.playedOn());
		entry.setSessionHours(input.sessionHours());
		entry.setSpoilers(input.spoilers());
	}

	private void checkOwner(JournalEntry entry, Long userId) {
		if (!entry.getUser().getId().equals(userId)) {
			throw new ForbiddenException("Só o dono do diário pode alterar esta atualização");
		}
	}

	private JournalEntry find(Long id) {
		return entries.findById(id).orElseThrow(() -> new NotFoundException("Atualização " + id + " não encontrada"));
	}
}
