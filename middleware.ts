import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { esStaff, getRol } from "@/lib/auth";

// Refresca la sesión de Supabase Auth y protege los módulos:
// - /admin: solo rol administrador (los moderadores van a /moderador),
//   salvo /admin/cuenta (cambio de contraseña propio): todo el staff.
// - /moderador: cualquier usuario del staff (rol asignado).
// - Sesión SIN rol asignado: no es del equipo, no entra a ningún módulo.
// La página pública /op/[id] queda fuera del matcher (acceso anónimo).
export async function middleware(request: NextRequest) {
  // Modo demo sin Supabase: todo el mundo es admin, el login se saltea.
  if (process.env.MOCK_DATA === "1") {
    const p = request.nextUrl.pathname;
    if (p === "/admin/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
    // En demo no hay Auth real: registro/login van directo al feed.
    if (p === "/ingresar" || p === "/registro") {
      const url = request.nextUrl.clone();
      url.pathname = "/feed";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLogin =
    path === "/admin/login" || path === "/ingresar" || path === "/registro";
  const needsAuth =
    path.startsWith("/admin") ||
    path.startsWith("/moderador") ||
    path.startsWith("/feed");

  function redirectTo(pathname: string) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    return NextResponse.redirect(url);
  }

  // Sin sesión en una ruta protegida (que no sea un login) -> al login que toca.
  if (!user && needsAuth && !isLogin) {
    return redirectTo(path.startsWith("/feed") ? "/ingresar" : "/admin/login");
  }

  if (user) {
    const rol = getRol(user);
    const home =
      rol === "administrador" ? "/admin" : rol === "moderador" ? "/moderador" : "/feed";

    // Ya logueado y entrando a un login o al registro -> a su módulo.
    if (isLogin) {
      return redirectTo(home);
    }

    // Cada rol en su módulo: el staff no pierde nada (también puede ver el
    // feed), pero un usuario común jamás entra al panel ni a la carga.
    // Excepción: /admin/cuenta (cambiar la propia contraseña) es para todo
    // el staff — sin ella el moderador quedaba sin forma de cambiarla.
    if (rol === "moderador" && path.startsWith("/admin") && path !== "/admin/cuenta") {
      return redirectTo("/moderador");
    }
    if (rol === "usuario" && (path.startsWith("/admin") || path.startsWith("/moderador"))) {
      return redirectTo("/feed");
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/moderador/:path*",
    "/feed/:path*",
    "/ingresar",
    "/registro",
  ],
};
