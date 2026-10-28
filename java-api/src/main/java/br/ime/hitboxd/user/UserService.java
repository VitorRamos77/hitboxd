package br.ime.hitboxd.user;

import java.util.Comparator;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.ime.hitboxd.common.ConflictException;
import br.ime.hitboxd.common.NotFoundException;
import br.ime.hitboxd.common.Texts;
import br.ime.hitboxd.gamelist.GameListRepository;
import br.ime.hitboxd.review.ReviewRepository;
import br.ime.hitboxd.user.UserDtos.UpdateUser;
import br.ime.hitboxd.user.UserDtos.UserProfile;
import br.ime.hitboxd.user.UserDtos.UserSummary;

@Service
@Transactional(readOnly = true)
public class UserService {

	public static final int MAX_AVATAR_BYTES = 256 * 1024;
	private static final Set<String> AVATAR_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

	private static final String[] AVATAR_COLORS = { "#e4572e", "#29a19c", "#f3a712", "#7768ae", "#3c91e6", "#d64a8a",
			"#5fad56" };

	private final UserRepository users;
	private final ReviewRepository reviews;
	private final GameListRepository lists;

	public UserService(UserRepository users, ReviewRepository reviews, GameListRepository lists) {
		this.users = users;
		this.reviews = reviews;
		this.lists = lists;
	}

	public User find(Long id) {
		return users.findById(id).orElseThrow(() -> new NotFoundException("Usuário " + id + " não encontrado"));
	}

	public List<UserSummary> all() {
		return users.findAll().stream()
				.sorted(Comparator.comparing(User::getDisplayName, String.CASE_INSENSITIVE_ORDER))
				.map(UserSummary::of)
				.toList();
	}

	/**
	 * Busca por nome ou @usuário, sem diferenciar maiúsculas e acentos. Quem tem o
	 * termo no começo do nome ou do usuário aparece primeiro.
	 */
	public List<UserSummary> search(String query, int limit) {
		String q = Texts.searchKey(query).replaceFirst("^@", "");
		if (q.isEmpty()) {
			return all().stream().limit(limit).toList();
		}
		return users.findAll().stream()
				.filter(u -> Texts.searchKey(u.getUsername()).contains(q) || Texts.searchKey(u.getDisplayName()).contains(q))
				.sorted(Comparator.comparing((User u) -> !(Texts.searchKey(u.getUsername()).startsWith(q)
						|| Texts.searchKey(u.getDisplayName()).startsWith(q)))
						.thenComparing(User::getDisplayName, String.CASE_INSENSITIVE_ORDER))
				.limit(limit)
				.map(UserSummary::of)
				.toList();
	}

	public List<UserSummary> followers(Long id) {
		find(id);
		return users.findFollowers(id).stream().map(UserSummary::of).toList();
	}

	public UserProfile profile(Long id) {
		User user = find(id);
		List<UserSummary> following = user.getFollowing().stream().map(UserSummary::of).toList();
		return new UserProfile(user.getId(), user.getUsername(), user.getDisplayName(), user.getBio(),
				user.getAvatarColor(), user.getAvatarVersion(), user.getCreatedAt(), reviews.countDistinctGamesByUserId(id),
				reviews.countWrittenByUserId(id), lists.countByOwnerId(id), following, users.countFollowers(id));
	}

	/** Cria a conta; a senha ou o vínculo com o Google ficam por conta do {@code AuthService}. */
	@Transactional
	public User newUser(String username, String displayName, String bio) {
		if (users.existsByUsernameIgnoreCase(username)) {
			throw new ConflictException("O nome de usuário @" + username + " já está em uso");
		}
		String color = AVATAR_COLORS[(int) (users.count() % AVATAR_COLORS.length)];
		return users.save(new User(username, displayName, bio, color));
	}

	@Transactional
	public UserProfile update(Long id, UpdateUser input) {
		User user = find(id);
		user.setDisplayName(input.displayName());
		user.setBio(Texts.clean(input.bio()));
		return profile(id);
	}

	public Avatar avatar(Long id) {
		User user = find(id);
		if (user.getAvatar() == null) {
			throw new NotFoundException("Usuário " + id + " não tem foto");
		}
		return new Avatar(user.getAvatar(), user.getAvatarType());
	}

	@Transactional
	public UserProfile setAvatar(Long id, byte[] image, String contentType) {
		if (contentType == null || !AVATAR_TYPES.contains(contentType)) {
			throw new IllegalArgumentException("A foto deve ser JPEG, PNG ou WebP");
		}
		if (image.length == 0 || image.length > MAX_AVATAR_BYTES) {
			throw new IllegalArgumentException("A foto deve ter até 256 KB");
		}
		find(id).setAvatar(image, contentType);
		return profile(id);
	}

	@Transactional
	public UserProfile removeAvatar(Long id) {
		find(id).setAvatar(null, null);
		return profile(id);
	}

	public record Avatar(byte[] bytes, String contentType) {
	}

	@Transactional
	public UserProfile follow(Long id, Long targetId) {
		if (id.equals(targetId)) {
			throw new IllegalArgumentException("Não é possível seguir a si mesmo");
		}
		find(id).getFollowing().add(find(targetId));
		return profile(id);
	}

	@Transactional
	public UserProfile unfollow(Long id, Long targetId) {
		find(id).getFollowing().remove(find(targetId));
		return profile(id);
	}
}
