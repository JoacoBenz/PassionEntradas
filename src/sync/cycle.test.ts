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

function makeItems(n: number): RawTicketInput[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `evt-${i}::cat-1`,
    evento: `Evento ${i}`,
    precio_origen: 100,
    disponible: true,
  }));
}

function makeRepo() {
  return {
    getAvailableCount: vi.fn().mockResolvedValue(100),
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
  it("NO publica si el scrape vino vacío (no upsert, no markAbsent)", async () => {
    vi.mocked(scrapeRawTickets).mockResolvedValue([]);
    const repo = makeRepo();

    const summary = await runSyncCycle(deps(repo));

    expect(summary.status).toBe("aborted");
    expect(summary.reason).toBe("zero_items");
    expect(repo.upsertBatches).not.toHaveBeenCalled();
    expect(repo.markAbsentBefore).not.toHaveBeenCalled();
    expect(repo.recordSyncRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "aborted" }),
    );
  });

  it("NO publica ante caída sospechosa (>70% respecto del baseline)", async () => {
    vi.mocked(scrapeRawTickets).mockResolvedValue(makeItems(10)); // baseline 100, min 30
    const repo = makeRepo();

    const summary = await runSyncCycle(deps(repo));

    expect(summary.status).toBe("aborted");
    expect(summary.reason).toContain("suspicious_drop");
    expect(repo.upsertBatches).not.toHaveBeenCalled();
    expect(repo.markAbsentBefore).not.toHaveBeenCalled();
  });

  it("publica con markup aplicado cuando el sync es sano", async () => {
    vi.mocked(scrapeRawTickets).mockResolvedValue(makeItems(50));
    const repo = makeRepo();

    const summary = await runSyncCycle(deps(repo));

    expect(summary.status).toBe("ok");
    expect(summary.scrapedValid).toBe(50);
    expect(repo.upsertBatches).toHaveBeenCalledTimes(1);

    const rows = repo.upsertBatches.mock.calls[0]![0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(50);
    expect(rows[0]).toMatchObject({ precio_origen: 100, precio_final: 120, moneda_final: "EUR" });

    // markAbsentBefore se llama con el timestamp del inicio del ciclo (now()=1000).
    expect(repo.markAbsentBefore).toHaveBeenCalledWith(new Date(1000).toISOString());
  });

  it("descarta inválidos y los cuenta (precio negativo)", async () => {
    const items = [
      ...makeItems(40),
      { id: "bad::1", evento: "Malo", precio_origen: -5, disponible: true },
      { id: "bad::2", evento: "", precio_origen: 10, disponible: true },
    ] as RawTicketInput[];
    vi.mocked(scrapeRawTickets).mockResolvedValue(items);
    const repo = makeRepo();

    const summary = await runSyncCycle(deps(repo));

    expect(summary.scrapedRaw).toBe(42);
    expect(summary.scrapedValid).toBe(40);
    expect(summary.discarded).toBe(2);
  });
});
