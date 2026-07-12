import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import {
  isMock,
  mockListMargenes,
  mockUpsertMargen,
  mockDeleteMargen,
} from "@/lib/mock-db";

// Márgenes de precio por proveedor + categoría (hoy: portal).
// GET    -> reglas vigentes + categorías existentes en el catálogo.
// PUT    -> crea/edita una regla { categoria|null, porcentaje } y recalcula
//           los precios ya publicados.
// DELETE -> borra una regla por categoría (el margen general no se borra).
// Solo administrador; escrituras con service role.

async function requireAdmin(): Promise<NextResponse | null> {
  if (isMock()) return null;
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (getRol(user) !== "administrador") {
    return NextResponse.json(
      { error: "Solo el administrador maneja los márgenes" },
      { status: 403 }
    );
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (isMock()) {
    return NextResponse.json({
      margenes: mockListMargenes(),
      categorias: ["VIP", "A+", "WC Cat 1 Short", "WC Cat 2"],
    });
  }

  const admin = createAdminSupabase();
  const [margenes, cats] = await Promise.all([
    admin
      .from("margenes")
      .select("id, source, categoria, porcentaje")
      .order("categoria", { ascending: true, nullsFirst: true }),
    admin
      .from("tickets")
      .select("categoria")
      .eq("source", "portal")
      .not("categoria", "is", null)
      .order("categoria"),
  ]);
  if (margenes.error) {
    return NextResponse.json({ error: margenes.error.message }, { status: 500 });
  }
  const categorias = Array.from(
    new Set((cats.data ?? []).map((c) => c.categoria as string))
  );
  return NextResponse.json({ margenes: margenes.data, categorias });
}

function parsePorcentaje(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 500) return null;
  return Math.round(n * 100) / 100;
}

export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const categoria = body.categoria ? String(body.categoria).trim().slice(0, 200) : null;
  const porcentaje = parsePorcentaje(body.porcentaje);
  if (porcentaje == null) {
    return NextResponse.json(
      { error: "Porcentaje inválido (0 a 500)" },
      { status: 400 }
    );
  }

  if (isMock()) {
    const margen = mockUpsertMargen(categoria, porcentaje);
    return NextResponse.json({ margen, recalculadas: 370 });
  }

  const admin = createAdminSupabase();
  // Upsert manual (la unicidad es por índice de expresión, onConflict no aplica).
  const buscar = admin.from("margenes").select("id").eq("source", "portal");
  const { data: existente } = await (categoria === null
    ? buscar.is("categoria", null)
    : buscar.eq("categoria", categoria)
  ).maybeSingle();

  const write = existente
    ? admin.from("margenes").update({ porcentaje }).eq("id", existente.id).select("*").single()
    : admin
        .from("margenes")
        .insert({ source: "portal", categoria, porcentaje })
        .select("*")
        .single();
  const { data: margen, error } = await write;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: recalculadas, error: rpcErr } = await admin.rpc("recalcular_precios_portal");
  if (rpcErr) {
    return NextResponse.json(
      { error: `Margen guardado pero falló el recálculo: ${rpcErr.message}` },
      { status: 500 }
    );
  }

  // La tienda es ISR: sin esto los precios viejos siguen hasta un minuto.
  revalidatePath("/");
  revalidatePath("/buscar");

  return NextResponse.json({ margen, recalculadas });
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const categoria = body.categoria ? String(body.categoria).trim() : null;
  if (categoria === null) {
    return NextResponse.json(
      { error: "El margen general no se borra: editá su porcentaje" },
      { status: 409 }
    );
  }

  if (isMock()) {
    if (!mockDeleteMargen(categoria)) {
      return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, recalculadas: 370 });
  }

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("margenes")
    .delete()
    .eq("source", "portal")
    .eq("categoria", categoria);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const { data: recalculadas, error: rpcErr } = await admin.rpc("recalcular_precios_portal");
  if (rpcErr) {
    return NextResponse.json(
      { error: `Regla borrada pero falló el recálculo: ${rpcErr.message}` },
      { status: 500 }
    );
  }
  revalidatePath("/");
  revalidatePath("/buscar");
  return NextResponse.json({ ok: true, recalculadas });
}
