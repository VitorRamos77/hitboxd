package br.ime.hitboxd.user;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User, Long> {

	Optional<User> findByUsernameIgnoreCase(String username);

	boolean existsByUsernameIgnoreCase(String username);

	@Query("select count(u) from User u join u.following f where f.id = :userId")
	long countFollowers(Long userId);

	@Query("select u from User u join u.following f where f.id = :userId order by u.displayName")
	List<User> findFollowers(Long userId);
}
