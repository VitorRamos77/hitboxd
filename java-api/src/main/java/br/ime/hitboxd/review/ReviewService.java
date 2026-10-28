package br.ime.hitboxd.review;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.ime.hitboxd.common.ForbiddenException;
import br.ime.hitboxd.common.NotFoundException;
import br.ime.hitboxd.review.ReviewDtos.ReviewInput;
import br.ime.hitboxd.review.ReviewDtos.ReviewView;
import br.ime.hitboxd.user.User;
import br.ime.hitboxd.user.UserService;

@Service
@Transactional(readOnly = true)
public class ReviewService {

	private final ReviewRepository reviews;
	private final UserService users;

	public ReviewService(ReviewRepository reviews, UserService users) {
		this.reviews = reviews;
		this.users = users;
	}

	public List<ReviewView> search(Long userId, Long gameId) {
		List<Review> found;
		if (userId != null && gameId != null) {
			found = reviews.findByUserIdAndGameIdOrderByPlayedOnDesc(userId, gameId);
		} else if (userId != null) {
			found = reviews.findByUserIdOrderByPlayedOnDescCreatedAtDesc(userId);
		} else if (gameId != null) {
			found = reviews.findByGameIdOrderByCreatedAtDesc(gameId);
		} else {
			found = reviews.findAllByOrderByCreatedAtDesc();
		}
		return found.stream().map(ReviewView::of).toList();
	}

	public ReviewView get(Long id) {
		return ReviewView.of(find(id));
	}

	/** Atividade recente de quem o usuário segue; sem usuário (ou sem ninguém seguido), da comunidade toda. */
	public List<ReviewView> feed(Long userId, int limit) {
		PageRequest page = PageRequest.of(0, limit);
		if (userId != null) {
			Set<Long> followed = users.find(userId).getFollowing().stream()
					.map(User::getId)
					.collect(Collectors.toSet());
			if (!followed.isEmpty()) {
				return reviews.findByUserIdInOrderByCreatedAtDesc(followed, page).stream().map(ReviewView::of).toList();
			}
		}
		return reviews.findAllByOrderByCreatedAtDesc(page).stream().map(ReviewView::of).toList();
	}

	@Transactional
	public ReviewView create(Long authorId, ReviewInput input) {
		Review review = new Review(users.find(authorId), input.gameId());
		apply(review, input);
		return ReviewView.of(reviews.save(review));
	}

	@Transactional
	public ReviewView update(Long id, Long authorId, ReviewInput input) {
		Review review = find(id);
		checkAuthor(review, authorId);
		if (!review.getGameId().equals(input.gameId())) {
			throw new IllegalArgumentException("Não é possível mover a avaliação para outro jogo");
		}
		apply(review, input);
		return ReviewView.of(review);
	}

	@Transactional
	public void delete(Long id, Long authorId) {
		Review review = find(id);
		checkAuthor(review, authorId);
		reviews.delete(review);
	}

	private void checkAuthor(Review review, Long userId) {
		if (!review.getUser().getId().equals(userId)) {
			throw new ForbiddenException("Só o autor pode alterar esta avaliação");
		}
	}

	/** Alterna a curtida do usuário: a primeira chamada curte, a segunda descurte. */
	@Transactional
	public ReviewView toggleLike(Long id, Long userId) {
		Review review = find(id);
		review.toggleLike(users.find(userId));
		return ReviewView.of(review);
	}

	private void apply(Review review, ReviewInput input) {
		if (input.rating() != null && input.rating() * 2 != Math.floor(input.rating() * 2)) {
			throw new IllegalArgumentException("A nota deve ser em meias estrelas (0.5, 1.0, ... 5.0)");
		}
		review.setRating(input.rating());
		review.setLiked(input.liked());
		review.setText(input.text() == null || input.text().isBlank() ? null : input.text().strip());
		review.setStatus(input.status() == null ? PlayStatus.JOGADO : input.status());
		review.setPlatform(input.platform());
		review.setPlayedOn(input.playedOn() == null ? LocalDate.now() : input.playedOn());
		review.setReplay(input.replay());
		review.setSpoilers(input.spoilers());
	}

	private Review find(Long id) {
		return reviews.findById(id).orElseThrow(() -> new NotFoundException("Avaliação " + id + " não encontrada"));
	}
}
