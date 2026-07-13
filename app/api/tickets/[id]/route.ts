import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import { isMock, mockDeleteManual, mockUpdateManual } from "@/lib/mock-db";

// PATCH  /api/tickets/[id] — edita una entrada MANUAL (precio, stock, etc.)
//        sin borrar y recrear (el id, y por lo tanto el link, no cambian).
// DELETE /api/tickets/[id] — borra una entrada MANUAL del catálogo.
// Las del portal las gestiona el worker; no se tocan desde acá.

async function requireAdmin(): Promise<NextResponse | null> {
  if (isMock()) return null;
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || getRol(user) !== "administrador") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return null;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Misma validación que el alta: la entrada editada también queda completa.
  const t = body.ticket ?? body ?? {};
  const evento = String(t.evento ?? "").trim();
  const competicion = String(t.competicion ?? "").trim();
  const ciudad = String(t.ciudad ?? "").trim();
  const categoria = String(t.categoria ?? "").trim();
  const fecha = String(t.fecha ?? "").trim();
  const precio = Number(t.precio);
  const stock = Math.trunc(Number(t.stock));

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
  // En edición se permite stock 0 (agotada pero visible "sin cupo"): puede
  // pasar por el descuento automático al cerrar operaciones.
  if (!Number.isFinite(stock) || stock < 0) {
    return NextResponse.json({ error: "Stock inválido" }, { status: 400 });
  }

  const id = decodeURIComponent(params.id);
  const patch = {
    evento,
    competicion,
    ciudad,
    categoria,
    fecha,
    precio_origen: precio,
    precio_final: precio,
    stock,
    disponible: stock > 0,
  };

  let row: unknown;
  if (isMock()) {
    const res = mockUpdateManual(id, patch);
    if (!res) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }
    row = res;
  } else {
    const admin = createAdminSupabase();
    const { data, error } = await admin
      .from("tickets")
      .update(patch)
      .eq("id", id)
      .eq("source", "manual")
      .select("*")
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }
    row = data;
  }

  revalidatePath("/(tienda)", "layout");
  return NextResponse.json({ ok: true, row });
}
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!isMock()) {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || getRol(user) !== "administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const id = decodeURIComponent(params.id);

  if (isMock()) {
    if (!mockDeleteManual(id)) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }
  } else {
    const admin = createAdminSupabase();
    const { error } = await admin
      .from("tickets")
      .delete()
      .eq("id", id)
      .eq("source", "manual");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  // La tienda pública es ISR: sin esto, la entrada borrada sigue apareciendo
  // hasta la revalidación de fondo. También en mock (flujo local completo).
  revalidatePath("/(tienda)", "layout");

  return NextResponse.json({ ok: true });
}
