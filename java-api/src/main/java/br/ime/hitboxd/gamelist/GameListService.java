package br.ime.hitboxd.gamelist;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.ime.hitboxd.common.ForbiddenException;
import br.ime.hitboxd.common.NotFoundException;
import br.ime.hitboxd.gamelist.GameListDtos.ListInput;
import br.ime.hitboxd.gamelist.GameListDtos.ListView;
import br.ime.hitboxd.user.UserService;

@Service
@Transactional(readOnly = true)
public class GameListService {

	private final GameListRepository lists;
	private final UserService users;

	public GameListService(GameListRepository lists, UserService users) {
		this.lists = lists;
		this.users = users;
	}

	public List<ListView> search(Long ownerId, Long gameId) {
		List<GameList> found;
		if (ownerId != null) {
			found = lists.findByOwnerIdOrderByCreatedAtDesc(ownerId);
		} else if (gameId != null) {
			found = lists.findContainingGame(gameId);
		} else {
			found = lists.findAllByOrderByCreatedAtDesc();
		}
		if (ownerId != null && gameId != null) {
			found = found.stream().filter(l -> l.getGameIds().contains(gameId)).toList();
		}
		return found.stream().map(ListView::of).toList();
	}

	public ListView get(Long id) {
		return ListView.of(find(id));
	}

	@Transactional
	public ListView create(Long ownerId, ListInput input) {
		GameList list = new GameList(users.find(ownerId), input.title().strip());
		apply(list, input);
		return ListView.of(lists.save(list));
	}

	@Transactional
	public ListView update(Long id, Long ownerId, ListInput input) {
		GameList list = owned(id, ownerId);
		list.setTitle(input.title().strip());
		apply(list, input);
		return ListView.of(list);
	}

	@Transactional
	public void delete(Long id, Long ownerId) {
		lists.delete(owned(id, ownerId));
	}

	@Transactional
	public ListView addGame(Long id, Long ownerId, Long gameId) {
		GameList list = owned(id, ownerId);
		if (!list.getGameIds().contains(gameId)) {
			list.getGameIds().add(gameId);
		}
		return ListView.of(list);
	}

	@Transactional
	public ListView removeGame(Long id, Long ownerId, Long gameId) {
		GameList list = owned(id, ownerId);
		list.getGameIds().remove(gameId);
		return ListView.of(list);
	}

	private void apply(GameList list, ListInput input) {
		list.setDescription(input.description());
		list.setRanked(input.ranked());
		if (input.gameIds() != null) {
			list.getGameIds().clear();
			input.gameIds().stream().distinct().forEach(list.getGameIds()::add);
		}
	}

	private GameList owned(Long id, Long ownerId) {
		GameList list = find(id);
		if (!list.getOwner().getId().equals(ownerId)) {
			throw new ForbiddenException("Só o dono pode alterar esta lista");
		}
		return list;
	}

	private GameList find(Long id) {
		return lists.findById(id).orElseThrow(() -> new NotFoundException("Lista " + id + " não encontrada"));
	}
}
