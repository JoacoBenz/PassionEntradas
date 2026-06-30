/**
 * Probe usado por el HEALTHCHECK de Docker. Sale 0 si /healthz responde 200.
 * Se ejecuta como proceso aparte: `node dist/healthcheck.js`.
 */
const port = process.env.HEALTH_PORT ?? "8080";

fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(3000) })
  .then((r) => process.exit(r.ok ? 0 : 1))
  .catch(() => process.exit(1));
