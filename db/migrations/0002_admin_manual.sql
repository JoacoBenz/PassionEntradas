-- =============================================================================
-- Entradas manuales (admin) + auth del panel.
-- Aplicada en Supabase. Aditiva y compatible con el worker/front existentes.
-- =============================================================================

-- Distingue entradas del portal (sincronizadas) de las cargadas a mano.
alter table tickets add column if not exists source text not null default 'portal'
  check (source in ('portal', 'manual'));
create index if not exists idx_tickets_source on tickets (source);

-- Auth simple del panel admin: solo el HASH del token. RLS sin policies =>
-- inaccesible con anon key; solo lo lee el service_role (vía Edge Function).
create table if not exists admin_auth (
  id         int primary key default 1,
  token_hash text not null,
  updated_at timestamptz not null default now(),
  constraint admin_auth_singleton check (id = 1)
);
alter table admin_auth enable row level security;

create extension if not exists pgcrypto;

-- Token inicial (CAMBIAR). Se guarda solo el sha256.
-- update admin_auth set token_hash = encode(digest('TU_NUEVO_TOKEN','sha256'),'hex') where id = 1;
insert into admin_auth (id, token_hash)
values (1, encode(digest('tm-admin-2026', 'sha256'), 'hex'))
on conflict (id) do nothing;
