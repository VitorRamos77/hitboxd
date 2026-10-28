package br.ime.hitboxd.common;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import br.ime.hitboxd.gamelist.GameList;
import br.ime.hitboxd.gamelist.GameListRepository;
import br.ime.hitboxd.review.PlayStatus;
import br.ime.hitboxd.review.Review;
import br.ime.hitboxd.review.ReviewRepository;
import br.ime.hitboxd.user.User;
import br.ime.hitboxd.user.UserRepository;

/**
 * Dados de exemplo. Os ids de jogos seguem a ordem do catálogo do serviço Python
 * (1 = Zelda BotW, 2 = Elden Ring, 3 = Hades, ...).
 */
@Component
@ConditionalOnProperty(name = "hitboxd.seed", havingValue = "true")
public class DataSeeder implements CommandLineRunner {

	private record SeedReview(int user, long game, Double rating, boolean liked, PlayStatus status, int daysAgo,
			String text) {
	}

	private static final List<SeedReview> REVIEWS = List.of(
			new SeedReview(0, 2, 5.0, true, PlayStatus.PLATINADO, 2,
					"Cada chefe é uma prova de paciência. Malenia me derrotou 87 vezes e eu agradeci a cada uma."),
			new SeedReview(0, 17, 4.5, true, PlayStatus.ZERADO, 20,
					"O sistema de postura transforma cada luta numa dança. Mais difícil e mais justo que os Souls."),
			new SeedReview(0, 4, 4.5, true, PlayStatus.ZERADO, 45, "Atmosfera impecável e uma trilha que fica na cabeça."),
			new SeedReview(0, 3, 4.0, false, PlayStatus.JOGADO, 70, null),
			new SeedReview(0, 12, 4.0, true, PlayStatus.ZERADO, 110,
					"A câmera sem cortes e a relação entre pai e filho seguram tudo."),
			new SeedReview(0, 6, 2.0, false, PlayStatus.ABANDONADO, 130,
					"Tranquilo demais para mim. Plantei nabos por três horas e fui jogar outra coisa."),
			new SeedReview(1, 3, 5.0, true, PlayStatus.ZERADO, 1,
					"A melhor integração de narrativa com roguelike que já vi. Morrer faz a história avançar."),
			new SeedReview(1, 5, 5.0, true, PlayStatus.ZERADO, 15,
					"Um jogo sobre ansiedade que te ensina, fase após fase, que tudo bem tentar de novo."),
			new SeedReview(1, 4, 4.5, true, PlayStatus.JOGANDO, 4, "Perdido em Hallownest há 30 horas e sem pressa de sair."),
			new SeedReview(1, 18, 5.0, true, PlayStatus.ZERADO, 60, "Nunca um jogo me fez sentir tão culpado por apertar FIGHT."),
			new SeedReview(1, 23, 4.0, true, PlayStatus.JOGADO, 90, null),
			new SeedReview(1, 21, 4.0, false, PlayStatus.ZERADO, 100, "Curto, sombrio e com um final que não sai da cabeça."),
			new SeedReview(1, 19, 2.5, false, PlayStatus.ABANDONADO, 150, "Night City é linda, mas não me prendeu."),
			new SeedReview(2, 15, 5.0, true, PlayStatus.ZERADO, 3,
					"O RPG de mesa digital que eu sempre quis. Cada escolha tem consequência de verdade."),
			new SeedReview(2, 9, 5.0, true, PlayStatus.ZERADO, 25,
					"Uma conversa de 30 horas com as vozes da sua própria cabeça. Escrita genial."),
			new SeedReview(2, 7, 4.5, true, PlayStatus.ZERADO, 80, "As missões secundárias valem mais que a principal de muito jogo."),
			new SeedReview(2, 13, 4.5, true, PlayStatus.PLATINADO, 120, "Estilo de sobra. O calendário escolar vicia."),
			new SeedReview(2, 22, 4.0, false, PlayStatus.ZERADO, 140, null),
			new SeedReview(2, 2, 3.5, false, PlayStatus.ABANDONADO, 160, "Respeito, mas a dificuldade não é para mim."),
			new SeedReview(3, 24, 5.0, true, PlayStatus.ZERADO, 5,
					"Joguei com minha namorada e ninguém brigou. Cada fase inventa uma mecânica nova."),
			new SeedReview(3, 16, 4.5, true, PlayStatus.ZERADO, 30, "Pura alegria. O chapéu que possui inimigos é genial."),
			new SeedReview(3, 1, 5.0, true, PlayStatus.ZERADO, 75, "Subi numa montanha só porque ela estava lá. Liberdade total."),
			new SeedReview(3, 11, 4.0, true, PlayStatus.JOGANDO, 8, null),
			new SeedReview(3, 6, 4.5, true, PlayStatus.JOGADO, 95, "Cooperativo com amigos deixa tudo ainda melhor."),
			new SeedReview(3, 17, 2.0, false, PlayStatus.ABANDONADO, 115, "Morri para o primeiro chefe 40 vezes. Não é para mim."),
			new SeedReview(4, 14, 5.0, true, PlayStatus.ZERADO, 6,
					"Jogue sem saber nada. É o único conselho possível. Mudou como vejo exploração em jogos."),
			new SeedReview(4, 10, 5.0, true, PlayStatus.ZERADO, 40, "Os puzzles são perfeitos e o humor envelheceu muito bem."),
			new SeedReview(4, 20, 4.5, true, PlayStatus.JOGADO, 55, "Tetris virou uma experiência quase espiritual."),
			new SeedReview(4, 5, 4.0, true, PlayStatus.ZERADO, 85, null),
			new SeedReview(4, 21, 4.5, true, PlayStatus.ZERADO, 125, "Cada quebra-cabeça conta um pedaço da história."),
			new SeedReview(4, 9, 4.0, false, PlayStatus.JOGANDO, 12, "Lendo muito, pensando mais ainda."),
			new SeedReview(4, 8, 3.0, false, PlayStatus.ABANDONADO, 170, "Lindo, mas lento demais para o meu gosto."));

	private final UserRepository users;
	private final ReviewRepository reviews;
	private final GameListRepository lists;

	public DataSeeder(UserRepository users, ReviewRepository reviews, GameListRepository lists) {
		this.users = users;
		this.reviews = reviews;
		this.lists = lists;
	}

	@Override
	@Transactional
	public void run(String... args) {
		if (users.count() > 0) {
			return;
		}
		List<User> people = users.saveAll(List.of(
				new User("ana_souls", "Ana Lima", "Se não morri 50 vezes, não joguei direito.", "#e4572e"),
				new User("pedro_indie", "Pedro Alves", "Indies, pixel art e trilhas sonoras.", "#29a19c"),
				new User("bia_rpg", "Beatriz Costa", "100 horas é o aquecimento.", "#7768ae"),
				new User("lucas_coop", "Lucas Martins", "Jogo bom é jogo com os amigos.", "#f3a712"),
				new User("marina_puzzle", "Marina Rocha", "Puzzles, mistérios e exploração.", "#3c91e6")));

		follow(people.get(0), people.get(1), people.get(2));
		follow(people.get(1), people.get(0), people.get(4));
		follow(people.get(2), people.get(4));
		follow(people.get(3), people.get(0), people.get(1), people.get(2));
		follow(people.get(4), people.get(1));

		Instant now = Instant.now();
		for (SeedReview s : REVIEWS) {
			Review review = new Review(people.get(s.user()), s.game());
			review.setRating(s.rating());
			review.setLiked(s.liked());
			review.setStatus(s.status());
			review.setText(s.text());
			review.setPlayedOn(LocalDate.now().minusDays(s.daysAgo()));
			review.setCreatedAt(now.minus(s.daysAgo(), ChronoUnit.DAYS).minus(s.user(), ChronoUnit.HOURS));
			for (int i = 0; i < (s.text() == null ? 0 : s.text().length() % 7); i++) {
				review.addLike();
			}
			reviews.save(review);
		}

		list(people.get(0), "Os mais difíceis que zerei", "Ordem de sofrimento, do maior para o menor.", true,
				17L, 2L, 4L, 3L);
		list(people.get(1), "Indies que todo mundo devia jogar", "Pequenos estúdios, grandes jogos.", false, 3L, 5L,
				4L, 18L, 23L, 21L, 14L);
		list(people.get(2), "RPGs para se perder por meses", null, true, 15L, 9L, 7L, 13L, 22L);
		list(people.get(3), "Para jogar no sofá com alguém", "Cooperativos e jogos para revezar o controle.", false,
				24L, 16L, 11L, 6L);
		list(people.get(4), "Quebra-cabeças memoráveis", null, false, 10L, 14L, 20L, 21L);
	}

	private void follow(User user, User... targets) {
		user.getFollowing().addAll(List.of(targets));
	}

	private void list(User owner, String title, String description, boolean ranked, Long... gameIds) {
		GameList list = new GameList(owner, title);
		list.setDescription(description);
		list.setRanked(ranked);
		list.getGameIds().addAll(List.of(gameIds));
		lists.save(list);
	}
}
