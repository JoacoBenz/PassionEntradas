/** Utilidades de tiempo/backoff. */

/**
 * Sleep cancelable. Resuelve al cumplirse `ms` o inmediatamente si `signal`
 * se aborta (para shutdown limpio ante SIGTERM).
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const t = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      cleanup();
      resolve();
    };
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Backoff exponencial con jitter completo.
 * attempt empieza en 1.
 */
export function computeBackoffMs(
  attempt: number,
  baseMs: number,
  maxMs: number,
): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  // Full jitter: aleatorio en [0, exp].
  return Math.floor(Math.random() * exp);
}
