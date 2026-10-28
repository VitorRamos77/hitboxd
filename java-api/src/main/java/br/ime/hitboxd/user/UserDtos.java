package br.ime.hitboxd.user;

import java.time.Instant;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class UserDtos {

	private UserDtos() {
	}

	public record CreateUser(
			@NotBlank @Pattern(regexp = "^[a-zA-Z0-9_]{3,30}$", message = "use 3 a 30 letras, números ou _") String username,
			@NotBlank @Size(max = 60) String displayName,
			@Size(max = 280) String bio) {
	}

	public record UpdateUser(@NotBlank @Size(max = 60) String displayName, @Size(max = 280) String bio) {
	}

	public record UserSummary(Long id, String username, String displayName, String avatarColor, Long avatarVersion) {

		public static UserSummary of(User user) {
			return new UserSummary(user.getId(), user.getUsername(), user.getDisplayName(), user.getAvatarColor(),
					user.getAvatarVersion());
		}
	}

	public record UserProfile(
			Long id,
			String username,
			String displayName,
			String bio,
			String avatarColor,
			Long avatarVersion,
			Instant createdAt,
			long gamesLogged,
			long reviewsWritten,
			long listsCreated,
			List<UserSummary> following,
			long followers) {
	}
}
