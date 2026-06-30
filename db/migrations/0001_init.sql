-- =============================================================================
-- PassionEntradas — migración inicial
-- Tabla `tickets` (catálogo publicado) + `sync_runs` (auditoría) + RLS.
-- Idempotente: se puede correr varias veces.
-- =============================================================================

-- ---- Tabla principal --------------------------------------------------------
create table if not exists tickets (
  id              text primary key,                 -- id estable: evento::categoria
  evento          text not null,
  competicion     text,
  fecha           timestamptz,
  ciudad          text,
  categoria       text,
  precio_origen   numeric(12,2) not null check (precio_origen >= 0), -- EUR del portal
  moneda_origen   text not null default 'EUR',
  precio_final    numeric(12,2) not null check (precio_final >= 0),  -- con markup (y conversión)
  moneda_final    text not null default 'EUR',
  stock           integer check (stock is null or stock >= 0),       -- null si solo hay disp/agotado
  disponible      boolean not null default true,
  url_origen      text,
  scraped_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---- Índices de lectura (front) --------------------------------------------
create index if not exists idx_tickets_disponible  on tickets (disponible);
create index if not exists idx_tickets_competicion on tickets (competicion);
create index if not exists idx_tickets_fecha        on tickets (fecha);
create index if not exists idx_tickets_updated_at   on tickets (updated_at);

-- ---- updated_at automático --------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tickets_updated_at on tickets;
create trigger trg_tickets_updated_at
  before update on tickets
  for each row execute function set_updated_at();

-- ---- Auditoría de sync ------------------------------------------------------
create table if not exists sync_runs (
  id                 bigint generated always as identity primary key,
  status             text not null,                 -- ok | aborted | error
  reason             text,
  scraped_raw        integer,
  scraped_valid      integer,
  discarded          integer,
  baseline_available integer,
  upserted           integer,
  marked_unavailable integer,
  duration_ms        integer,
  created_at         timestamptz not null default now()
);

-- =============================================================================
-- RLS
-- - El front usa la anon key: SOLO SELECT sobre `tickets`.
-- - El worker usa la service_role key: SALTEA RLS (insert/update/delete).
--   Por eso NO hace falta policy de escritura: service_role la evita.
-- - `sync_runs` queda sin policies => solo service_role la lee/escribe.
-- =============================================================================
alter table tickets   enable row level security;
alter table sync_runs enable row level security;

drop policy if exists tickets_select_public on tickets;
create policy tickets_select_public
  on tickets
  for select
  to anon, authenticated
  using (true);
