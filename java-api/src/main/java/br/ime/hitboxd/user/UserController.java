package br.ime.hitboxd.user;

import java.time.Duration;
import java.util.List;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.ime.hitboxd.auth.AuthUser;
import br.ime.hitboxd.auth.CurrentUser;
import br.ime.hitboxd.common.ForbiddenException;
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

	/** Todos os usuários, ou só os que combinam com {@code q} (nome ou @usuário). */
	@GetMapping
	public List<UserSummary> all(@RequestParam(required = false) String q,
			@RequestParam(defaultValue = "200") int limit) {
		return q == null ? service.all() : service.search(q, Math.clamp(limit, 1, 200));
	}

	@GetMapping("/{id}")
	public UserProfile get(@PathVariable Long id) {
		return service.profile(id);
	}

	@PutMapping("/{id}")
	public UserProfile update(@CurrentUser AuthUser me, @PathVariable Long id, @Valid @RequestBody UpdateUser input) {
		requireSelf(me, id);
		return service.update(id, input);
	}

	/** A foto é servida à parte para não pesar as listas e o feed, que só levam avatarVersion. */
	@GetMapping("/{id}/avatar")
	public ResponseEntity<byte[]> avatar(@PathVariable Long id) {
		UserService.Avatar avatar = service.avatar(id);
		return ResponseEntity.ok()
				.contentType(MediaType.parseMediaType(avatar.contentType()))
				.cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
				.body(avatar.bytes());
	}

	@PutMapping(path = "/{id}/avatar", consumes = { "image/jpeg", "image/png", "image/webp" })
	public UserProfile setAvatar(@CurrentUser AuthUser me, @PathVariable Long id, @RequestBody byte[] image,
			@RequestHeader(HttpHeaders.CONTENT_TYPE) String contentType) {
		requireSelf(me, id);
		return service.setAvatar(id, image, contentType);
	}

	@DeleteMapping("/{id}/avatar")
	public UserProfile removeAvatar(@CurrentUser AuthUser me, @PathVariable Long id) {
		requireSelf(me, id);
		return service.removeAvatar(id);
	}

	@GetMapping("/{id}/followers")
	public List<UserSummary> followers(@PathVariable Long id) {
		return service.followers(id);
	}

	@PostMapping("/{id}/following/{targetId}")
	public UserProfile follow(@CurrentUser AuthUser me, @PathVariable Long id, @PathVariable Long targetId) {
		requireSelf(me, id);
		return service.follow(id, targetId);
	}

	@DeleteMapping("/{id}/following/{targetId}")
	public UserProfile unfollow(@CurrentUser AuthUser me, @PathVariable Long id, @PathVariable Long targetId) {
		requireSelf(me, id);
		return service.unfollow(id, targetId);
	}

	/** Cada um só altera a própria conta. */
	private static void requireSelf(AuthUser me, Long id) {
		if (!me.id().equals(id)) {
			throw new ForbiddenException("Você só pode alterar a sua própria conta");
		}
	}
}
