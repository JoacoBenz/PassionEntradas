-- Solicitudes de acceso a la tienda: un visitante de la landing pide acceso,
-- el admin aprueba/rechaza. Al aprobar se crea un usuario de Supabase Auth
-- con rol 'cliente' (app_metadata) y se le mandan las credenciales.
--
-- RLS deny-all (sin policies): la landing inserta y el panel lee/decide con
-- service role desde las API routes. Nada de esto es accesible con anon key.

create table if not exists public.solicitudes_acceso (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null,
  telefono text,
  mensaje text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'rechazada')),
  -- Se completan al aprobar/rechazar.
  user_id uuid,               -- usuario de Auth creado (aprobación)
  decidida_por text,          -- nombre/email del admin que decidió
  decidida_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.solicitudes_acceso enable row level security;

drop trigger if exists solicitudes_acceso_updated_at on public.solicitudes_acceso;
create trigger solicitudes_acceso_updated_at
  before update on public.solicitudes_acceso
  for each row execute function public.set_updated_at();

create index if not exists solicitudes_acceso_estado_idx
  on public.solicitudes_acceso (estado, created_at desc);

-- Una sola solicitud PENDIENTE por email (evita spam de duplicados; una
-- rechazada/aprobada no bloquea pedir de nuevo).
create unique index if not exists solicitudes_acceso_email_pendiente_uq
  on public.solicitudes_acceso (lower(email))
  where estado = 'pendiente';
