// "Base de datos" en memoria para desarrollo sin Supabase (MOCK_DATA=1).
// Vive en globalThis para sobrevivir al hot-reload del dev server; se
// resetea al reiniciar el proceso. NO usar en producción.

import { generateCode, type Operacion, type OperacionPublica, type StatusAction } from "@/lib/operaciones";
import type { SyncRun, TicketFull } from "@/lib/tickets";
import { MOCK_TICKETS } from "@/lib/mock-tickets";

export const isMock = () => process.env.MOCK_DATA === "1";

export const MOCK_USER = {
  email: "demo@passion.local",
  rol: "administrador" as const,
};

type MockDB = {
  ops: Operacion[];
  manual: TicketFull[];
  syncRuns: SyncRun[];
};

function iso(minsAgo: number) {
  return new Date(Date.now() - minsAgo * 60_000).toISOString();
}

function seed(): MockDB {
  const ops: Operacion[] = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      code: "BX-DEMO1234",
      evento: "Real Madrid vs Manchester City",
      comprador_alias: "compra_marce",
      vendedor_alias: "vende_lucho",
      monto: 850000,
      fee: 60000,
      status: "entrada_recibida",
      entrada_recibida_at: iso(90),
      pago_confirmado_at: null,
      cerrada_at: null,
      fecha_evento: "2026-07-18",
      notas: "Vendedor manda el QR el jueves.",
      cuenta_debitar: "admintickets.mp",
      ticket_id: "3001::1",
      created_at: iso(60 * 26),
      updated_at: iso(90),
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      code: "BX-DEMO5678",
      evento: "River vs Boca - Superclásico",
      comprador_alias: "juanma_ok",
      vendedor_alias: null,
      monto: 300000,
      fee: 25000,
      status: "esperando_entrada",
      entrada_recibida_at: null,
      pago_confirmado_at: null,
      cerrada_at: null,
      fecha_evento: "2026-07-09",
      notas: null,
      cuenta_debitar: null,
      ticket_id: "manual::demo-1",
      created_at: iso(60 * 3),
      updated_at: iso(60 * 3),
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      code: "BX-DEMO9ABC",
      evento: "Formula 1 - Gran Premio de Monza",
      comprador_alias: "f1fan",
      vendedor_alias: "scuderia_ar",
      monto: 500000,
      fee: 40000,
      status: "confirmada",
      entrada_recibida_at: iso(60 * 24 * 3),
      pago_confirmado_at: iso(60 * 24 * 2),
      cerrada_at: null,
      fecha_evento: null,
      notas: null,
      cuenta_debitar: null,
      ticket_id: null,
      created_at: iso(60 * 24 * 4),
      updated_at: iso(60 * 24 * 2),
    },
  ];

  const manual: TicketFull[] = MOCK_TICKETS.filter((t) => t.source === "manual").map((t) => ({
    ...t,
    precio_origen: t.precio_final,
    moneda_origen: "EUR",
    moneda_final: t.precio_final != null ? "EUR" : null,
    disponible: (t.stock ?? 0) > 0,
    url_origen: null,
    scraped_at: iso(60),
    updated_at: iso(60),
  }));

  const syncRuns: SyncRun[] = [
    { id: 5, status: "ok", reason: null, scraped_valid: 132, upserted: 12, marked_unavailable: 1, complete: true, duration_ms: 48000, created_at: iso(7) },
    { id: 4, status: "ok", reason: null, scraped_valid: 131, upserted: 3, marked_unavailable: 0, complete: true, duration_ms: 45120, created_at: iso(22) },
    { id: 3, status: "aborted", reason: "caída de items > 70%", scraped_valid: 12, upserted: 0, marked_unavailable: 0, complete: false, duration_ms: 9800, created_at: iso(37) },
    { id: 2, status: "ok", reason: null, scraped_valid: 130, upserted: 8, marked_unavailable: 2, complete: true, duration_ms: 51000, created_at: iso(52) },
    { id: 1, status: "ok", reason: null, scraped_valid: 129, upserted: 129, marked_unavailable: 0, complete: true, duration_ms: 62000, created_at: iso(67) },
  ];

  return { ops, manual, syncRuns };
}

function db(): MockDB {
  const g = globalThis as typeof globalThis & { __passionMockDb?: MockDB };
  if (!g.__passionMockDb) g.__passionMockDb = seed();
  return g.__passionMockDb;
}

// ---- operaciones ---------------------------------------------------------------
export function mockListOps(limit?: number): Operacion[] {
  const out = [...db().ops].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return limit ? out.slice(0, limit) : out;
}

export function mockOpPublica(id: string): OperacionPublica | null {
  const op = db().ops.find((o) => o.id === id);
  if (!op) return null;
  const { code, evento, comprador_alias, vendedor_alias, monto, status, entrada_recibida_at, pago_confirmado_at, cerrada_at, fecha_evento, updated_at } = op;
  return { code, evento, comprador_alias, vendedor_alias, monto, status, entrada_recibida_at, pago_confirmado_at, cerrada_at, fecha_evento, updated_at };
}

export function mockCreateOp(input: {
  evento: string;
  comprador_alias: string | null;
  vendedor_alias: string | null;
  monto: number;
  fee: number;
  ticket_id: string | null;
  fecha_evento: string | null;
  notas: string | null;
  cuenta_debitar: string | null;
}): Operacion {
  const now = new Date().toISOString();
  const op: Operacion = {
    id: crypto.randomUUID(),
    code: generateCode(),
    ...input,
    status: "esperando_entrada",
    entrada_recibida_at: null,
    pago_confirmado_at: null,
    cerrada_at: null,
    created_at: now,
    updated_at: now,
  };
  db().ops.unshift(op);
  return op;
}

export function mockApplyAction(
  id: string,
  action: StatusAction
): { ok: true; op: Operacion } | { ok: false; status: number; error: string } {
  const op = db().ops.find((o) => o.id === id);
  if (!op) return { ok: false, status: 404, error: "Operación no encontrada" };
  const cancelada = op.status === "cancelada";

  switch (action.action) {
    case "entrada":
    case "pago": {
      if (cancelada) {
        return { ok: false, status: 409, error: "La operación está cancelada; reabrila para editar hitos" };
      }
      if (op.cerrada_at) {
        return { ok: false, status: 409, error: "La operación está cerrada; reabrí el cierre para editar hitos" };
      }
      const col = action.action === "entrada" ? "entrada_recibida_at" : "pago_confirmado_at";
      op[col] = action.done ? new Date().toISOString() : null;
      break;
    }
    case "cerrar":
      if (cancelada) return { ok: false, status: 409, error: "La operación está cancelada; no se puede cerrar" };
      if (action.done && !(op.entrada_recibida_at && op.pago_confirmado_at)) {
        return { ok: false, status: 409, error: "Para cerrar hacen falta la entrada recibida y el pago confirmado" };
      }
      op.cerrada_at = action.done ? new Date().toISOString() : null;
      break;
    case "cancelar":
      if (cancelada) return { ok: false, status: 409, error: "La operación ya está cancelada" };
      op.status = "cancelada";
      break;
    case "reabrir":
      if (!cancelada) return { ok: false, status: 409, error: "Solo se puede reabrir una operación cancelada" };
      op.status = "esperando_entrada";
      break;
  }
  op.updated_at = new Date().toISOString();
  return { ok: true, op };
}

export function mockUpdateOp(
  id: string,
  patch: Partial<Pick<Operacion, "notas" | "fecha_evento">>
): { ok: true; op: Operacion } | { ok: false; status: number; error: string } {
  const op = db().ops.find((o) => o.id === id);
  if (!op) return { ok: false, status: 404, error: "Operación no encontrada" };
  if ("notas" in patch) op.notas = patch.notas ?? null;
  if ("fecha_evento" in patch) op.fecha_evento = patch.fecha_evento ?? null;
  op.updated_at = new Date().toISOString();
  return { ok: true, op };
}

// ---- tickets manuales ------------------------------------------------------------
export function mockListManual(): TicketFull[] {
  return [...db().manual];
}

export function mockCreateManual(row: TicketFull): TicketFull {
  db().manual.unshift(row);
  return row;
}

export function mockDeleteManual(id: string): boolean {
  const d = db();
  const before = d.manual.length;
  d.manual = d.manual.filter((t) => t.id !== id);
  return d.manual.length < before;
}

// ---- worker ----------------------------------------------------------------------
export function mockSyncRuns(): SyncRun[] {
  return [...db().syncRuns];
}

export function mockPortalCount(): number {
  return MOCK_TICKETS.filter((t) => t.source === "portal").length;
}
