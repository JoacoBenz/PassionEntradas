-- Config simple clave/valor numérico. Primer uso: cotización EUR->USD para
-- la tienda (el precio base del portal está en euros; se muestra en dólares).
-- Lectura pública (la tienda la lee con el anon key); escritura solo con
-- service role desde /api/cotizacion (sin policies de insert/update).

create table if not exists public.config (
  key text primary key,
  value numeric not null,
  updated_at timestamptz not null default now()
);

alter table public.config enable row level security;

drop policy if exists config_select_public on public.config;
create policy config_select_public on public.config
  for select to anon, authenticated using (true);

drop trigger if exists config_updated_at on public.config;
create trigger config_updated_at
  before update on public.config
  for each row execute function public.set_updated_at();

insert into public.config (key, value)
values ('eur_usd', 1.08)
on conflict (key) do nothing;
