import { describe, expect, it, vi, beforeEach } from "vitest";

// Mockeamos la extracción para testear el ciclo sin tocar el portal.
vi.mock("../portal/scrape.js", () => ({ scrapeRawTickets: vi.fn() }));

import { scrapeRawTickets } from "../portal/scrape.js";
import { runSyncCycle } from "./cycle.js";
import { createLogger } from "../logger.js";
import type { Config } from "../config/index.js";
import type { TicketRepository } from "../db/repository.js";
import type { RawTicketInput } from "../portal/types.js";

const log = createLogger({ LOG_LEVEL: "silent" });

const cfg = {
  PRICE_MARKUP: 0.2,
  CONVERT_TO_ARS: false,
  EUR_ARS_RATE: undefined,
  ARS_ROUND_TO: 100,
  SYNC_DROP_ABORT_RATIO: 0.7,
  UPSERT_BATCH_SIZE: 500,
} as unknown as Config;

function makeBookItems(n: number): RawTicketInput[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${9000 + i}::494`,
    evento: `Evento ${i}`,
    precio_origen: 100,
    disponible: true,
    estado: "book" as const,
  }));
}

const result = (rows: RawTicketInput[], complete = true) => ({ rows, complete });

function makeRepo() {
  return {
    getLastSuccessfulScrapedCount: vi.fn().mockResolvedValue(100),
    upsertBatches: vi.fn().mockResolvedValue(0),
    markAbsentBefore: vi.fn().mockResolvedValue(0),
    recordSyncRun: vi.fn().mockResolvedValue(undefined),
  };
}

const deps = (repo: ReturnType<typeof makeRepo>) => ({
  cfg,
  log,
  session: {} as never,
  repo: repo as unknown as TicketRepository,
  now: () => 1000,
});

beforeEach(() => vi.clearAllMocks());

describe("runSyncCycle — anti-borrado", () => {
  it("NO publica si el scrape vino vacío", async () => {
    vi.mocked(scrapeRawTickets).mockResolvedValue(result([]));
    const repo = makeRepo();
    const summary = await runSyncCycle(deps(repo));
    expect(summary.status).toBe("aborted");
    expect(summary.reason).toBe("zero_items");
    expect(repo.upsertBatches).not.toHaveBeenCalled();
    expect(repo.markAbsentBefore).not.toHaveBeenCalled();
  });

  it("NO publica ante caída sospechosa (>70% del baseline)", async () => {
    vi.mocked(scrapeRawTickets).mockResolvedValue(result(makeBookItems(10))); // baseline 100, min 30
    const repo = makeRepo();
    const summary = await runSyncCycle(deps(repo));
    expect(summary.status).toBe("aborted");
    expect(summary.reason).toContain("suspicious_drop");
    expect(repo.upsertBatches).not.toHaveBeenCalled();
  });

  it("publica con markup aplicado cuando el sync es sano y completo", async () => {
    vi.mocked(scrapeRawTickets).mockResolvedValue(result(makeBookItems(50)));
    const repo = makeRepo();
    const summary = await runSyncCycle(deps(repo));
    expect(summary.status).toBe("ok");
    expect(repo.upsertBatches).toHaveBeenCalledTimes(1);
    const rows = repo.upsertBatches.mock.calls[0]![0] as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({ precio_origen: 100, precio_final: 120, moneda_final: "EUR" });
    // completo -> marca ausentes con el timestamp de inicio (now()=1000)
    expect(repo.markAbsentBefore).toHaveBeenCalledWith(new Date(1000).toISOString());
  });

  it("scrape INCOMPLETO: upsert sí, markAbsent NO (evita falsos agotados)", async () => {
    vi.mocked(scrapeRawTickets).mockResolvedValue(result(makeBookItems(50), false));
    const repo = makeRepo();
    const summary = await runSyncCycle(deps(repo));
    expect(summary.status).toBe("ok");
    expect(summary.reason).toBe("ok_incomplete");
    expect(repo.upsertBatches).toHaveBeenCalledTimes(1);
    expect(repo.markAbsentBefore).not.toHaveBeenCalled();
  });

  it("on_request: precio_final null, y se cuenta como válido", async () => {
    const rows: RawTicketInput[] = [
      ...makeBookItems(40),
      { id: "9100::REQ", evento: "OnReq", precio_origen: null, disponible: false, estado: "on_request" },
    ];
    vi.mocked(scrapeRawTickets).mockResolvedValue(result(rows));
    const repo = makeRepo();
    const summary = await runSyncCycle(deps(repo));
    expect(summary.scrapedValid).toBe(41);
    const sent = repo.upsertBatches.mock.calls[0]![0] as Array<Record<string, unknown>>;
    const onReq = sent.find((r) => r.id === "9100::REQ")!;
    expect(onReq).toMatchObject({ precio_origen: null, precio_final: null, moneda_final: null, estado: "on_request" });
  });

  it("descarta inválidos y los cuenta (precio negativo / evento vacío)", async () => {
    const rows = [
      ...makeBookItems(40),
      { id: "bad::1", evento: "Malo", precio_origen: -5, disponible: true, estado: "book" },
      { id: "bad::2", evento: "", precio_origen: 10, disponible: true, estado: "book" },
    ] as RawTicketInput[];
    vi.mocked(scrapeRawTickets).mockResolvedValue(result(rows));
    const repo = makeRepo();
    const summary = await runSyncCycle(deps(repo));
    expect(summary.scrapedRaw).toBe(42);
    expect(summary.scrapedValid).toBe(40);
    expect(summary.discarded).toBe(2);
  });
});
