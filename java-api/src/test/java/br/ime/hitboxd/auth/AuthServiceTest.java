package br.ime.hitboxd.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import br.ime.hitboxd.auth.AuthDtos.Register;
import br.ime.hitboxd.common.ConflictException;
import br.ime.hitboxd.common.ForbiddenException;
import br.ime.hitboxd.common.UnauthorizedException;
import br.ime.hitboxd.review.PlayStatus;
import br.ime.hitboxd.review.ReviewDtos.ReviewInput;
import br.ime.hitboxd.review.ReviewService;

/** Cadastro, login com senha, sessão e a regra de que só o autor altera a própria avaliação. */
@SpringBootTest
class AuthServiceTest {

	@Autowired
	AuthService auth;

	@Autowired
	ReviewService reviews;

	@Test
	void cadastroEntraELoginComASenhaCertaFunciona() {
		var session = auth.register(new Register("teste_login", "Teste Login", "senha-segura-1", null, null));
		assertNotNull(session.token());

		var login = auth.login("teste_login", "senha-segura-1");
		var user = auth.authenticate(login.token()).orElseThrow();
		assertEquals(session.user().id(), user.id());
	}

	@Test
	void senhaErradaDa401() {
		auth.register(new Register("teste_senha", "Teste Senha", "senha-segura-1", null, null));
		assertThrows(UnauthorizedException.class, () -> auth.login("teste_senha", "outra-senha-1"));
	}

	@Test
	void nomeDeUsuarioRepetidoDa409() {
		auth.register(new Register("teste_repetido", "Primeiro", "senha-segura-1", null, null));
		assertThrows(ConflictException.class,
				() -> auth.register(new Register("TESTE_repetido", "Segundo", "senha-segura-1", null, null)));
	}

	@Test
	void tokenInvalidoNaoAutentica() {
		assertTrue(auth.authenticate("token-que-nao-existe").isEmpty());
	}

	@Test
	void soOAutorAlteraAAvaliacao() {
		var autor = auth.register(new Register("teste_autor", "Autor", "senha-segura-1", null, null)).user();
		var outro = auth.register(new Register("teste_outro", "Outro", "senha-segura-1", null, null)).user();
		var input = new ReviewInput(3L, 4.5, true, "Muito bom", PlayStatus.ZERADO, "PC", null, false, false);
		var review = reviews.create(autor.id(), input);

		assertThrows(ForbiddenException.class, () -> reviews.update(review.id(), outro.id(), input));
		assertThrows(ForbiddenException.class, () -> reviews.delete(review.id(), outro.id()));
		reviews.delete(review.id(), autor.id());
	}
}
