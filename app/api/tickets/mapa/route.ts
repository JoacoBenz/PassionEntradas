import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import { isMock } from "@/lib/mock-db";

// POST /api/tickets/mapa — sube el mapa del estadio de una entrada PROPIA al
// bucket público `mapas` (el mismo donde el worker deja los de Passion) y
// devuelve su URL. Solo administrador. La tienda ya sabe mostrarlo: zoom al
// pasar el mouse en PC y abrir con zoom en el celular.
//
// Se valida el contenido, no el nombre ni el tipo que dice el navegador: se
// leen los primeros bytes del archivo.

const MAX_BYTES = 5 * 1024 * 1024;

function tipoReal(b: Uint8Array): { mime: string; ext: string } | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

export async function POST(request: Request) {
  if (!isMock()) {
    const {
      data: { user },
    } = await createServerSupabase().auth.getUser();
    if (!user || getRol(user) !== "administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  let archivo: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get("archivo");
    archivo = f instanceof File ? f : null;
  } catch {
    return NextResponse.json({ error: "Formulario inválido" }, { status: 400 });
  }
  if (!archivo || archivo.size === 0) {
    return NextResponse.json({ error: "Elegí una imagen" }, { status: 400 });
  }
  if (archivo.size > MAX_BYTES) {
    return NextResponse.json({ error: "La imagen pesa más de 5 MB" }, { status: 400 });
  }

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const tipo = tipoReal(bytes);
  if (!tipo) {
    return NextResponse.json({ error: "Tiene que ser una imagen PNG, JPG o WEBP" }, { status: 400 });
  }

  // Demo: sin Supabase, la imagen viaja como data URL.
  if (isMock()) {
    const url = `data:${tipo.mime};base64,${Buffer.from(bytes).toString("base64")}`;
    return NextResponse.json({ url }, { status: 201 });
  }

  const path = `propias/${randomUUID()}.${tipo.ext}`;
  const admin = createAdminSupabase();
  const { error } = await admin.storage
    .from("mapas")
    .upload(path, Buffer.from(bytes), { contentType: tipo.mime, upsert: false });
  if (error) {
    return NextResponse.json({ error: `No se pudo subir la imagen: ${error.message}` }, { status: 500 });
  }
  const { data } = admin.storage.from("mapas").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl }, { status: 201 });
}
