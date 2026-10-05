-- Catálogo de la tienda en UNA llamada.
--
-- Antes la tienda leía `tickets` con PostgREST, que corta en 1000 filas: con
-- ~2300 filas vigentes eran 3 consultas en fila (una espera la otra). Esta
-- función devuelve todo el catálogo como un único JSON (un solo valor, así el
-- tope de filas no aplica) con los mismos filtros que la consulta paginada:
--   - eventos vigentes: sin fecha o desde p_hoy (día argentino, lo pasa la app)
--   - NOT (book y retirada): las on_request vigentes (disponible=false por
--     diseño) se quedan, son las de "Consultar".
-- SECURITY INVOKER: corre con los permisos de quien llama (anon), así que la
-- RLS de `tickets` sigue mandando igual que antes. Solo crea una función: no
-- toca datos ni el código actual (que sigue con la lectura paginada si esto
-- falla).

create or replace function public.catalogo_tienda(p_hoy date)
returns json
language sql stable security invoker set search_path = public
as $$
  select coalesce(json_agg(t order by t.fecha asc nulls last, t.id asc), '[]'::json)
  from (
    select id, evento, competicion, fecha, ciudad, categoria, precio_final,
           moneda_final, stock, estado, source, disponible, imagen_url, zona_color
    from public.tickets
    where (fecha is null or fecha >= p_hoy)
      and (estado <> 'book' or disponible)
  ) t
$$;

revoke all on function public.catalogo_tienda(date) from public;
grant execute on function public.catalogo_tienda(date) to anon, authenticated, service_role;
