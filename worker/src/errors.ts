/**
 * Errores tipados para distinguir el tratamiento en el loop principal:
 * - SessionExpiredError: re-login y reintento.
 * - LoginFailedError: backoff exponencial; tras N seguidos, backoff largo.
 * - BlockedError: el portal nos bloqueó (captcha/mfa/bloqueo explícito).
 *   NO se evade: se loguea, se alerta y se enfría. Es señal de que el portal
 *   no quiere acceso automatizado.
 * - RetryableError: 429/5xx u otros transitorios.
 */

export class SessionExpiredError extends Error {
  constructor(message = "Sesión expirada") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

export class LoginFailedError extends Error {
  constructor(message = "Login fallido") {
    super(message);
    this.name = "LoginFailedError";
  }
}

export class BlockedError extends Error {
  constructor(message = "Acceso bloqueado por el portal (captcha/mfa/bloqueo)") {
    super(message);
    this.name = "BlockedError";
  }
}

export class RetryableError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "RetryableError";
    this.status = status;
  }
}
