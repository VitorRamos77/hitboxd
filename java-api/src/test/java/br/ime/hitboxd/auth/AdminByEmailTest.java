package br.ime.hitboxd.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import br.ime.hitboxd.auth.AuthDtos.Register;
import br.ime.hitboxd.auth.GoogleTokenVerifier.GoogleIdentity;
import br.ime.hitboxd.user.UserRepository;

/** Quem vira admin pelo e-mail, e quem não pode virar. */
@SpringBootTest(properties = "hitboxd.admin-emails=chefe@example.com")
class AdminByEmailTest {

	@Autowired
	AuthService auth;

	@Autowired
	UserRepository users;

	@MockitoBean
	GoogleTokenVerifier google;

	@Test
	void contaGoogleComEmailDaListaEhAdmin() {
		when(google.verify("token-chefe")).thenReturn(new GoogleIdentity("sub-chefe", "chefe@example.com", true, "Chefe"));
		var session = auth.loginWithGoogle("token-chefe");
		var me = auth.me(new AuthUser(session.user().id(), session.user().username()));
		assertTrue(me.admin());
		assertTrue(me.emailVerified());
	}

	@Test
	void cadastroComSenhaUsandoEmailDaListaNaoEhAdmin() {
		var session = auth.register(new Register("intruso", "Intruso", "senha-segura-1", "chefe2@example.com", null));
		var me = auth.me(new AuthUser(session.user().id(), session.user().username()));
		assertFalse(me.admin());
		assertFalse(me.emailVerified());
	}

	@Test
	void googleNaoSeLigaAContaComEmailNaoVerificado() {
		// alguém cadastra com senha usando o e-mail de outra pessoa...
		var intruder = auth.register(new Register("impostor", "Impostor", "senha-segura-1", "dono@example.com", null));
		// ...e depois o dono de verdade entra com o Google
		when(google.verify("token-dono")).thenReturn(new GoogleIdentity("sub-dono", "dono@example.com", true, "Dono"));
		var owner = auth.loginWithGoogle("token-dono");

		assertNotEquals(intruder.user().id(), owner.user().id(), "não pode entrar na conta do impostor");
		assertNull(users.findById(intruder.user().id()).orElseThrow().getEmail(), "o impostor perde o e-mail");
		assertEquals("dono@example.com", users.findById(owner.user().id()).orElseThrow().getEmail());
	}

	@Test
	void segundoLoginGoogleVoltaParaAMesmaConta() {
		when(google.verify("token-a")).thenReturn(new GoogleIdentity("sub-a", "a@example.com", true, "A"));
		var first = auth.loginWithGoogle("token-a");
		var second = auth.loginWithGoogle("token-a");
		assertEquals(first.user().id(), second.user().id());
	}
}
