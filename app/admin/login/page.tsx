import { redirect } from "next/navigation";

// El login dejó de ser específico del panel: ahora hay un login único y
// público en /ingresar (redirige por rol). Esta ruta queda como alias para no
// romper links/bookmarks viejos. El middleware ya lo resuelve; esta página es
// el fallback. force-dynamic para que el redirect emita un 307 con Location
// real (como estática, Next cacheaba un 307 sin Location).
export const dynamic = "force-dynamic";

export default function AdminLoginRedirect() {
  redirect("/ingresar");
}
