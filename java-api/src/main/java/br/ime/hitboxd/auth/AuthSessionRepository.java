package br.ime.hitboxd.auth;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface AuthSessionRepository extends JpaRepository<AuthSession, Long> {

	@EntityGraph(attributePaths = "user")
	Optional<AuthSession> findByTokenHash(String tokenHash);

	@Modifying
	@Query("delete from AuthSession s where s.tokenHash = :tokenHash")
	void deleteByTokenHash(String tokenHash);

	@Modifying
	@Query("delete from AuthSession s where s.expiresAt < :now")
	void deleteExpired(Instant now);
}
