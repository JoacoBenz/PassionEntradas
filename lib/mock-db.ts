// "Base de datos" en memoria para desarrollo sin Supabase (MOCK_DATA=1).
// Vive en globalThis para sobrevivir al hot-reload del dev server; se
// resetea al reiniciar el proceso. NO usar en producción.

import { generateCode, type Operacion, type OperacionPublica, type StatusAction } from "@/lib/operaciones";
import type { SyncRun, TicketFull } from "@/lib/tickets";
import type { Publicacion, Solicitud, SolicitudConPublicacion } from "@/lib/comunidad";
import { MOCK_TICKETS } from "@/lib/mock-tickets";

export const isMock = () => process.env.MOCK_DATA === "1";

export const MOCK_USER = {
  email: "demo@passion.local",
  rol: "administrador" as const,
};

// Identidad del "usuario común" en mock: navega el feed, publica y solicita.
export const MOCK_FEED_USER = {
  id: "99999999-9999-4999-8999-999999999999",
  alias: "demo_user",
};

type MockDB = {
  ops: Operacion[];
  manual: TicketFull[];
  syncRuns: SyncRun[];
  pubs: Publicacion[];
  solicitudes: Solicitud[];
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

  const pubs: Publicacion[] = [
    {
      id: "aaaa1111-1111-4111-8111-aaaaaaaa1111",
      user_id: "88888888-8888-4888-8888-888888888888",
      vendedor_alias: "lu.entradas",
      evento: "Coldplay en River — Campo",
      descripcion: "Dos entradas juntas, transfiero por la app oficial.",
      fecha_evento: "2026-08-15",
      precio: 420000,
      cantidad: 2,
      estado: "activa",
      created_at: iso(60 * 5),
      updated_at: iso(60 * 5),
    },
    {
      id: "aaaa2222-2222-4222-8222-aaaaaaaa2222",
      user_id: MOCK_FEED_USER.id,
      vendedor_alias: MOCK_FEED_USER.alias,
      evento: "Lollapalooza 2027 — Abono 3 días",
      descripcion: null,
      fecha_evento: "2027-03-19",
      precio: 690000,
      cantidad: 1,
      estado: "activa",
      created_at: iso(60 * 2),
      updated_at: iso(60 * 2),
    },
    {
      id: "aaaa3333-3333-4333-8333-aaaaaaaa3333",
      user_id: "77777777-7777-4777-8777-777777777777",
      vendedor_alias: "tano_92",
      evento: "River vs Boca — Superclásico",
      descripcion: "Sivori media. Solo venta por custodia.",
      fecha_evento: "2026-07-20",
      precio: 310000,
      cantidad: 1,
      estado: "en_proceso",
      created_at: iso(60 * 26),
      updated_at: iso(60),
    },
  ];

  const solicitudes: Solicitud[] = [
    {
      id: "bbbb1111-1111-4111-8111-bbbbbbbb1111",
      publicacion_id: "aaaa3333-3333-4333-8333-aaaaaaaa3333",
      comprador_id: MOCK_FEED_USER.id,
      comprador_alias: MOCK_FEED_USER.alias,
      mensaje: "La quiero, puedo pagar hoy mismo.",
      estado: "en_proceso",
      operacion_id: "11111111-1111-4111-8111-111111111111",
      created_at: iso(60 * 3),
      updated_at: iso(60),
    },
    {
      id: "bbbb2222-2222-4222-8222-bbbbbbbb2222",
      publicacion_id: "aaaa1111-1111-4111-8111-aaaaaaaa1111",
      comprador_id: "66666666-6666-4666-8666-666666666666",
      comprador_alias: "caro.mdq",
      mensaje: null,
      estado: "pendiente",
      operacion_id: null,
      created_at: iso(45),
      updated_at: iso(45),
    },
  ];

  return { ops, manual, syncRuns, pubs, solicitudes };
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
      if (action.action === "pago" && action.done && !op.entrada_recibida_at) {
        return { ok: false, status: 409, error: "Primero marcá la entrada recibida: el pago se autoriza después de verificar las entradas" };
      }
      if (action.action === "entrada" && !action.done && op.pago_confirmado_at) {
        return { ok: false, status: 409, error: "Hay un pago confirmado sobre esta entrada; desmarcá el pago primero" };
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
    case "cancelar": {
      if (cancelada) return { ok: false, status: 409, error: "La operación ya está cancelada" };
      op.status = "cancelada";
      // V2: solicitud enlazada rechazada y publicación de vuelta al feed.
      const sol = db().solicitudes.find(
        (s) => s.operacion_id === op.id && s.estado === "en_proceso"
      );
      if (sol) {
        sol.estado = "rechazada";
        sol.updated_at = new Date().toISOString();
        const pub = db().pubs.find((p) => p.id === sol.publicacion_id);
        if (pub && pub.estado === "en_proceso") {
          pub.estado = "activa";
          pub.updated_at = sol.updated_at;
        }
      }
      break;
    }
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

// ---- comunidad (V2) ---------------------------------------------------------------
type Err = { ok: false; status: number; error: string };

export function mockListPublicaciones(): Publicacion[] {
  return [...db().pubs].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function mockMisSolicitudes(userId: string): Solicitud[] {
  return db().solicitudes.filter((s) => s.comprador_id === userId);
}

export function mockCreatePublicacion(input: {
  user_id: string;
  vendedor_alias: string;
  evento: string;
  descripcion: string | null;
  fecha_evento: string | null;
  precio: number;
  cantidad: number;
}): Publicacion {
  const now = new Date().toISOString();
  const pub: Publicacion = {
    id: crypto.randomUUID(),
    ...input,
    estado: "activa",
    created_at: now,
    updated_at: now,
  };
  db().pubs.unshift(pub);
  return pub;
}

export function mockPatchPublicacion(
  id: string,
  userId: string,
  esAdmin: boolean,
  estado: Publicacion["estado"]
): { ok: true; pub: Publicacion } | Err {
  const pub = db().pubs.find((p) => p.id === id);
  if (!pub) return { ok: false, status: 404, error: "Publicación no encontrada" };
  if (!esAdmin && pub.user_id !== userId) {
    return { ok: false, status: 403, error: "Solo el dueño puede modificar su publicación" };
  }
  if (!esAdmin && pub.estado === "en_proceso") {
    return { ok: false, status: 409, error: "Hay una operación en curso sobre esta publicación; hablá con el administrador" };
  }
  pub.estado = estado;
  pub.updated_at = new Date().toISOString();
  return { ok: true, pub };
}

export function mockCreateSolicitud(input: {
  publicacion_id: string;
  comprador_id: string;
  comprador_alias: string;
  mensaje: string | null;
}): { ok: true; sol: Solicitud } | Err {
  const pub = db().pubs.find((p) => p.id === input.publicacion_id);
  if (!pub) return { ok: false, status: 404, error: "Publicación no encontrada" };
  if (pub.estado !== "activa") {
    return { ok: false, status: 409, error: "La publicación ya no está disponible" };
  }
  if (pub.user_id === input.comprador_id) {
    return { ok: false, status: 409, error: "No podés solicitar tu propia publicación" };
  }
  const dupe = db().solicitudes.find(
    (s) =>
      s.publicacion_id === input.publicacion_id &&
      s.comprador_id === input.comprador_id &&
      (s.estado === "pendiente" || s.estado === "en_proceso")
  );
  if (dupe) return { ok: false, status: 409, error: "Ya enviaste una solicitud para esta publicación" };
  const now = new Date().toISOString();
  const sol: Solicitud = {
    id: crypto.randomUUID(),
    ...input,
    estado: "pendiente",
    operacion_id: null,
    created_at: now,
    updated_at: now,
  };
  db().solicitudes.unshift(sol);
  return { ok: true, sol };
}

export function mockListSolicitudes(): SolicitudConPublicacion[] {
  const d = db();
  return d.solicitudes
    .map((s): SolicitudConPublicacion | null => {
      const pub = d.pubs.find((p) => p.id === s.publicacion_id);
      if (!pub) return null;
      const op = s.operacion_id ? d.ops.find((o) => o.id === s.operacion_id) : null;
      const operacion = op
        ? {
            id: op.id,
            status: op.status,
            entrada_recibida_at: op.entrada_recibida_at,
            pago_confirmado_at: op.pago_confirmado_at,
            cerrada_at: op.cerrada_at,
          }
        : null;
      return { ...s, publicacion: pub, operacion };
    })
    .filter((s): s is SolicitudConPublicacion => s !== null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// Acciones del admin sobre una solicitud. "iniciar" crea la operación de
// custodia y deja todo enlazado, igual que la ruta real.
export function mockAccionSolicitud(
  id: string,
  accion: "iniciar" | "rechazar" | "concretar"
): { ok: true; sol: Solicitud; operacion?: Operacion } | Err {
  const d = db();
  const sol = d.solicitudes.find((s) => s.id === id);
  if (!sol) return { ok: false, status: 404, error: "Solicitud no encontrada" };
  const pub = d.pubs.find((p) => p.id === sol.publicacion_id);
  if (!pub) return { ok: false, status: 404, error: "Publicación no encontrada" };

  if (accion === "iniciar") {
    if (sol.estado !== "pendiente") {
      return { ok: false, status: 409, error: "La solicitud ya fue procesada" };
    }
    if (pub.estado !== "activa") {
      return { ok: false, status: 409, error: "La publicación no está activa (ya hay una custodia en curso, se vendió o fue retirada)" };
    }
    const op = mockCreateOp({
      evento: pub.evento,
      comprador_alias: sol.comprador_alias,
      vendedor_alias: pub.vendedor_alias,
      monto: pub.precio,
      fee: 0,
      ticket_id: null,
      fecha_evento: pub.fecha_evento,
      notas: `V2: solicitud de ${sol.comprador_alias} sobre publicación de ${pub.vendedor_alias}`,
      cuenta_debitar: null,
    });
    sol.estado = "en_proceso";
    sol.operacion_id = op.id;
    pub.estado = "en_proceso";
    pub.updated_at = new Date().toISOString();
    sol.updated_at = pub.updated_at;
    return { ok: true, sol, operacion: op };
  }

  if (accion === "rechazar") {
    if (sol.estado === "concretada") {
      return { ok: false, status: 409, error: "La solicitud ya se concretó" };
    }
    const eraEnProceso = sol.estado === "en_proceso";
    if (eraEnProceso && sol.operacion_id) {
      const op = d.ops.find((o) => o.id === sol.operacion_id);
      if (op?.cerrada_at) {
        return { ok: false, status: 409, error: "La operación de custodia ya se cerró: concretá la venta en lugar de rechazar" };
      }
      if (op && op.status !== "cancelada") {
        op.status = "cancelada";
        op.updated_at = new Date().toISOString();
      }
    }
    sol.estado = "rechazada";
    sol.updated_at = new Date().toISOString();
    if (eraEnProceso && pub.estado === "en_proceso") {
      pub.estado = "activa";
      pub.updated_at = sol.updated_at;
    }
    return { ok: true, sol };
  }

  // concretar
  if (sol.estado !== "en_proceso") {
    return { ok: false, status: 409, error: "Solo se concreta una solicitud con operación en curso" };
  }
  sol.estado = "concretada";
  pub.estado = "vendida";
  sol.updated_at = new Date().toISOString();
  pub.updated_at = sol.updated_at;
  // Las hermanas pendientes ya no tienen sentido sobre una pub vendida.
  for (const otra of d.solicitudes) {
    if (otra.publicacion_id === pub.id && otra.estado === "pendiente") {
      otra.estado = "rechazada";
      otra.updated_at = sol.updated_at;
    }
  }
  return { ok: true, sol };
}
