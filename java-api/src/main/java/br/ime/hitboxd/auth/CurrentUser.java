package br.ime.hitboxd.auth;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Injeta o {@link AuthUser} do pedido num parâmetro de controller. Sem um
 * {@code Authorization: Bearer <token>} válido, o pedido recebe 401.
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
public @interface CurrentUser {
}
