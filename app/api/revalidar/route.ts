import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "crypto";
import { isMock } from "@/lib/mock-db";

// POST /api/revalidar — refresca las páginas cacheadas de la tienda YA.
// Lo llama el WORKER al terminar cada sync publicado: él escribe directo en
// la base (la app no se entera) y sin esto los cambios tardaban hasta la
// revalidación de fondo (10 min) en verse.
//
// Auth por secreto compartido SIN config nueva: el worker manda su
// SUPABASE_SERVICE_ROLE_KEY en un header y acá se compara con la nuestra
// (ambos lados ya la tienen). Comparación en tiempo constante.

function tokenValido(request: Request): boolean {
  // Demo local sin claves: abierto (nunca corre así en prod).
  if (isMock()) return true;
  const esperado = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const recibido = request.headers.get("x-revalidar-token") ?? "";
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!tokenValido(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  revalidatePath("/(tienda)", "layout");
  return NextResponse.json({ ok: true });
}
