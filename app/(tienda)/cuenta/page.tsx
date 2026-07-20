import { requireAccesoTienda } from "@/lib/tienda-guard";
import { CuentaCliente } from "@/components/tienda/CuentaCliente";
import { isMock } from "@/lib/mock-db";

// Mi cuenta del cliente en la tienda: cambiar contraseña + cerrar sesión.
// Acceso reafirmado en el servidor (staff o cliente aprobado).
export const dynamic = "force-dynamic";

export default async function CuentaTiendaPage() {
  await requireAccesoTienda();
  return <CuentaCliente mock={isMock()} />;
}
