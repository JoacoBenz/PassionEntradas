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
  const precio = t.precio == null || t.precio === "" ? null : Number(t.precio);
  const stock = t.stock == null || t.stock === "" ? 0 : Math.trunc(Number(t.stock));

  if (!t.evento || String(t.evento).trim() === "") {
    return NextResponse.json({ error: "El evento es obligatorio" }, { status: 400 });
  }
  if (precio != null && (!Number.isFinite(precio) || precio < 0)) {
    return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
  }
  if (!Number.isFinite(stock) || stock < 0) {
    return NextResponse.json({ error: "Stock inválido" }, { status: 400 });
  }

  const hayStock = stock > 0 && precio != null;
  const row = {
    id: `manual::${randomUUID()}`,
    evento: String(t.evento).trim(),
    competicion: t.competicion?.trim() || null,
    fecha: t.fecha || null,
    ciudad: t.ciudad?.trim() || null,
    categoria: t.categoria?.trim() || null,
    precio_origen: precio,
    moneda_origen: "EUR",
    precio_final: precio,
    moneda_final: precio != null ? "EUR" : null,
    stock,
    disponible: hayStock,
    estado: hayStock ? "book" : "on_request",
    url_origen: null,
    source: "manual",
    scraped_at: new Date().toISOString(),
  };

  if (isMock()) {
    const full = mockCreateManual({ ...row, updated_at: row.scraped_at } as any);
    return NextResponse.json({ ok: true, row: full }, { status: 201 });
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin.from("tickets").insert(row).select("*").single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // La tienda pública es ISR (revalidate 60): sin esto, la entrada nueva
  // tarda hasta un minuto en aparecer en la home y la búsqueda.
  revalidatePath("/(tienda)", "layout");

  return NextResponse.json({ ok: true, row: data }, { status: 201 });
}
