package br.ime.hitboxd.user;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.ime.hitboxd.user.UserDtos.CreateUser;
import br.ime.hitboxd.user.UserDtos.UpdateUser;
import br.ime.hitboxd.user.UserDtos.UserProfile;
import br.ime.hitboxd.user.UserDtos.UserSummary;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/users")
public class UserController {

	private final UserService service;

	public UserController(UserService service) {
		this.service = service;
	}

	@GetMapping
	public List<UserSummary> all() {
		return service.all();
	}

	@GetMapping("/{id}")
	public UserProfile get(@PathVariable Long id) {
		return service.profile(id);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public UserProfile create(@Valid @RequestBody CreateUser input) {
		return service.create(input);
	}

	@PutMapping("/{id}")
	public UserProfile update(@PathVariable Long id, @Valid @RequestBody UpdateUser input) {
		return service.update(id, input);
	}

	@GetMapping("/{id}/followers")
	public List<UserSummary> followers(@PathVariable Long id) {
		return service.followers(id);
	}

	@PostMapping("/{id}/following/{targetId}")
	public UserProfile follow(@PathVariable Long id, @PathVariable Long targetId) {
		return service.follow(id, targetId);
	}

	@DeleteMapping("/{id}/following/{targetId}")
	public UserProfile unfollow(@PathVariable Long id, @PathVariable Long targetId) {
		return service.unfollow(id, targetId);
	}
}
