-- Registro de cambios del equipo (pantalla Equipo): cada alta, cambio de rol,
-- desactivación y reactivación queda con quién, cuándo y de qué rol a cuál.
-- El rol en sí sigue viviendo en app_metadata del usuario de Auth; esta tabla
-- es solo la auditoría.
--
-- RLS deny-all como el resto: solo el servidor (service role) lee y escribe.

create table if not exists public.equipo_cambios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  accion text not null check (accion in ('alta', 'rol', 'desactivar', 'reactivar')),
  rol_antes text,
  rol_despues text,
  por text not null,
  created_at timestamptz not null default now()
);

create index if not exists equipo_cambios_created_idx on public.equipo_cambios (created_at desc);

alter table public.equipo_cambios enable row level security;
revoke all on public.equipo_cambios from anon, authenticated;
