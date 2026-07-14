-- Facturas/recibos de entradas vendidas. Una por operación, con snapshot
-- inmutable en jsonb: si la operación se edita después, el invoice emitido
-- no cambia (criterio contable). El número es correlativo por secuencia
-- (TM-<año>-<numero> se formatea en la app).
--
-- Acceso: RLS deny-all (sin policies). El panel escribe con service role;
-- la vista pública pasa por un RPC que exige el uuid exacto, igual que
-- operacion_publica.

create sequence if not exists public.facturas_numero_seq;

create table if not exists public.facturas (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique default nextval('public.facturas_numero_seq'),
  operacion_id uuid not null unique references public.operaciones(id) on delete cascade,
  datos jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.facturas enable row level security;

drop trigger if exists facturas_updated_at on public.facturas;
create trigger facturas_updated_at
  before update on public.facturas
  for each row execute function public.set_updated_at();

-- Vista pública: solo por uuid exacto, devuelve el snapshot completo (el
-- snapshot ya es la versión "para el cliente": no incluye notas internas).
create or replace function public.factura_publica(f_id uuid)
returns table (numero integer, datos jsonb, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select f.numero, f.datos, f.created_at
  from public.facturas f
  where f.id = f_id;
$$;

revoke all on function public.factura_publica(uuid) from public;
grant execute on function public.factura_publica(uuid) to anon, authenticated;
