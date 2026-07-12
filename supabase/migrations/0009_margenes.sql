-- Márgenes de precio configurables por proveedor + categoría (antes: 20%
-- hardcodeado en el worker). El panel edita esta tabla; el worker la lee en
-- cada corrida; recalcular_precios_portal() actualiza lo ya publicado.
--
-- Precedencia: (source, categoria) > (source, null = margen general) > 20%.

create table public.margenes (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'portal',
  -- null = margen general del proveedor (aplica a toda categoría sin regla propia)
  categoria text check (categoria is null or length(trim(categoria)) > 0),
  porcentaje numeric(6,2) not null check (porcentaje >= 0 and porcentaje <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unicidad tratando null como valor (una sola regla general por proveedor).
create unique index margenes_unicos_idx
  on public.margenes (source, coalesce(categoria, ''));

alter table public.margenes enable row level security;

drop trigger if exists trg_margenes_updated_at on public.margenes;
create trigger trg_margenes_updated_at
  before update on public.margenes
  for each row execute function public.set_updated_at();

-- El 20% histórico queda como margen general inicial.
insert into public.margenes (source, categoria, porcentaje)
values ('portal', null, 20);

-- Recalcula precio_final de las entradas del portal ya publicadas según las
-- reglas vigentes. Las manuales no se tocan (su precio es el cargado a mano).
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
            where m.source = t.source and m.categoria = t.categoria),
          (select m.porcentaje from public.margenes m
            where m.source = t.source and m.categoria is null),
          20) / 100.0), 2),
      updated_at = now()
  where t.source = 'portal' and t.precio_origen is not null;
  get diagnostics n = row_count;
  return n;
end;
$$;
