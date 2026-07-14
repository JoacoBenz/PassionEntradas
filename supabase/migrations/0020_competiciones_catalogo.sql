-- Lista de competiciones del catálogo, con DISTINCT en la base.
-- Antes se bajaba una fila por ticket y se deduplicaba en JS: con el
-- catálogo completo (1600+ filas) PostgREST corta en 1000 y los
-- desplegables ("Elegir evento" de márgenes, autocompletado del form)
-- mostraban la mitad de las competiciones.
-- Solo vigentes: las competiciones de eventos ya pasados no se listan.

create or replace function public.competiciones_catalogo(p_solo_portal boolean default false)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct competicion
  from public.tickets
  where competicion is not null
    and (not p_solo_portal or source = 'portal')
    and (fecha is null or fecha >= now() - interval '1 day')
  order by 1;
$$;

-- authenticated: la página de Entradas lo consulta con la sesión del panel
-- (que ya puede leer tickets completo); anon no lo necesita.
revoke execute on function public.competiciones_catalogo(boolean) from public, anon;
grant execute on function public.competiciones_catalogo(boolean) to authenticated, service_role;
