package br.ime.hitboxd.review;

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
import br.ime.hitboxd.review.ReviewDtos.ReviewInput;
import br.ime.hitboxd.review.ReviewDtos.ReviewView;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api")
public class ReviewController {

	private final ReviewService service;

	public ReviewController(ReviewService service) {
		this.service = service;
	}

	@GetMapping("/reviews")
	public List<ReviewView> search(@RequestParam(required = false) Long userId,
			@RequestParam(required = false) Long gameId) {
		return service.search(userId, gameId);
	}

	@GetMapping("/reviews/{id}")
	public ReviewView get(@PathVariable Long id) {
		return service.get(id);
	}

	@PostMapping("/reviews")
	@ResponseStatus(HttpStatus.CREATED)
	public ReviewView create(@CurrentUser AuthUser me, @Valid @RequestBody ReviewInput input) {
		return service.create(me.id(), input);
	}

	@PutMapping("/reviews/{id}")
	public ReviewView update(@CurrentUser AuthUser me, @PathVariable Long id, @Valid @RequestBody ReviewInput input) {
		return service.update(id, me.id(), input);
	}

	@DeleteMapping("/reviews/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@CurrentUser AuthUser me, @PathVariable Long id) {
		service.delete(id, me.id());
	}

	@PostMapping("/reviews/{id}/like")
	public ReviewView like(@CurrentUser AuthUser me, @PathVariable Long id) {
		return service.toggleLike(id, me.id());
	}

	/** O diário do usuário: entradas em ordem da data em que jogou. */
	@GetMapping("/users/{userId}/diary")
	public List<ReviewView> diary(@PathVariable Long userId) {
		return service.search(userId, null);
	}

	@GetMapping("/feed")
	public List<ReviewView> feed(@RequestParam(required = false) Long userId,
			@RequestParam(defaultValue = "20") int limit) {
		return service.feed(userId, Math.clamp(limit, 1, 100));
	}
}
