package br.ime.hitboxd.gamelist;

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

import br.ime.hitboxd.auth.AuthUser;
import br.ime.hitboxd.auth.CurrentUser;
import br.ime.hitboxd.gamelist.GameListDtos.AddGame;
import br.ime.hitboxd.gamelist.GameListDtos.ListInput;
import br.ime.hitboxd.gamelist.GameListDtos.ListView;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/lists")
public class GameListController {

	private final GameListService service;

	public GameListController(GameListService service) {
		this.service = service;
	}

	@GetMapping
	public List<ListView> search(@RequestParam(required = false) Long ownerId,
			@RequestParam(required = false) Long gameId) {
		return service.search(ownerId, gameId);
	}

	@GetMapping("/{id}")
	public ListView get(@PathVariable Long id) {
		return service.get(id);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public ListView create(@CurrentUser AuthUser me, @Valid @RequestBody ListInput input) {
		return service.create(me.id(), input);
	}

	@PutMapping("/{id}")
	public ListView update(@CurrentUser AuthUser me, @PathVariable Long id, @Valid @RequestBody ListInput input) {
		return service.update(id, me.id(), input);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@CurrentUser AuthUser me, @PathVariable Long id) {
		service.delete(id, me.id());
	}

	@PostMapping("/{id}/games")
	public ListView addGame(@CurrentUser AuthUser me, @PathVariable Long id, @Valid @RequestBody AddGame body) {
		return service.addGame(id, me.id(), body.gameId());
	}

	@DeleteMapping("/{id}/games/{gameId}")
	public ListView removeGame(@CurrentUser AuthUser me, @PathVariable Long id, @PathVariable Long gameId) {
		return service.removeGame(id, me.id(), gameId);
	}
}
