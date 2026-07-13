import type { Config } from "../config/index.js";
import type { Logger } from "../logger.js";

/**
 * Avisa a la tienda que hay datos nuevos: POST /api/revalidar, que refresca
 * las páginas cacheadas al instante (sin esto, lo que el worker escribe en
 * la base tarda hasta 10 min — la revalidación de fondo — en verse).
 *
 * Auth por secreto compartido sin config extra: la service role key, que
 * ambos lados ya tienen. Enteramente fail-soft: si la tienda no responde,
 * el sync ya publicó igual y el refresco de fondo la cubre.
 */
export async function avisarTienda(deps: { cfg: Config; log: Logger }): Promise<boolean> {
  const { cfg, log } = deps;
  const url = `${cfg.TIENDA_URL.replace(/\/$/, "")}/api/revalidar`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-revalidar-token": cfg.SUPABASE_SERVICE_ROLE_KEY },
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      log.info("tienda revalidada: los cambios del sync ya están visibles");
      return true;
    }
    log.warn({ status: res.status, url }, "la tienda rechazó la revalidación (no crítico)");
    return false;
  } catch (err) {
    log.warn({ err, url }, "no se pudo avisar a la tienda (no crítico)");
    return false;
  }
}
