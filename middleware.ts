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
    if (request.nextUrl.pathname === "/admin/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
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
  const isLogin = path === "/admin/login";
  const needsAuth = path.startsWith("/admin") || path.startsWith("/moderador");

  function redirectTo(pathname: string) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    return NextResponse.redirect(url);
  }

  // Sin sesión en una ruta protegida (que no sea el login) -> al login.
  if (!user && needsAuth && !isLogin) {
    return redirectTo("/admin/login");
  }

  if (user) {
    const rol = getRol(user);

    // Sesión sin rol del panel (cuenta creada por fuera): afuera. Se corta
    // la sesión para que el login no la recicle en loop.
    if (!esStaff(rol) && !isLogin) {
      await supabase.auth.signOut();
      return redirectTo("/admin/login");
    }

    // Ya logueado y entrando al login -> a su módulo.
    if (isLogin && esStaff(rol)) {
      return redirectTo(rol === "moderador" ? "/moderador" : "/admin");
    }

    // Moderador en el panel de administración -> a su módulo, con una
    // excepción: /admin/cuenta (cambiar su propia contraseña) es para todos.
    if (rol === "moderador" && path.startsWith("/admin") && path !== "/admin/cuenta") {
      return redirectTo("/moderador");
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/moderador/:path*"],
};
