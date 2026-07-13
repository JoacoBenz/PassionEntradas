-- La tienda anónima solo necesita las columnas públicas de `tickets`.
-- Antes anon podía leer TODAS: precio_origen (el costo EUR, o sea el margen
-- exacto del negocio) y url_origen (el portal proveedor B2B) quedaban
-- expuestos a cualquiera con la anon key, que viaja en el bundle del front.
-- RLS filtra filas, no columnas: esto se resuelve con GRANTs por columna.
-- authenticated (panel) y service_role no cambian.

revoke select on table public.tickets from anon;

grant select (
  id,
  evento,
  competicion,
  fecha,
  ciudad,
  categoria,
  precio_final,
  stock,
  estado,
  source,
  disponible
) on table public.tickets to anon;
