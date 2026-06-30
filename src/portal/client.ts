import { request } from "undici";
import type { Config } from "../config/index.js";
import type { Logger } from "../logger.js";
import { RetryableError, SessionExpiredError } from "../errors.js";
import { computeBackoffMs, sleep } from "../util/time.js";

/**
 * Cliente HTTP para el CAMINO A (endpoint JSON interno) reusando la cookie de
 * sesión. Es el camino más estable si el portal expone XHR/fetch.
 *
 * - 401/403 -> SessionExpiredError (el loop re-loguea).
 * - 429/5xx -> RetryableError, con backoff exponencial + jitter acotado acá.
 * - Nunca loguea la cookie.
 */
export async function fetchPortalJson(opts: {
  url: string;
  cookieHeader: string;
  cfg: Config;
  log: Logger;
  signal?: AbortSignal;
  maxRetries?: number;
}): Promise<unknown> {
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
          accept: "application/json, text/plain, */*",
          "x-requested-with": "XMLHttpRequest",
        },
        signal,
      });

      const { statusCode } = res;
      if (statusCode === 401 || statusCode === 403) {
        await res.body.dump();
        throw new SessionExpiredError(`HTTP ${statusCode} en ${url}`);
      }
      if (statusCode === 429 || statusCode >= 500) {
        await res.body.dump();
        throw new RetryableError(`HTTP ${statusCode} en ${url}`, statusCode);
      }
      if (statusCode >= 400) {
        const body = await res.body.text();
        throw new Error(`HTTP ${statusCode} en ${url}: ${body.slice(0, 200)}`);
      }
      return await res.body.json();
    } catch (err) {
      // SessionExpired no se reintenta acá: lo maneja el loop (re-login).
      if (err instanceof SessionExpiredError) throw err;
      lastErr = err;
      const retryable = err instanceof RetryableError;
      if (!retryable || attempt === maxRetries) throw err;
      const wait = computeBackoffMs(attempt, 1_000, 30_000);
      log.warn({ attempt, wait, status: (err as RetryableError).status }, "reintentando request");
      await sleep(wait, signal);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetchPortalJson agotó reintentos");
}
