package br.ime.hitboxd.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import br.ime.hitboxd.common.UnauthorizedException;

/** Assina tokens com uma chave RSA local, no mesmo formato dos ID tokens do Google. */
class GoogleTokenVerifierTest {

	private static final String CLIENT_ID = "123-teste.apps.googleusercontent.com";

	private KeyPair keyPair;
	private GoogleTokenVerifier verifier;

	@BeforeEach
	void setUp() throws Exception {
		KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
		generator.initialize(2048);
		keyPair = generator.generateKeyPair();
		verifier = new GoogleTokenVerifier(CLIENT_ID);
		verifier.useKeys(Map.of("chave-1", keyPair.getPublic()));
	}

	@Test
	void aceitaTokenValido() throws Exception {
		var identity = verifier.verify(token("chave-1", claims(CLIENT_ID, "https://accounts.google.com", future())));
		assertEquals("42", identity.subject());
		assertEquals("ana@example.com", identity.email());
		assertTrue(identity.emailVerified());
		assertEquals("Ana Lima", identity.name());
	}

	@Test
	void recusaOutroPublico() throws Exception {
		String token = token("chave-1", claims("outro-app", "https://accounts.google.com", future()));
		assertThrows(UnauthorizedException.class, () -> verifier.verify(token));
	}

	@Test
	void recusaOutroEmissor() throws Exception {
		String token = token("chave-1", claims(CLIENT_ID, "https://evil.example.com", future()));
		assertThrows(UnauthorizedException.class, () -> verifier.verify(token));
	}

	@Test
	void recusaTokenExpirado() throws Exception {
		String token = token("chave-1", claims(CLIENT_ID, "accounts.google.com", Instant.now().minusSeconds(3600).getEpochSecond()));
		assertThrows(UnauthorizedException.class, () -> verifier.verify(token));
	}

	@Test
	void recusaConteudoAlterado() throws Exception {
		String[] parts = token("chave-1", claims(CLIENT_ID, "accounts.google.com", future())).split("\\.");
		String forged = parts[0] + "." + b64(claims(CLIENT_ID, "accounts.google.com", future()).replace("42", "1")) + "." + parts[2];
		assertThrows(UnauthorizedException.class, () -> verifier.verify(forged));
	}

	@Test
	void recusaChaveDesconhecida() throws Exception {
		KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
		generator.initialize(2048);
		keyPair = generator.generateKeyPair(); // assina com outra chave, mas diz ser a "chave-1"
		String token = token("chave-1", claims(CLIENT_ID, "accounts.google.com", future()));
		assertThrows(UnauthorizedException.class, () -> verifier.verify(token));
	}

	private String token(String kid, String claims) throws Exception {
		String unsigned = b64("{\"alg\":\"RS256\",\"kid\":\"" + kid + "\"}") + "." + b64(claims);
		Signature rsa = Signature.getInstance("SHA256withRSA");
		rsa.initSign(keyPair.getPrivate());
		rsa.update(unsigned.getBytes(StandardCharsets.US_ASCII));
		return unsigned + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(rsa.sign());
	}

	private static String claims(String aud, String iss, long exp) {
		return "{\"iss\":\"" + iss + "\",\"aud\":\"" + aud + "\",\"sub\":\"42\",\"email\":\"ana@example.com\","
				+ "\"email_verified\":true,\"name\":\"Ana Lima\",\"exp\":" + exp + "}";
	}

	private static long future() {
		return Instant.now().plusSeconds(3600).getEpochSecond();
	}

	private static String b64(String text) {
		return Base64.getUrlEncoder().withoutPadding().encodeToString(text.getBytes(StandardCharsets.UTF_8));
	}
}
