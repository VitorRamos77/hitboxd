package br.ime.hitboxd.gamelist;

import java.util.List;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface GameListRepository extends JpaRepository<GameList, Long> {

	@EntityGraph(attributePaths = { "owner", "gameIds" })
	List<GameList> findAllByOrderByCreatedAtDesc();

	@EntityGraph(attributePaths = { "owner", "gameIds" })
	List<GameList> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);

	@EntityGraph(attributePaths = { "owner", "gameIds" })
	@Query("select distinct l from GameList l join l.gameIds g where g = :gameId order by l.createdAt desc")
	List<GameList> findContainingGame(Long gameId);

	long countByOwnerId(Long ownerId);
}
