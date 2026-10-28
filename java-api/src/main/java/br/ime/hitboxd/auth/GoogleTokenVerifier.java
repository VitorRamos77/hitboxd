package br.ime.hitboxd.auth;

import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.RSAPublicKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import br.ime.hitboxd.common.UnauthorizedException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Confere o "ID token" que o botão "Entrar com o Google" entrega ao navegador:
 * assinatura RS256 com as chaves públicas do Google, emissor, público (o nosso
 * client ID) e validade. Só depois disso o e-mail do token é aceito.
 */
@Component
public class GoogleTokenVerifier {

	private static final URI CERTS = URI.create("https://www.googleapis.com/oauth2/v3/certs");
	private static final Set<String> ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");
	private static final Duration KEYS_TTL = Duration.ofHours(1);
	private static final Duration CLOCK_SKEW = Duration.ofMinutes(2);

	public record GoogleIdentity(String subject, String email, boolean emailVerified, String name) {
	}

	private final String clientId;
	private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
	private final JsonMapper json = JsonMapper.builder().build();
	private Map<String, PublicKey> keys = Map.of();
	private Instant keysFetchedAt = Instant.EPOCH;

	public GoogleTokenVerifier(@Value("${hitboxd.google.client-id:}") String clientId) {
		this.clientId = clientId == null ? "" : clientId.strip();
	}

	public boolean isEnabled() {
		return !clientId.isEmpty();
	}

	public String clientId() {
		return clientId;
	}

	public GoogleIdentity verify(String idToken) {
		if (!isEnabled()) {
			throw new IllegalStateException("Login com o Google não configurado (GOOGLE_CLIENT_ID)");
		}
		String[] parts = idToken == null ? new String[0] : idToken.split("\\.");
		if (parts.length != 3) {
			throw invalid();
		}
		try {
			JsonNode header = json.readTree(decode(parts[0]));
			JsonNode claims = json.readTree(decode(parts[1]));
			if (!"RS256".equals(header.path("alg").asString())) {
				throw invalid();
			}
			PublicKey key = key(header.path("kid").asString());
			Signature rsa = Signature.getInstance("SHA256withRSA");
			rsa.initVerify(key);
			rsa.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
			if (!rsa.verify(Base64.getUrlDecoder().decode(parts[2]))) {
				throw invalid();
			}

			Instant now = Instant.now();
			boolean valid = ISSUERS.contains(claims.path("iss").asString())
					&& clientId.equals(claims.path("aud").asString())
					&& Instant.ofEpochSecond(claims.path("exp").asLong()).plus(CLOCK_SKEW).isAfter(now)
					&& claims.hasNonNull("sub");
			if (!valid) {
				throw invalid();
			}
			return new GoogleIdentity(claims.path("sub").asString(), claims.path("email").asString(null),
					claims.path("email_verified").asBoolean(false), claims.path("name").asString(null));
		} catch (UnauthorizedException e) {
			throw e;
		} catch (Exception e) {
			throw invalid();
		}
	}

	/** Chaves públicas do Google, guardadas por uma hora; recarrega se aparecer um "kid" novo. */
	private synchronized PublicKey key(String kid) throws Exception {
		boolean stale = Instant.now().isAfter(keysFetchedAt.plus(KEYS_TTL));
		if (stale || !keys.containsKey(kid)) {
			HttpResponse<String> response = http.send(HttpRequest.newBuilder(CERTS).timeout(Duration.ofSeconds(5)).build(),
					HttpResponse.BodyHandlers.ofString());
			Map<String, PublicKey> fresh = new HashMap<>();
			KeyFactory rsa = KeyFactory.getInstance("RSA");
			for (JsonNode jwk : json.readTree(response.body()).path("keys")) {
				BigInteger n = new BigInteger(1, Base64.getUrlDecoder().decode(jwk.path("n").asString()));
				BigInteger e = new BigInteger(1, Base64.getUrlDecoder().decode(jwk.path("e").asString()));
				fresh.put(jwk.path("kid").asString(), rsa.generatePublic(new RSAPublicKeySpec(n, e)));
			}
			keys = fresh;
			keysFetchedAt = Instant.now();
		}
		PublicKey key = keys.get(kid);
		if (key == null) {
			throw invalid();
		}
		return key;
	}

	/** Para testes: usa estas chaves em vez de buscar as do Google. */
	synchronized void useKeys(Map<String, PublicKey> testKeys) {
		keys = Map.copyOf(testKeys);
		keysFetchedAt = Instant.now();
	}

	private static byte[] decode(String part) {
		return Base64.getUrlDecoder().decode(part);
	}

	private static UnauthorizedException invalid() {
		return new UnauthorizedException("Não foi possível confirmar o login com o Google");
	}
}
