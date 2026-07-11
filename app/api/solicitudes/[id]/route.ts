import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import { generateCode } from "@/lib/operaciones";
import { isMock, mockAccionSolicitud } from "@/lib/mock-db";

// PATCH /api/solicitudes/[id] — acciones del administrador sobre una solicitud:
// - iniciar:   crea la operación de custodia (comprador/vendedor/monto salen
//              de la publicación) y deja solicitud y publicación "en proceso".
// - rechazar:  descarta la solicitud; si tenía operación en curso, la
//              publicación vuelve a estar activa.
// - concretar: la operación terminó; solicitud concretada y publicación vendida.
//
// Acá está el corazón de la V2: los usuarios se encuentran en el feed, pero
// la compraventa SIEMPRE pasa por una operación mediada por el administrador.

type Accion = "iniciar" | "rechazar" | "concretar";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const accion = body.accion as Accion;
  if (!["iniciar", "rechazar", "concretar"].includes(accion)) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  if (isMock()) {
    const res = mockAccionSolicitud(params.id, accion);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({
      solicitud: res.sol,
      operacion: res.operacion ? { id: res.operacion.id, code: res.operacion.code } : null,
    });
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (getRol(user) !== "administrador") {
    return NextResponse.json(
      { error: "Solo el administrador media las compras" },
      { status: 403 }
    );
  }

  const admin = createAdminSupabase();
  const { data: sol, error: readErr } = await admin
    .from("solicitudes")
    .select("*, publicacion:publicaciones(*)")
    .eq("id", params.id)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }
  if (!sol || !sol.publicacion) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }
  const pub = sol.publicacion;

  if (accion === "iniciar") {
    if (sol.estado !== "pendiente") {
      return NextResponse.json({ error: "La solicitud ya fue procesada" }, { status: 409 });
    }

    // Crea la operación de custodia con los datos de la publicación.
    let operacion: { id: string; code: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await admin
        .from("operaciones")
        .insert({
          code: generateCode(),
          evento: pub.evento,
          comprador_alias: sol.comprador_alias,
          vendedor_alias: pub.vendedor_alias,
          monto: pub.precio,
          fee: 0,
          fecha_evento: pub.fecha_evento,
          notas: `V2: solicitud de ${sol.comprador_alias} sobre publicación de ${pub.vendedor_alias}`,
          created_by: user.id,
        })
        .select("id, code")
        .single();
      if (!error && data) {
        operacion = data;
        break;
      }
      if (error && (error as any).code !== "23505") {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    if (!operacion) {
      return NextResponse.json(
        { error: "No se pudo generar un code único, reintentá" },
        { status: 500 }
      );
    }

    const [solUpd, pubUpd] = await Promise.all([
      admin
        .from("solicitudes")
        .update({ estado: "en_proceso", operacion_id: operacion.id })
        .eq("id", sol.id)
        .select("*")
        .single(),
      admin.from("publicaciones").update({ estado: "en_proceso" }).eq("id", pub.id),
    ]);
    if (solUpd.error || pubUpd.error) {
      const msg = solUpd.error?.message ?? pubUpd.error?.message ?? "Error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    return NextResponse.json({ solicitud: solUpd.data, operacion });
  }

  if (accion === "rechazar") {
    if (sol.estado === "concretada") {
      return NextResponse.json({ error: "La solicitud ya se concretó" }, { status: 409 });
    }
    const { data, error } = await admin
      .from("solicitudes")
      .update({ estado: "rechazada" })
      .eq("id", sol.id)
      .select("*")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Si había una operación en curso, la publicación vuelve al feed.
    if (sol.estado === "en_proceso" && pub.estado === "en_proceso") {
      await admin.from("publicaciones").update({ estado: "activa" }).eq("id", pub.id);
    }
    return NextResponse.json({ solicitud: data, operacion: null });
  }

  // concretar
  if (sol.estado !== "en_proceso") {
    return NextResponse.json(
      { error: "Solo se concreta una solicitud con operación en curso" },
      { status: 409 }
    );
  }
  const [solUpd, pubUpd] = await Promise.all([
    admin
      .from("solicitudes")
      .update({ estado: "concretada" })
      .eq("id", sol.id)
      .select("*")
      .single(),
    admin.from("publicaciones").update({ estado: "vendida" }).eq("id", pub.id),
  ]);
  if (solUpd.error || pubUpd.error) {
    const msg = solUpd.error?.message ?? pubUpd.error?.message ?? "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ solicitud: solUpd.data, operacion: null });
}
