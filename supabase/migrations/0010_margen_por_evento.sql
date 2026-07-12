-- El margen se marca por EVENTO/COMPETICIÓN (ej: "World Cup 2026"), no por
-- categoría de asiento: una regla cubre todas las entradas de ese torneo.

alter table public.margenes rename column categoria to competicion;

drop index if exists margenes_unicos_idx;
create unique index margenes_unicos_idx
  on public.margenes (source, coalesce(competicion, ''));

create or replace function public.recalcular_precios_portal()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.tickets t
  set precio_final = round(
        t.precio_origen * (1 + coalesce(
          (select m.porcentaje from public.margenes m
            where m.source = t.source and m.competicion = t.competicion),
          (select m.porcentaje from public.margenes m
            where m.source = t.source and m.competicion is null),
          20) / 100.0), 2),
      updated_at = now()
  where t.source = 'portal' and t.precio_origen is not null;
  get diagnostics n = row_count;
  return n;
end;
$$;
