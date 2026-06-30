/**
 * DRY-RUN: loguea, recorre la lista + detalles, parsea y aplica markup, y
 * IMPRIME el resultado SIN tocar Supabase. Sirve para validar que el scraper
 * toma bien los datos antes de publicar nada.
 *
 *   PE_USER=... PE_PASS=... npm run dry-run
 *
 * No requiere Supabase: si no están las claves, se ponen dummies (no se usan).
 */
import "dotenv/config";

// La config exige claves de Supabase, pero el dry-run NO se conecta. Dummies.
process.env.SUPABASE_URL ||= "https://dry-run.local";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "dry-run";

import { writeFileSync } from "node:fs";
import { loadConfig, redactedConfigSummary } from "./config/index.js";
import { createLogger } from "./logger.js";
import { PortalSession } from "./portal/session.js";
import { scrapeRawTickets } from "./portal/scrape.js";
import { RawTicketSchema, type RawTicketParsed } from "./portal/types.js";
import { priceTicket } from "./pricing/index.js";

type DryRow = RawTicketParsed & { precio_final: number | null; moneda_final: string | null };

const pad = (v: unknown, n: number) => String(v ?? "-").padStart(n);
const padR = (v: unknown, n: number) => String(v ?? "").slice(0, n).padEnd(n);

async function main(): Promise<void> {
  const cfg = loadConfig();
  const log = createLogger(cfg);
  log.info(redactedConfigSummary(cfg), "DRY-RUN (NO escribe en Supabase)");

  const session = new PortalSession(cfg, log);
  try {
    await session.ensureSession();
    const { rows: raw, complete } = await scrapeRawTickets({ cfg, log, session });

    const opts = {
      markup: cfg.PRICE_MARKUP,
      convertToArs: cfg.CONVERT_TO_ARS,
      eurArsRate: cfg.EUR_ARS_RATE,
      arsRoundTo: cfg.ARS_ROUND_TO,
    };

    const valid: DryRow[] = [];
    let discarded = 0;
    for (const it of raw) {
      const parsed = RawTicketSchema.safeParse(it);
      if (!parsed.success) {
        discarded++;
        log.warn(
          { id: (it as { id?: string }).id, issues: parsed.error.issues.map((i) => i.message) },
          "descartado por validación",
        );
        continue;
      }
      const { precioFinal, monedaFinal } = priceTicket(parsed.data.precio_origen, opts);
      valid.push({ ...parsed.data, precio_final: precioFinal, moneda_final: monedaFinal });
    }

    const book = valid.filter((v) => v.estado === "book");
    const onReq = valid.filter((v) => v.estado === "on_request");

    console.log("\n================ DRY-RUN RESUMEN ================");
    console.log(`scrape completo : ${complete}`);
    console.log(`crudos          : ${raw.length}`);
    console.log(`válidos         : ${valid.length}  (descartados: ${discarded})`);
    console.log(`book (precio)   : ${book.length}`);
    console.log(`on_request      : ${onReq.length}`);

    console.log("\n---- BOOK: id | precio_origen -> precio_final | stock | sector | evento ----");
    for (const v of book) {
      console.log(
        `${padR(v.id, 13)} ${pad(v.precio_origen, 9)} -> ${pad(v.precio_final, 10)} ${pad(v.stock, 4)}  ${padR(v.categoria, 30)} ${padR(v.evento, 42)}`,
      );
    }

    console.log("\n---- ON_REQUEST: id | fecha | evento (muestra de 25) ----");
    for (const v of onReq.slice(0, 25)) {
      console.log(`${padR(v.id, 13)} ${padR(v.fecha, 26)} ${padR(v.evento, 50)}`);
    }
    if (onReq.length > 25) console.log(`... y ${onReq.length - 25} más`);

    writeFileSync("dry-run-output.json", JSON.stringify(valid, null, 2));
    console.log(`\n✓ Detalle completo (${valid.length} filas) en dry-run-output.json`);
    console.log("  (revisá que precios, stock, fechas y sectores estén OK antes de publicar)");
  } finally {
    await session.close();
  }
}

main().catch((err) => {
  console.error("DRY-RUN falló:", err instanceof Error ? err.message : err);
  process.exit(1);
});
