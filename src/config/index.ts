import "dotenv/config";
import { z } from "zod";

/**
 * Parser tolerante para booleanos provenientes de env (strings).
 */
const envBool = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    return ["1", "true", "yes", "y", "on"].includes(v.trim().toLowerCase());
  }
  return false;
}, z.boolean());

/**
 * Trata "" como undefined para que los `.default()` y `.optional()` apliquen.
 */
const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional(),
);

const ConfigSchema = z
  .object({
    // Portal
    PE_USER: z.string().min(1, "PE_USER es obligatorio"),
    PE_PASS: z.string().min(1, "PE_PASS es obligatorio"),
    PE_BASE_URL: z.string().url().default("https://passioneventsonline.eu/"),
    PE_LOGIN_URL: optionalString.pipe(z.string().url().optional()),
    PE_SCRAPE_MODE: z.enum(["api", "playwright"]).default("playwright"),
    PE_API_ENDPOINT: optionalString.pipe(z.string().url().optional()),
    USER_AGENT: z
      .string()
      .min(1)
      .default(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      ),

    // Pricing
    PRICE_MARKUP: z.coerce.number().min(0).default(0.2),
    CONVERT_TO_ARS: envBool.default(false),
    EUR_ARS_RATE: z.coerce.number().positive().optional(),
    ARS_ROUND_TO: z.coerce.number().positive().default(100),

    // Scheduling / robustez
    SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(45_000),
    SYNC_DROP_ABORT_RATIO: z.coerce.number().min(0).max(1).default(0.7),
    UPSERT_BATCH_SIZE: z.coerce.number().int().positive().default(500),
    MAX_LOGIN_FAILURES: z.coerce.number().int().positive().default(5),
    BLOCKED_COOLDOWN_MS: z.coerce.number().int().positive().default(900_000),
    MAX_BACKOFF_MS: z.coerce.number().int().positive().default(300_000),

    // Supabase
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY es obligatorio"),
    SUPABASE_DB_URL: optionalString.pipe(z.string().optional()),

    // Runtime
    STATE_DIR: z.string().min(1).default("/data"),
    HEALTH_PORT: z.coerce.number().int().positive().default(8080),
    STALE_AFTER_MS: z.coerce.number().int().min(0).default(0),
    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
      .default("info"),
  })
  .refine((c) => !c.CONVERT_TO_ARS || (c.EUR_ARS_RATE != null && c.EUR_ARS_RATE > 0), {
    message: "EUR_ARS_RATE es obligatorio y debe ser > 0 cuando CONVERT_TO_ARS=true",
    path: ["EUR_ARS_RATE"],
  });

export type Config = z.infer<typeof ConfigSchema>;

let cached: Config | null = null;

/**
 * Carga y valida la configuración una sola vez. Lanza con mensaje claro si falta algo.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (cached) return cached;
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuración inválida:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Lapso tras el cual un sync se considera "stale" para el healthcheck. */
export function staleAfterMs(cfg: Config): number {
  return cfg.STALE_AFTER_MS > 0 ? cfg.STALE_AFTER_MS : cfg.SYNC_INTERVAL_MS * 4;
}

/**
 * Resumen de config SIN secretos, apto para loguear.
 * Nunca incluir PE_PASS, PE_USER, claves de Supabase ni connection strings.
 */
export function redactedConfigSummary(cfg: Config): Record<string, unknown> {
  return {
    PE_BASE_URL: cfg.PE_BASE_URL,
    PE_SCRAPE_MODE: cfg.PE_SCRAPE_MODE,
    PE_API_ENDPOINT: cfg.PE_API_ENDPOINT ? "(set)" : "(unset)",
    PRICE_MARKUP: cfg.PRICE_MARKUP,
    CONVERT_TO_ARS: cfg.CONVERT_TO_ARS,
    EUR_ARS_RATE: cfg.CONVERT_TO_ARS ? cfg.EUR_ARS_RATE : null,
    ARS_ROUND_TO: cfg.ARS_ROUND_TO,
    SYNC_INTERVAL_MS: cfg.SYNC_INTERVAL_MS,
    SYNC_DROP_ABORT_RATIO: cfg.SYNC_DROP_ABORT_RATIO,
    UPSERT_BATCH_SIZE: cfg.UPSERT_BATCH_SIZE,
    HEALTH_PORT: cfg.HEALTH_PORT,
    STATE_DIR: cfg.STATE_DIR,
    SUPABASE_URL: cfg.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: "(set, redacted)",
    LOG_LEVEL: cfg.LOG_LEVEL,
  };
}
