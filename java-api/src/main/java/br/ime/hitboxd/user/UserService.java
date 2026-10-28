package br.ime.hitboxd.user;

import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.ime.hitboxd.common.ConflictException;
import br.ime.hitboxd.common.NotFoundException;
import br.ime.hitboxd.gamelist.GameListRepository;
import br.ime.hitboxd.review.ReviewRepository;
import br.ime.hitboxd.user.UserDtos.CreateUser;
import br.ime.hitboxd.user.UserDtos.UpdateUser;
import br.ime.hitboxd.user.UserDtos.UserProfile;
import br.ime.hitboxd.user.UserDtos.UserSummary;

@Service
@Transactional(readOnly = true)
public class UserService {

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

	public List<UserSummary> followers(Long id) {
		find(id);
		return users.findFollowers(id).stream().map(UserSummary::of).toList();
	}

	public UserProfile profile(Long id) {
		User user = find(id);
		List<UserSummary> following = user.getFollowing().stream().map(UserSummary::of).toList();
		return new UserProfile(user.getId(), user.getUsername(), user.getDisplayName(), user.getBio(),
				user.getAvatarColor(), user.getCreatedAt(), reviews.countDistinctGamesByUserId(id),
				reviews.countWrittenByUserId(id), lists.countByOwnerId(id), following, users.countFollowers(id));
	}

	@Transactional
	public UserProfile create(CreateUser input) {
		if (users.existsByUsernameIgnoreCase(input.username())) {
			throw new ConflictException("O nome de usuário @" + input.username() + " já está em uso");
		}
		String color = AVATAR_COLORS[(int) (users.count() % AVATAR_COLORS.length)];
		User user = users.save(new User(input.username(), input.displayName(), input.bio(), color));
		return profile(user.getId());
	}

	@Transactional
	public UserProfile update(Long id, UpdateUser input) {
		User user = find(id);
		user.setDisplayName(input.displayName());
		user.setBio(input.bio());
		return profile(id);
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
