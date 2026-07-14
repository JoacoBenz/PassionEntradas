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

// Márgenes de precio por proveedor + evento/competición (hoy: portal).
// GET    -> reglas vigentes + competiciones existentes en el catálogo.
// PUT    -> crea/edita una regla { competicion|null, porcentaje } y recalcula
//           los precios ya publicados.
// DELETE -> borra una regla por competición (el margen general no se borra).
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
      competiciones: [
        "World Cup 2026 Canada / Mexico / USA",
        "Spanish Primera Division",
        "English Premier League",
        "Euro 2028",
      ],
    });
  }

  const admin = createAdminSupabase();
  const [margenes, cats] = await Promise.all([
    admin
      .from("margenes")
      .select("id, source, competicion, porcentaje")
      .order("competicion", { ascending: true, nullsFirst: true }),
    // DISTINCT en la base: bajar una fila por ticket chocaba con el tope de
    // 1000 de PostgREST y "Elegir evento" mostraba la mitad de las
    // competiciones.
    admin.rpc("competiciones_catalogo", { p_solo_portal: true }),
  ]);
  if (margenes.error) {
    return NextResponse.json({ error: margenes.error.message }, { status: 500 });
  }
  const competiciones = (cats.data ?? []) as string[];
  return NextResponse.json({ margenes: margenes.data, competiciones });
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

  const competicion = body.competicion ? String(body.competicion).trim().slice(0, 200) : null;
  const porcentaje = parsePorcentaje(body.porcentaje);
  if (porcentaje == null) {
    return NextResponse.json(
      { error: "Porcentaje inválido (0 a 500)" },
      { status: 400 }
    );
  }

  if (isMock()) {
    const margen = mockUpsertMargen(competicion, porcentaje);
    revalidatePath("/(tienda)", "layout"); // flujo local completo
    return NextResponse.json({ margen, recalculadas: 370 });
  }

  const admin = createAdminSupabase();
  // Upsert manual (la unicidad es por índice de expresión, onConflict no aplica).
  const buscar = admin.from("margenes").select("id").eq("source", "portal");
  const { data: existente } = await (competicion === null
    ? buscar.is("competicion", null)
    : buscar.eq("competicion", competicion)
  ).maybeSingle();

  const write = existente
    ? admin.from("margenes").update({ porcentaje }).eq("id", existente.id).select("*").single()
    : admin
        .from("margenes")
        .insert({ source: "portal", competicion, porcentaje })
        .select("*")
        .single();
  const { data: margen, error } = await write;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Regla específica: repreciá solo esa competición. Margen general (null):
  // todo el catálogo vigente (el RPC ya excluye los eventos pasados).
  const { data: recalculadas, error: rpcErr } = await admin.rpc(
    "recalcular_precios_portal",
    { p_competicion: competicion }
  );
  if (rpcErr) {
    return NextResponse.json(
      { error: `Margen guardado pero falló el recálculo: ${rpcErr.message}` },
      { status: 500 }
    );
  }

  // La tienda es ISR: sin esto los precios viejos siguen hasta la revalidación
  // de fondo. "layout" porque revalidatePath("/") a secas no invalida la
  // página raíz (quirk de Next 14 con route groups).
  revalidatePath("/(tienda)", "layout");

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
  const competicion = body.competicion ? String(body.competicion).trim() : null;
  if (competicion === null) {
    return NextResponse.json(
      { error: "El margen general no se borra: editá su porcentaje" },
      { status: 409 }
    );
  }

  if (isMock()) {
    if (!mockDeleteMargen(competicion)) {
      return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 });
    }
    revalidatePath("/(tienda)", "layout"); // flujo local completo
    return NextResponse.json({ ok: true, recalculadas: 370 });
  }

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("margenes")
    .delete()
    .eq("source", "portal")
    .eq("competicion", competicion);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Al borrar una regla, solo esa competición vuelve al margen general.
  const { data: recalculadas, error: rpcErr } = await admin.rpc(
    "recalcular_precios_portal",
    { p_competicion: competicion }
  );
  if (rpcErr) {
    return NextResponse.json(
      { error: `Regla borrada pero falló el recálculo: ${rpcErr.message}` },
      { status: 500 }
    );
  }
  revalidatePath("/(tienda)", "layout");
  return NextResponse.json({ ok: true, recalculadas });
}
