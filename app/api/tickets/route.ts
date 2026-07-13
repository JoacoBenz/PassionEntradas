import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import { isMock, mockCreateManual } from "@/lib/mock-db";

// POST /api/tickets — publica una entrada manual en el catálogo.
// Un evento puede traer VARIOS sectores (cada uno con su precio y stock):
// se crea una fila por sector, igual que las entradas del portal. El body
// acepta { ticket: { evento, competicion, ciudad, fecha, sectores: [...] } }
// o el formato viejo con categoria/precio/stock planos (un solo sector).

const MAX_SECTORES = 20;

type SectorInput = { categoria: string; precio: number; stock: number };

function parseSectores(t: any): SectorInput[] | { error: string } {
  // Formato nuevo (lista) o viejo (campos planos = un sector).
  const crudos: any[] = Array.isArray(t.sectores)
    ? t.sectores
    : [{ categoria: t.categoria, precio: t.precio, stock: t.stock }];

  if (crudos.length === 0) {
    return { error: "Cargá al menos un sector" };
  }
  if (crudos.length > MAX_SECTORES) {
    return { error: `Máximo ${MAX_SECTORES} sectores por evento` };
  }

  const sectores: SectorInput[] = [];
  const vistos = new Set<string>();
  for (let i = 0; i < crudos.length; i++) {
    const n = crudos.length > 1 ? ` (sector ${i + 1})` : "";
    const categoria = String(crudos[i]?.categoria ?? "").trim();
    const precio = Number(crudos[i]?.precio);
    const stock = Math.trunc(Number(crudos[i]?.stock));
    if (!categoria) {
      return { error: `El sector es obligatorio${n}` };
    }
    if (!Number.isFinite(precio) || precio <= 0) {
      return { error: `El precio debe ser mayor a 0${n}` };
    }
    if (!Number.isFinite(stock) || stock < 1) {
      return { error: `El stock debe ser al menos 1${n}` };
    }
    const clave = categoria.toLowerCase();
    if (vistos.has(clave)) {
      return { error: `El sector "${categoria}" está repetido` };
    }
    vistos.add(clave);
    sectores.push({ categoria, precio, stock });
  }
  return sectores;
}

export async function POST(request: Request) {
  if (!isMock()) {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || getRol(user) !== "administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const t = body.ticket ?? body ?? {};
  const evento = String(t.evento ?? "").trim();
  const competicion = String(t.competicion ?? "").trim();
  const ciudad = String(t.ciudad ?? "").trim();
  const fecha = String(t.fecha ?? "").trim();

  // Una entrada propia se publica completa o no se publica: todos los campos
  // son obligatorios (mismo criterio que las operaciones — acá también se
  // habían colado cargas a medias). Validado en el form Y acá.
  if (!evento) {
    return NextResponse.json({ error: "El evento es obligatorio" }, { status: 400 });
  }
  if (!competicion) {
    return NextResponse.json(
      { error: "La categoría / competición es obligatoria" },
      { status: 400 }
    );
  }
  if (!ciudad) {
    return NextResponse.json(
      { error: "El lugar (ciudad o país) es obligatorio" },
      { status: 400 }
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json(
      { error: "La fecha del evento es obligatoria" },
      { status: 400 }
    );
  }

  const sectores = parseSectores(t);
  if ("error" in sectores) {
    return NextResponse.json({ error: sectores.error }, { status: 400 });
  }

  const scrapedAt = new Date().toISOString();
  const rows = sectores.map((s) => ({
    id: `manual::${randomUUID()}`,
    evento,
    competicion,
    fecha,
    ciudad,
    categoria: s.categoria,
    // Las entradas propias se cargan directamente en USD (a diferencia del
    // portal Passion, que cotiza en EUR y el worker convierte).
    precio_origen: s.precio,
    moneda_origen: "USD",
    precio_final: s.precio,
    moneda_final: "USD",
    stock: s.stock,
    disponible: true,
    estado: "book",
    url_origen: null,
    source: "manual",
    scraped_at: scrapedAt,
  }));

  let creadas: unknown[];
  if (isMock()) {
    creadas = rows.map((r) => mockCreateManual({ ...r, updated_at: r.scraped_at } as any));
  } else {
    const admin = createAdminSupabase();
    const { data, error } = await admin.from("tickets").insert(rows).select("*");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    creadas = data ?? [];
  }

  // La tienda pública es ISR: sin esto, la entrada nueva tarda hasta la
  // revalidación de fondo en aparecer. También en mock, para poder probar
  // el flujo completo en local.
  revalidatePath("/(tienda)", "layout");

  // `row` se mantiene por compatibilidad con el formato de un solo sector.
  return NextResponse.json({ ok: true, rows: creadas, row: creadas[0] }, { status: 201 });
}
