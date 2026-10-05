import { NextResponse } from "next/server";
import { mapaPropioValido } from "@/lib/tickets";
import { refrescarTienda } from "@/lib/refrescar-tienda";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { ERROR_MONEDA, parseMoneda } from "@/lib/operaciones";
import { getRol } from "@/lib/auth";
import { isMock, mockDeleteManual, mockListManual, mockUpdateManual } from "@/lib/mock-db";
import { parsePrecio } from "@/lib/precios";

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
  const stock = Math.trunc(Number(t.stock));
  // Moneda de la entrada: pesos o dólares (el euro es solo de Passion).
  const moneda = parseMoneda(t.moneda);
  if (!moneda) return NextResponse.json({ error: ERROR_MONEDA }, { status: 400 });

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
  // Costo + comisión: se vende por la suma. Se acepta `precio` suelto por
  // compatibilidad con el formato viejo.
  let costo: number | null;
  let precio: number;
  if (t.costo != null || t.comision != null) {
    const p = parsePrecio(t.costo, t.comision);
    if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
    costo = p.costo;
    precio = p.total;
  } else {
    precio = Number(t.precio);
    if (!Number.isFinite(precio) || precio <= 0) {
      return NextResponse.json(
        { error: "El precio debe ser mayor a 0" },
        { status: 400 }
      );
    }
    costo = null;
  }
  // En edición se permite stock 0 (agotada pero visible "sin cupo"): puede
  // pasar por el descuento automático al cerrar operaciones.
  if (!Number.isFinite(stock) || stock < 0) {
    return NextResponse.json({ error: "Stock inválido" }, { status: 400 });
  }

  // Mapa del estadio: undefined = no se tocó; null/"" = se quitó; si viene,
  // tiene que ser uno subido por el panel. Es del EVENTO: se aplica a todos
  // sus sectores propios (si no, al editar un sector quedaban mapas distintos).
  const tocaMapa = t.imagen_url !== undefined;
  const imagen_url = t.imagen_url ? mapaPropioValido(t.imagen_url, isMock()) : null;
  if (tocaMapa && t.imagen_url && !imagen_url) {
    return NextResponse.json({ error: "El mapa tiene que subirse desde el panel" }, { status: 400 });
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
    // Solo se pisa el costo si vino en el body: una edición vieja sin el campo
    // no tiene que borrar lo que ya estaba cargado.
    ...(costo != null ? { precio_costo: costo } : {}),
    moneda_origen: moneda,
    moneda_final: moneda,
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

  // El mapa es del evento: se aplica a todos sus sectores propios.
  if (tocaMapa) {
    const r = row as { evento: string; competicion: string | null; fecha: string | null };
    if (isMock()) {
      for (const m of mockListManual()) {
        if (m.evento === r.evento && m.competicion === r.competicion && m.fecha === r.fecha) {
          mockUpdateManual(m.id, { imagen_url });
        }
      }
      row = { ...(row as object), imagen_url };
    } else {
      let q = createAdminSupabase()
        .from("tickets")
        .update({ imagen_url })
        .eq("source", "manual")
        .eq("evento", r.evento);
      q = r.competicion == null ? q.is("competicion", null) : q.eq("competicion", r.competicion);
      q = r.fecha == null ? q.is("fecha", null) : q.eq("fecha", r.fecha);
      const { error: errMapa } = await q;
      if (errMapa) {
        return NextResponse.json({ error: `Se guardó el sector pero no el mapa: ${errMapa.message}` }, { status: 500 });
      }
      row = { ...(row as object), imagen_url };
    }
  }

  refrescarTienda();
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
  refrescarTienda();

  return NextResponse.json({ ok: true });
}
