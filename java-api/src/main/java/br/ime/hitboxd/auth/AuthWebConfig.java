package br.ime.hitboxd.auth;

import java.util.List;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import br.ime.hitboxd.common.UnauthorizedException;

/** Resolve os parâmetros {@link CurrentUser} a partir do cabeçalho Authorization. */
@Configuration
public class AuthWebConfig implements WebMvcConfigurer {

	private final AuthService auth;

	public AuthWebConfig(AuthService auth) {
		this.auth = auth;
	}

	@Override
	public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
		resolvers.add(new HandlerMethodArgumentResolver() {
			@Override
			public boolean supportsParameter(MethodParameter parameter) {
				return parameter.hasParameterAnnotation(CurrentUser.class)
						&& parameter.getParameterType().equals(AuthUser.class);
			}

			@Override
			public AuthUser resolveArgument(MethodParameter parameter, ModelAndViewContainer mav,
					NativeWebRequest request, WebDataBinderFactory binders) {
				return auth.authenticate(bearerToken(request.getHeader(HttpHeaders.AUTHORIZATION)))
						.orElseThrow(() -> new UnauthorizedException("Entre na sua conta para fazer isso"));
			}
		});
	}

	static String bearerToken(String header) {
		return header != null && header.startsWith("Bearer ") ? header.substring(7).strip() : null;
	}
}
