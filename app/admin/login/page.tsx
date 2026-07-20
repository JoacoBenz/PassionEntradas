import { redirect } from "next/navigation";

// El login dejó de ser específico del panel: ahora hay un login único y
// público en /ingresar (redirige por rol). Esta ruta queda como alias para no
// romper links/bookmarks viejos.
export default function AdminLoginRedirect() {
  redirect("/ingresar");
}
