package br.ime.hitboxd.review;

import java.util.Collection;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ReviewRepository extends JpaRepository<Review, Long> {

	@EntityGraph(attributePaths = "user")
	List<Review> findAllByOrderByCreatedAtDesc();

	@EntityGraph(attributePaths = "user")
	List<Review> findByUserIdOrderByPlayedOnDescCreatedAtDesc(Long userId);

	@EntityGraph(attributePaths = "user")
	List<Review> findByGameIdOrderByCreatedAtDesc(Long gameId);

	@EntityGraph(attributePaths = "user")
	List<Review> findByUserIdAndGameIdOrderByPlayedOnDesc(Long userId, Long gameId);

	@EntityGraph(attributePaths = "user")
	List<Review> findByUserIdInOrderByCreatedAtDesc(Collection<Long> userIds, Pageable pageable);

	@EntityGraph(attributePaths = "user")
	List<Review> findAllByOrderByCreatedAtDesc(Pageable pageable);

	@Query("select count(distinct r.gameId) from Review r where r.user.id = :userId")
	long countDistinctGamesByUserId(Long userId);

	@Query("select count(r) from Review r where r.user.id = :userId and r.text is not null and r.text <> ''")
	long countWrittenByUserId(Long userId);
}
