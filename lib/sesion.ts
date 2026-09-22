// Cuándo la cookie de sesión apunta a algo que ya no existe.
//
// Pasa cada vez que se borra un usuario, se revoca una sesión o se rota una
// clave: el navegador sigue mandando la cookie vieja, Supabase intenta
// refrescarla y el servidor de Auth contesta 400 refresh_token_not_found.
// Si no se borra la cookie, eso se repite en CADA request para siempre.
//
// La distinción que importa es con una caída del servidor de Auth: ahí el
// error es de red (AuthRetryableFetchError) y la sesión puede estar
// perfectamente viva. Borrar la cookie en ese caso desloguea a todo el mundo
// por un corte de dos minutos, así que solo cuenta como sesión caída lo que el
// servidor RESPONDIÓ, nunca lo que no se pudo preguntar.

export type ErrorAuth = {
  name?: string;
  code?: string;
  status?: number;
} | null | undefined;

/** Códigos con los que Auth dice "esa sesión no es de nadie". */
const CODIGOS_MUERTOS = new Set([
  "refresh_token_not_found",
  "refresh_token_already_used",
  "refresh_token_revoked",
  "session_not_found",
  "session_expired",
  "user_not_found",
  "user_banned",
]);

export function sesionCaida(error: ErrorAuth): boolean {
  if (!error) return false;

  // Un error de red no dice nada sobre la sesión: puede estar viva y el
  // servidor caído. No se toca la cookie.
  if (error.name === "AuthRetryableFetchError") return false;

  if (error.code && CODIGOS_MUERTOS.has(error.code)) return true;

  // Sin código (versiones viejas del API), el 401/403 de Auth ya es
  // "esta credencial no vale". El 400 sin código puede ser cualquier cosa,
  // así que no alcanza.
  if (error.name === "AuthApiError" && (error.status === 401 || error.status === 403)) {
    return true;
  }

  // La sesión no está ni en la cookie: no hay nada que refrescar.
  return error.name === "AuthSessionMissingError";
}
