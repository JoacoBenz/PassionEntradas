import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { estadoDe, type Operacion, type StatusAction } from "@/lib/operaciones";
import { getRol } from "@/lib/auth";
import { isMock, mockApplyAction } from "@/lib/mock-db";

// PATCH /api/operaciones/[id]/status — aplica una acción sobre la operación.
// "entrada" y "pago" son hitos independientes que se marcan/desmarcan por
// separado; cancelar/reabrir manejan el enum. Solo admin; service role.
//
// Body: { action: "entrada"|"pago", done: boolean } | { action: "cancelar"|"reabrir" }

function parseAction(body: any): StatusAction | null {
  if (body?.action === "cancelar" || body?.action === "reabrir") {
    return { action: body.action };
  }
  if (
    (body?.action === "entrada" || body?.action === "pago" || body?.action === "cerrar") &&
    typeof body.done === "boolean"
  ) {
    return { action: body.action, done: body.done };
  }
  return null;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!isMock()) {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Los moderadores solo cargan operaciones; el estado lo maneja el admin.
    if (getRol(user) !== "administrador") {
      return NextResponse.json(
        { error: "Solo el administrador puede cambiar estados" },
        { status: 403 }
      );
    }
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const action = parseAction(body);
  if (!action) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  if (isMock()) {
    const res = mockApplyAction(params.id, action);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json(pickResult(res.op));
  }

  const admin = createAdminSupabase();

  const { data: current, error: readErr } = await admin
    .from("operaciones")
    .select("status, entrada_recibida_at, pago_confirmado_at, cerrada_at")
    .eq("id", params.id)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json(
      { error: "Operación no encontrada" },
      { status: 404 }
    );
  }

  const cancelada = current.status === "cancelada";
  let patch: Record<string, unknown>;

  switch (action.action) {
    case "entrada":
    case "pago": {
      if (cancelada) {
        return NextResponse.json(
          { error: "La operación está cancelada; reabrila para editar hitos" },
          { status: 409 }
        );
      }
      if (current.cerrada_at) {
        return NextResponse.json(
          { error: "La operación está cerrada; reabrí el cierre para editar hitos" },
          { status: 409 }
        );
      }
      // Secuencia del proceso: el pago se autoriza recién después de
      // verificar las entradas; y la entrada no se desmarca con un pago
      // confirmado encima (romperia el orden).
      if (action.action === "pago" && action.done && !current.entrada_recibida_at) {
        return NextResponse.json(
          { error: "Primero marcá la entrada recibida: el pago se autoriza después de verificar las entradas" },
          { status: 409 }
        );
      }
      if (action.action === "entrada" && !action.done && current.pago_confirmado_at) {
        return NextResponse.json(
          { error: "Hay un pago confirmado sobre esta entrada; desmarcá el pago primero" },
          { status: 409 }
        );
      }
      const col =
        action.action === "entrada" ? "entrada_recibida_at" : "pago_confirmado_at";
      patch = { [col]: action.done ? new Date().toISOString() : null };
      break;
    }
    case "cerrar": {
      if (cancelada) {
        return NextResponse.json(
          { error: "La operación está cancelada; no se puede cerrar" },
          { status: 409 }
        );
      }
      if (action.done && !(current.entrada_recibida_at && current.pago_confirmado_at)) {
        return NextResponse.json(
          { error: "Para cerrar hacen falta la entrada recibida y el pago confirmado" },
          { status: 409 }
        );
      }
      patch = { cerrada_at: action.done ? new Date().toISOString() : null };
      break;
    }
    case "cancelar": {
      if (cancelada) {
        return NextResponse.json(
          { error: "La operación ya está cancelada" },
          { status: 409 }
        );
      }
      patch = { status: "cancelada" };
      break;
    }
    case "reabrir": {
      if (!cancelada) {
        return NextResponse.json(
          { error: "Solo se puede reabrir una operación cancelada" },
          { status: 409 }
        );
      }
      patch = { status: "esperando_entrada" };
      break;
    }
  }

  const { data, error } = await admin
    .from("operaciones")
    .update(patch)
    .eq("id", params.id)
    .select("id, status, entrada_recibida_at, pago_confirmado_at, cerrada_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // V2: si esta operación nació de una solicitud del feed y se cancela,
  // los dos mundos se mueven juntos: la solicitud queda rechazada y la
  // publicación vuelve a estar activa. (Reabrir la operación no la
  // re-enlaza: para retomar hay una solicitud nueva.)
  if (action.action === "cancelar") {
    const { data: sol } = await admin
      .from("solicitudes")
      .select("id, publicacion_id")
      .eq("operacion_id", params.id)
      .eq("estado", "en_proceso")
      .maybeSingle();
    if (sol) {
      await admin.from("solicitudes").update({ estado: "rechazada" }).eq("id", sol.id);
      await admin
        .from("publicaciones")
        .update({ estado: "activa" })
        .eq("id", sol.publicacion_id)
        .eq("estado", "en_proceso");
    }
  }

  return NextResponse.json(pickResult(data as Operacion));
}

function pickResult(op: Pick<Operacion, "id" | "status" | "entrada_recibida_at" | "pago_confirmado_at" | "cerrada_at"> & { updated_at?: string }) {
  return {
    id: op.id,
    status: op.status,
    entrada_recibida_at: op.entrada_recibida_at,
    pago_confirmado_at: op.pago_confirmado_at,
    cerrada_at: op.cerrada_at,
    estado: estadoDe(op),
  };
}
