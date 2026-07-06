-- AdminTickets — esquema inicial
-- Tabla `operaciones` + enum de estado + trigger de updated_at + RLS.

-- Necesario para gen_random_uuid()
create extension if not exists pgcrypto;

-- 1) Enum de estados de la operación
do $$
begin
  if not exists (select 1 from pg_type where typname = 'operacion_status') then
    create type operacion_status as enum (
      'esperando_entrada',
      'entrada_recibida',
      'confirmada',
      'cancelada'
    );
  end if;
end$$;

-- 2) Tabla principal
create table if not exists public.operaciones (
  id uuid primary key default gen_random_uuid(),          -- va en el link público
  code text not null unique,                              -- code legible para el admin
  evento text not null,
  comprador_alias text,
  vendedor_alias text,
  monto integer not null default 0,                       -- ARS sin decimales
  fee integer not null default 0,                         -- comisión del admin, ARS
  status operacion_status not null default 'esperando_entrada',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operaciones_created_at_idx
  on public.operaciones (created_at desc);

-- 3) Trigger de updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_operaciones_updated_at on public.operaciones;
create trigger trg_operaciones_updated_at
  before update on public.operaciones
  for each row
  execute function public.set_updated_at();

-- 4) Row Level Security
alter table public.operaciones enable row level security;

-- Lectura pública (anon) por uuid para la vista de estado.
-- El uuid es impredecible; la app solo consulta filas por id concreto.
drop policy if exists "op_public_read" on public.operaciones;
create policy "op_public_read"
  on public.operaciones
  for select
  to anon, authenticated
  using (true);

-- Escritura / creación / cambios de estado: SOLO usuarios autenticados (admin).
-- (En la práctica el servidor usa la service role, que bypassa RLS; estas
--  políticas cubren cualquier acceso autenticado directo y bloquean a anon.)
drop policy if exists "op_admin_insert" on public.operaciones;
create policy "op_admin_insert"
  on public.operaciones
  for insert
  to authenticated
  with check (true);

drop policy if exists "op_admin_update" on public.operaciones;
create policy "op_admin_update"
  on public.operaciones
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "op_admin_delete" on public.operaciones;
create policy "op_admin_delete"
  on public.operaciones
  for delete
  to authenticated
  using (true);
