package br.ime.hitboxd.journal;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface JournalRepository extends JpaRepository<JournalEntry, Long> {

	/** Mais recentes primeiro: pelo dia da sessão e, dentro do dia, pela hora em que foi escrita. */
	List<JournalEntry> findByUserIdAndGameIdOrderByPlayedOnDescCreatedAtDesc(Long userId, Long gameId);

	List<JournalEntry> findByUserIdOrderByPlayedOnDescCreatedAtDesc(Long userId);
}
