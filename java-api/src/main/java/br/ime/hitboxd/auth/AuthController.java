package br.ime.hitboxd.auth;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.ime.hitboxd.auth.AuthDtos.Config;
import br.ime.hitboxd.auth.AuthDtos.GoogleLogin;
import br.ime.hitboxd.auth.AuthDtos.Login;
import br.ime.hitboxd.auth.AuthDtos.Register;
import br.ime.hitboxd.auth.AuthDtos.Session;
import br.ime.hitboxd.user.UserDtos.Me;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final AuthService auth;
	private final GoogleTokenVerifier google;

	public AuthController(AuthService auth, GoogleTokenVerifier google) {
		this.auth = auth;
		this.google = google;
	}

	@GetMapping("/config")
	public Config config() {
		return new Config(google.isEnabled(), google.isEnabled() ? google.clientId() : null);
	}

	@PostMapping("/register")
	@ResponseStatus(HttpStatus.CREATED)
	public Session register(@Valid @RequestBody Register input) {
		return auth.register(input);
	}

	@PostMapping("/login")
	public Session login(@Valid @RequestBody Login input) {
		return auth.login(input.username(), input.password());
	}

	@PostMapping("/google")
	public Session google(@Valid @RequestBody GoogleLogin input) {
		return auth.loginWithGoogle(input.credential());
	}

	@GetMapping("/me")
	public Me me(@CurrentUser AuthUser me) {
		return auth.me(me);
	}

	@PostMapping("/logout")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void logout(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
		auth.logout(AuthWebConfig.bearerToken(authorization));
	}
}
