import { request } from "undici";
import type { Config } from "../config/index.js";
import type { Logger } from "../logger.js";
import { RetryableError, SessionExpiredError } from "../errors.js";
import { computeBackoffMs, sleep } from "../util/time.js";
import { isChallengeHtml } from "./parser.js";
import { BlockedError } from "../errors.js";

/**
 * GET de una página del portal reusando la cookie de sesión. El portal
 * (Passion Events Booking System) es PHP server-side: las páginas devuelven
 * HTML directo, así que leemos HTML con undici (liviano, sin browser).
 *
 * - 401/403 o redirect a login -> SessionExpiredError (el loop re-loguea).
 * - captcha/MFA en el HTML -> BlockedError (no se evade).
 * - 429/5xx -> RetryableError con backoff exponencial + jitter acotado acá.
 * - Nunca loguea la cookie.
 */
export async function fetchPortalHtml(opts: {
  url: string;
  cookieHeader: string;
  cfg: Config;
  log: Logger;
  signal?: AbortSignal;
  maxRetries?: number;
}): Promise<string> {
  const { url, cookieHeader, cfg, log, signal } = opts;
  const maxRetries = opts.maxRetries ?? 3;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await request(url, {
        method: "GET",
        headers: {
          cookie: cookieHeader,
          "user-agent": cfg.USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        maxRedirections: 0, // un redirect suele ser expiración de sesión
        signal,
      });

      const { statusCode, headers } = res;
      if (statusCode === 401 || statusCode === 403) {
        await res.body.dump();
        throw new SessionExpiredError(`HTTP ${statusCode} en ${url}`);
      }
      if (statusCode >= 300 && statusCode < 400) {
        await res.body.dump();
        const loc = String(headers["location"] ?? "");
        if (/login|signin|index\.php|^\/?$/i.test(loc)) {
          throw new SessionExpiredError(`Redirect a "${loc}" desde ${url}`);
        }
        throw new RetryableError(`Redirect inesperado (${statusCode}) en ${url}`, statusCode);
      }
      if (statusCode === 429 || statusCode >= 500) {
        await res.body.dump();
        throw new RetryableError(`HTTP ${statusCode} en ${url}`, statusCode);
      }
      const html = await res.body.text();
      if (isChallengeHtml(html)) {
        throw new BlockedError("Captcha/MFA detectado en el HTML del portal.");
      }
      return html;
    } catch (err) {
      if (err instanceof SessionExpiredError || err instanceof BlockedError) throw err;
      lastErr = err;
      if (!(err instanceof RetryableError) || attempt === maxRetries) throw err;
      const wait = computeBackoffMs(attempt, 1_000, 30_000);
      log.warn({ attempt, wait, status: err.status }, "reintentando GET");
      await sleep(wait, signal);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetchPortalHtml agotó reintentos");
}
