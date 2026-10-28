package br.ime.hitboxd.journal;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.ime.hitboxd.journal.JournalDtos.EntryInput;
import br.ime.hitboxd.journal.JournalDtos.EntryView;
import br.ime.hitboxd.journal.JournalDtos.JournalGame;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api")
public class JournalController {

	private final JournalService service;

	public JournalController(JournalService service) {
		this.service = service;
	}

	/** Os jogos que aparecem no diário do usuário, com resumo de cada um. */
	@GetMapping("/users/{userId}/journal")
	public List<JournalGame> games(@PathVariable Long userId) {
		return service.games(userId);
	}

	/** As atualizações do diário de um jogo, das mais recentes às mais antigas. */
	@GetMapping("/users/{userId}/journal/{gameId}")
	public List<EntryView> entries(@PathVariable Long userId, @PathVariable Long gameId) {
		return service.entries(userId, gameId);
	}

	@PostMapping("/journal")
	@ResponseStatus(HttpStatus.CREATED)
	public EntryView create(@Valid @RequestBody EntryInput input) {
		return service.create(input);
	}

	@PutMapping("/journal/{id}")
	public EntryView update(@PathVariable Long id, @Valid @RequestBody EntryInput input) {
		return service.update(id, input);
	}

	@DeleteMapping("/journal/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@PathVariable Long id, @RequestParam Long userId) {
		service.delete(id, userId);
	}
}
