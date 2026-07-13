import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import { isMock, mockCreateManual } from "@/lib/mock-db";

// POST /api/tickets — publica una entrada manual en el catálogo.
// Reemplaza a la Edge Function admin-tickets del repo viejo: ahora exige
// un administrador logueado (Supabase Auth) en lugar del token compartido.
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
  const categoria = String(t.categoria ?? "").trim();
  const fecha = String(t.fecha ?? "").trim();
  const precio = Number(t.precio);
  const stock = Math.trunc(Number(t.stock));

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
  if (!categoria) {
    return NextResponse.json({ error: "El sector es obligatorio" }, { status: 400 });
  }
  if (!Number.isFinite(precio) || precio <= 0) {
    return NextResponse.json(
      { error: "El precio debe ser mayor a 0" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(stock) || stock < 1) {
    return NextResponse.json(
      { error: "El stock debe ser al menos 1" },
      { status: 400 }
    );
  }

  const row = {
    id: `manual::${randomUUID()}`,
    evento,
    competicion,
    fecha,
    ciudad,
    categoria,
    // Las entradas propias se cargan directamente en USD (a diferencia del
    // portal Passion, que cotiza en EUR y el worker convierte).
    precio_origen: precio,
    moneda_origen: "USD",
    precio_final: precio,
    moneda_final: "USD",
    stock,
    disponible: true,
    estado: "book",
    url_origen: null,
    source: "manual",
    scraped_at: new Date().toISOString(),
  };

  let full: unknown;
  if (isMock()) {
    full = mockCreateManual({ ...row, updated_at: row.scraped_at } as any);
  } else {
    const admin = createAdminSupabase();
    const { data, error } = await admin.from("tickets").insert(row).select("*").single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    full = data;
  }

  // La tienda pública es ISR: sin esto, la entrada nueva tarda hasta la
  // revalidación de fondo en aparecer. También en mock, para poder probar
  // el flujo completo en local.
  revalidatePath("/(tienda)", "layout");

  return NextResponse.json({ ok: true, row: full }, { status: 201 });
}
