// "Base de datos" en memoria para desarrollo sin Supabase (MOCK_DATA=1).
// Vive en globalThis para sobrevivir al hot-reload del dev server; se
// resetea al reiniciar el proceso. NO usar en producción.

import { generateCode, type Operacion, type OperacionPublica, type StatusAction } from "@/lib/operaciones";
import type { SyncRun, TicketFull } from "@/lib/tickets";
import type { Factura, FacturaDatos } from "@/lib/factura";
import { generarPassword, type SolicitudAcceso, type SolicitudInput } from "@/lib/acceso";
import { MOCK_TICKETS } from "@/lib/mock-tickets";

export type MockFactura = Factura & { operacion_id: string };

export const isMock = () => process.env.MOCK_DATA === "1";

export const MOCK_USER = {
  email: "demo@passion.local",
  rol: "administrador" as const,
};

export type MockMargen = {
  id: string;
  source: string;
  competicion: string | null;
  porcentaje: number;
};

type MockDB = {
  ops: Operacion[];
  manual: TicketFull[];
  syncRuns: SyncRun[];
  margenes: MockMargen[];
  eurUsd: number;
  portalActivo: boolean;
  facturas: MockFactura[];
  facturaNumero: number;
  solicitudes: SolicitudAcceso[];
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
      cantidad: 1,
      fee: 60000,
      status: "entrada_recibida",
      entrada_recibida_at: iso(90),
      pago_confirmado_at: null,
      cerrada_at: null,
      entrada_recibida_por: MOCK_USER.email,
      pago_confirmado_por: null,
      cerrada_por: null,
      fecha_evento: "2026-07-18",
      notas: "Vendedor manda el QR el jueves.",
      cuenta_debitar: "admintickets.mp",
      ticket_id: "3001::1",
      tipo: "operacion",
      cliente_id: null,
      cliente_email: null,
      sector: null,
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
      cantidad: 2,
      fee: 25000,
      status: "esperando_entrada",
      entrada_recibida_at: null,
      pago_confirmado_at: null,
      cerrada_at: null,
      entrada_recibida_por: null,
      pago_confirmado_por: null,
      cerrada_por: null,
      fecha_evento: "2026-07-09",
      notas: null,
      cuenta_debitar: null,
      ticket_id: "manual::demo-1",
      // Pedido de un cliente desde la tienda (para la vista "Mis pedidos").
      tipo: "pedido",
      cliente_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      cliente_email: "demo@passion.local",
      sector: "Platea Media",
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
      cantidad: 1,
      fee: 40000,
      status: "confirmada",
      entrada_recibida_at: iso(60 * 24 * 3),
      pago_confirmado_at: iso(60 * 24 * 2),
      cerrada_at: null,
      entrada_recibida_por: MOCK_USER.email,
      pago_confirmado_por: MOCK_USER.email,
      cerrada_por: null,
      fecha_evento: null,
      notas: null,
      cuenta_debitar: null,
      ticket_id: null,
      tipo: "operacion",
      cliente_id: null,
      cliente_email: null,
      sector: null,
      created_at: iso(60 * 24 * 4),
      updated_at: iso(60 * 24 * 2),
    },
  ];

  const manual: TicketFull[] = MOCK_TICKETS.filter((t) => t.source === "manual").map((t) => ({
    ...t,
    precio_origen: t.precio_final,
    moneda_origen: "USD",
    moneda_final: t.precio_final != null ? "USD" : null,
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

  const margenes: MockMargen[] = [
    { id: "m-default", source: "portal", competicion: null, porcentaje: 20 },
    { id: "m-mundial", source: "portal", competicion: "World Cup 2026 Canada / Mexico / USA", porcentaje: 35 },
  ];

  const solicitudes: SolicitudAcceso[] = [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      nombre: "Lucía Fernández",
      email: "lucia.fernandez@example.com",
      telefono: "+54 9 11 5555 1234",
      direccion: "Av. Corrientes 1234, CABA",
      mensaje: "Busco entradas para la final del Mundial 2026.",
      estado: "pendiente",
      user_id: null,
      decidida_por: null,
      decidida_at: null,
      revocada_at: null,
      revocada_por: null,
      created_at: iso(40),
      updated_at: iso(40),
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      nombre: "Diego Sosa",
      email: "diego.sosa@example.com",
      telefono: "+54 9 351 444 7788",
      direccion: "Bv. San Juan 500, Córdoba",
      mensaje: null,
      estado: "aprobada",
      user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      decidida_por: MOCK_USER.email,
      decidida_at: iso(60 * 20),
      revocada_at: null,
      revocada_por: null,
      created_at: iso(60 * 22),
      updated_at: iso(60 * 20),
    },
  ];

  return {
    ops,
    manual,
    syncRuns,
    margenes,
    eurUsd: 1.08,
    portalActivo: true,
    facturas: [],
    facturaNumero: 0,
    solicitudes,
  };
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
  tipo?: Operacion["tipo"];
  cliente_id?: string | null;
  cliente_email?: string | null;
  sector?: string | null;
  cantidad?: number;
}): Operacion {
  const now = new Date().toISOString();
  const op: Operacion = {
    id: crypto.randomUUID(),
    code: generateCode(),
    ...input,
    cantidad: input.cantidad ?? 1,
    tipo: input.tipo ?? "operacion",
    cliente_id: input.cliente_id ?? null,
    cliente_email: input.cliente_email ?? null,
    sector: input.sector ?? null,
    status: "esperando_entrada",
    entrada_recibida_at: null,
    pago_confirmado_at: null,
    cerrada_at: null,
    entrada_recibida_por: null,
    pago_confirmado_por: null,
    cerrada_por: null,
    created_at: now,
    updated_at: now,
  };
  db().ops.unshift(op);
  return op;
}

// "Mis pedidos" del cliente: pedidos/consultas que originó (por cliente_id, o
// por email cuando no hay id de usuario en mock). Más nuevos primero.
export function mockListPedidosCliente(clienteId: string | null, email: string | null): Operacion[] {
  return db()
    .ops.filter(
      (o) =>
        (o.tipo === "pedido" || o.tipo === "consulta") &&
        ((clienteId && o.cliente_id === clienteId) ||
          (email && o.cliente_email?.toLowerCase() === email.toLowerCase()))
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
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
      const colPor = action.action === "entrada" ? "entrada_recibida_por" : "pago_confirmado_por";
      op[col] = action.done ? new Date().toISOString() : null;
      op[colPor] = action.done ? MOCK_USER.email : null;
      break;
    }
    case "cerrar":
      if (cancelada) return { ok: false, status: 409, error: "La operación está cancelada; no se puede cerrar" };
      if (action.done && !(op.entrada_recibida_at && op.pago_confirmado_at)) {
        return { ok: false, status: 409, error: "Para cerrar hacen falta la entrada recibida y el pago confirmado" };
      }
      op.cerrada_at = action.done ? new Date().toISOString() : null;
      op.cerrada_por = action.done ? MOCK_USER.email : null;
      // Entrada propia vinculada: cerrar descuenta 1 del stock de la tienda;
      // reabrir el cierre lo repone (misma lógica que la API real).
      if (op.ticket_id?.startsWith("manual::")) {
        mockAjustarStockManual(op.ticket_id, action.done ? -1 : 1);
      }
      break;
    case "cancelar":
      if (cancelada) return { ok: false, status: 409, error: "La operación ya está cancelada" };
      if (op.cerrada_at) {
        return { ok: false, status: 409, error: "La operación está cerrada; reabrí el cierre antes de cancelar" };
      }
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

export function mockUpdateManual(
  id: string,
  patch: Partial<TicketFull>
): TicketFull | null {
  const t = db().manual.find((x) => x.id === id);
  if (!t) return null;
  Object.assign(t, patch, { updated_at: new Date().toISOString() });
  return t;
}

// Descuento/reposición de stock de una entrada propia (operación vinculada
// cerrada/reabierta). Clampa en 0.
export function mockAjustarStockManual(ticketId: string, delta: number): void {
  const t = db().manual.find((x) => x.id === ticketId);
  if (!t) return;
  t.stock = Math.max(0, (t.stock ?? 0) + delta);
  t.disponible = (t.stock ?? 0) > 0;
  t.updated_at = new Date().toISOString();
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

// ---- margenes ---------------------------------------------------------------------
export function mockListMargenes(): MockMargen[] {
  return [...db().margenes].sort((a, b) =>
    (a.competicion ?? "").localeCompare(b.competicion ?? "")
  );
}

export function mockUpsertMargen(competicion: string | null, porcentaje: number): MockMargen {
  const d = db();
  const existente = d.margenes.find((m) => m.competicion === competicion);
  if (existente) {
    existente.porcentaje = porcentaje;
    return existente;
  }
  const nuevo: MockMargen = { id: crypto.randomUUID(), source: "portal", competicion, porcentaje };
  d.margenes.push(nuevo);
  return nuevo;
}

export function mockDeleteMargen(competicion: string): boolean {
  const d = db();
  const antes = d.margenes.length;
  d.margenes = d.margenes.filter((m) => m.competicion !== competicion);
  return d.margenes.length < antes;
}

// ---- facturas -----------------------------------------------------------------------
export function mockFacturaDeOperacion(opId: string): MockFactura | null {
  return db().facturas.find((f) => f.operacion_id === opId) ?? null;
}

export function mockFacturaPorId(id: string): MockFactura | null {
  return db().facturas.find((f) => f.id === id) ?? null;
}

export function mockGuardarFactura(opId: string, datos: FacturaDatos): MockFactura {
  const d = db();
  const existente = d.facturas.find((f) => f.operacion_id === opId);
  if (existente) {
    // Re-emitir: nuevo snapshot, mismo numero/id/fecha (como el upsert real).
    existente.datos = datos;
    return existente;
  }
  const nueva: MockFactura = {
    id: crypto.randomUUID(),
    numero: ++d.facturaNumero,
    operacion_id: opId,
    datos,
    created_at: new Date().toISOString(),
  };
  d.facturas.push(nueva);
  return nueva;
}

// ---- cotización EUR->USD ------------------------------------------------------------
export function mockGetEurUsd(): number {
  return db().eurUsd;
}

export function mockSetEurUsd(v: number): number {
  db().eurUsd = v;
  return v;
}

// ---- interruptor de entradas de Passion ---------------------------------------------
export function mockGetPortalActivo(): boolean {
  return db().portalActivo;
}

export function mockSetPortalActivo(v: boolean): boolean {
  db().portalActivo = v;
  return v;
}

// ---- solicitudes de acceso (landing) ------------------------------------------------
// Crea una solicitud. Una PENDIENTE por email (idempotente: si ya hay una
// pendiente devuelve ok sin duplicar, igual que el unique index real).
export function mockCrearSolicitud(input: SolicitudInput): { ok: true } | { ok: false; error: string } {
  const d = db();
  const yaPendiente = d.solicitudes.some(
    (s) => s.estado === "pendiente" && s.email.toLowerCase() === input.email.toLowerCase()
  );
  if (yaPendiente) return { ok: true };
  const now = new Date().toISOString();
  d.solicitudes.unshift({
    id: crypto.randomUUID(),
    nombre: input.nombre,
    email: input.email,
    telefono: input.telefono,
    direccion: input.direccion,
    mensaje: input.mensaje,
    estado: "pendiente",
    user_id: null,
    decidida_por: null,
    decidida_at: null,
    revocada_at: null,
    revocada_por: null,
    created_at: now,
    updated_at: now,
  });
  return { ok: true };
}

// Lista para el panel: pendientes primero, luego por fecha (más nuevas arriba).
export function mockListSolicitudes(): SolicitudAcceso[] {
  return [...db().solicitudes].sort((a, b) => {
    if (a.estado !== b.estado) {
      if (a.estado === "pendiente") return -1;
      if (b.estado === "pendiente") return 1;
    }
    return b.created_at.localeCompare(a.created_at);
  });
}

// Aprueba/rechaza una solicitud pendiente. Al aprobar "crea" un usuario
// (user_id ficticio) y devuelve las credenciales para mostrarlas una vez.
export function mockDecidirSolicitud(
  id: string,
  accion: "aprobar" | "rechazar",
  decididaPor: string
):
  | { ok: true; solicitud: SolicitudAcceso; credenciales?: { email: string; password: string } }
  | { ok: false; status: number; error: string } {
  const s = db().solicitudes.find((x) => x.id === id);
  if (!s) return { ok: false, status: 404, error: "Solicitud no encontrada" };
  if (s.estado !== "pendiente") {
    return { ok: false, status: 409, error: "La solicitud ya fue resuelta" };
  }
  const now = new Date().toISOString();
  s.decidida_por = decididaPor;
  s.decidida_at = now;
  s.updated_at = now;
  if (accion === "rechazar") {
    s.estado = "rechazada";
    return { ok: true, solicitud: s };
  }
  const password = generarPassword();
  s.estado = "aprobada";
  s.user_id = crypto.randomUUID();
  return { ok: true, solicitud: s, credenciales: { email: s.email, password } };
}

// Reenvía el acceso de una solicitud YA aprobada: regenera la contraseña
// (la anterior no se guarda) y devuelve las credenciales nuevas.
export function mockReenviarSolicitud(
  id: string
):
  | { ok: true; solicitud: SolicitudAcceso; credenciales: { email: string; password: string } }
  | { ok: false; status: number; error: string } {
  const s = db().solicitudes.find((x) => x.id === id);
  if (!s) return { ok: false, status: 404, error: "Solicitud no encontrada" };
  if (s.estado !== "aprobada") {
    return { ok: false, status: 409, error: "Solo se reenvía el acceso de una solicitud aprobada" };
  }
  const password = generarPassword();
  return { ok: true, solicitud: s, credenciales: { email: s.email, password } };
}

// Revoca/reactiva el acceso de una solicitud aprobada.
export function mockRevocarSolicitud(
  id: string,
  accion: "revocar" | "reactivar",
  quien: string
): { ok: true; solicitud: SolicitudAcceso } | { ok: false; status: number; error: string } {
  const s = db().solicitudes.find((x) => x.id === id);
  if (!s) return { ok: false, status: 404, error: "Solicitud no encontrada" };
  if (s.estado !== "aprobada") {
    return { ok: false, status: 409, error: "Solo se revoca el acceso de una solicitud aprobada" };
  }
  if (accion === "revocar") {
    if (s.revocada_at) return { ok: false, status: 409, error: "El acceso ya está revocado" };
    s.revocada_at = new Date().toISOString();
    s.revocada_por = quien;
  } else {
    if (!s.revocada_at) return { ok: false, status: 409, error: "El acceso no está revocado" };
    s.revocada_at = null;
    s.revocada_por = null;
  }
  s.updated_at = new Date().toISOString();
  return { ok: true, solicitud: s };
}
