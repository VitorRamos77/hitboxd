package br.ime.hitboxd.user;

import java.time.Instant;
import java.util.List;

import br.ime.hitboxd.common.Texts;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class UserDtos {

	private UserDtos() {
	}

	public record UpdateUser(@NotBlank @Size(max = 60) String displayName, @Size(max = Texts.BIO_MAX, message = "a bio pode ter até 280 caracteres") String bio) {
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

	/** Os dados da própria conta, que só o dono vê. */
	public record Me(UserSummary user, String email, boolean emailVerified, boolean hasPassword,
			boolean googleLinked, boolean admin) {

		public static Me of(User user, boolean admin) {
			return new Me(UserSummary.of(user), user.getEmail(), user.isEmailVerified(), user.getPasswordHash() != null,
					user.getGoogleSub() != null, admin);
		}
	}
}
