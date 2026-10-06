import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { esStaff, getRol } from "@/lib/auth";
import { rankearClientes, type ClienteCuenta, type CompraDeCliente } from "@/lib/clientes";
import { isMock, mockEquipo, mockListOps, mockListSolicitudes } from "@/lib/mock-db";
import { leerEquipo } from "@/lib/equipo";

// GET /api/clientes — los clientes aprobados, ordenados por cuánto compraron.
// Alimenta el desplegable de comprador en "nueva operación": antes se escribía
// a mano y el mismo cliente quedaba cargado de tres formas distintas.
// Solo staff (es la lista de clientes del negocio).
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isMock()) {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !esStaff(getRol(user))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  let cuentas: ClienteCuenta[];
  let compras: CompraDeCliente[];

  if (isMock()) {
    cuentas = mockListSolicitudes()
      .filter((s) => s.estado === "aprobada" && s.user_id && !s.revocada_at)
      .filter((s) => !mockEquipo().has(s.user_id as string))
      .map((s) => ({ id: s.user_id as string, nombre: s.nombre, email: s.email }));
    compras = mockListOps().map((o) => ({
      cliente_id: o.cliente_id,
      cliente_email: o.cliente_email,
      monto: o.monto,
      moneda: o.moneda,
      status: o.status,
    }));
  } else {
    const admin = createAdminSupabase();
    // La fuente de los clientes son las solicitudes aprobadas: ahí está el
    // nombre con el que se dieron de alta. Las revocadas quedan afuera.
    const { data: sols } = await admin
      .from("solicitudes_acceso")
      .select("user_id, nombre, email")
      .eq("estado", "aprobada")
      .is("revocada_at", null)
      .not("user_id", "is", null)
      .limit(2000);
    // Los que hoy son del equipo no son compradores (antes eran clientes).
    const equipo = await leerEquipo(admin).catch(() => new Map());
    cuentas = ((sols ?? []) as any[])
      .filter((s) => !equipo.has(String(s.user_id)))
      .map((s) => ({
      id: String(s.user_id),
      nombre: String(s.nombre ?? s.email ?? "Cliente"),
      email: String(s.email ?? ""),
    }));

    const { data: ops } = await admin
      .from("operaciones")
      .select("cliente_id, cliente_email, monto, moneda, status")
      .limit(5000);
    compras = ((ops ?? []) as any[]).map((o) => ({
      cliente_id: o.cliente_id ?? null,
      cliente_email: o.cliente_email ?? null,
      monto: Number(o.monto ?? 0),
      moneda: String(o.moneda ?? "USD"),
      status: String(o.status ?? ""),
    }));
  }

  return NextResponse.json({ clientes: rankearClientes(cuentas, compras) });
}
