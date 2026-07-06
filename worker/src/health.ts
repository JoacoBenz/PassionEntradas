import http from "node:http";
import type { Logger } from "./logger.js";

/**
 * Servidor HTTP interno mínimo para el healthcheck de Docker.
 * GET /healthz -> 200 si hubo un sync exitoso reciente (o estamos en el
 * período de gracia de arranque); 503 si los datos están "stale".
 */
export interface HealthServer {
  markSuccess(): void;
  close(): Promise<void>;
}

export function startHealthServer(opts: {
  port: number;
  staleAfterMs: number;
  log: Logger;
}): HealthServer {
  const { port, staleAfterMs, log } = opts;
  const startedAt = Date.now();
  let lastSuccessAt: number | null = null;

  const isHealthy = (): boolean => {
    const now = Date.now();
    // Gracia de arranque: damos un margen igual a staleAfterMs antes de fallar.
    if (lastSuccessAt === null) return now - startedAt < staleAfterMs;
    return now - lastSuccessAt < staleAfterMs;
  };

  const server = http.createServer((req, res) => {
    if (req.url === "/healthz" || req.url === "/health") {
      const healthy = isHealthy();
      const body = JSON.stringify({
        status: healthy ? "ok" : "stale",
        lastSuccessAt: lastSuccessAt ? new Date(lastSuccessAt).toISOString() : null,
        uptimeMs: Date.now() - startedAt,
      });
      res.writeHead(healthy ? 200 : 503, { "content-type": "application/json" });
      res.end(body);
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  server.listen(port, () => log.info({ port }, "healthcheck escuchando en /healthz"));
  server.on("error", (err) => log.error({ err }, "error en health server"));

  return {
    markSuccess() {
      lastSuccessAt = Date.now();
    },
    close() {
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
