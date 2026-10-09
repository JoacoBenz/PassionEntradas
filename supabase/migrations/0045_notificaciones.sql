-- Avisos (campana + email + WhatsApp) en UNA tabla.
--
-- Cada fila es un aviso para una persona: un cliente (Confirmado / Para pagar
-- / Entregada de su pedido) o alguien del equipo (pedido nuevo, recordatorios).
-- La campana lee de acá, y la misma fila registra si el email y el WhatsApp
-- salieron, así un fallo queda a la vista y nada se manda dos veces.
--
-- `clave` es la deduplicación: un mismo hecho para la misma persona tiene
-- siempre la misma clave (p. ej. 'cliente:<op>:para_pagar'). Marcar y
-- desmarcar un hito no vuelve a avisar.
--
-- RLS deny-all como el resto: la app lee y escribe con service role.

create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  audiencia text not null check (audiencia in ('cliente', 'equipo')),
  -- A quién: el usuario (si tiene cuenta) y/o su email.
  destinatario_id uuid,
  destinatario_email text,
  tipo text not null,
  operacion_id uuid references public.operaciones (id) on delete cascade,
  consulta_id uuid references public.consultas (id) on delete cascade,
  -- Lo necesario para armar el texto en el idioma de quien lo lee (code,
  -- evento, montos…): el título no se guarda armado.
  datos jsonb not null default '{}'::jsonb,
  url text,
  leida_at timestamptz,
  email_estado text not null default 'no_aplica'
    check (email_estado in ('no_aplica', 'pendiente', 'enviado', 'error', 'sin_configurar')),
  email_error text,
  whatsapp_estado text not null default 'no_aplica'
    check (whatsapp_estado in ('no_aplica', 'pendiente', 'enviado', 'error', 'sin_configurar')),
  whatsapp_error text,
  created_at timestamptz not null default now()
);

create index if not exists notificaciones_dest_idx
  on public.notificaciones (destinatario_id, created_at desc);
create index if not exists notificaciones_email_idx
  on public.notificaciones (lower(destinatario_email), created_at desc);
create index if not exists notificaciones_equipo_idx
  on public.notificaciones (audiencia, created_at desc);

alter table public.notificaciones enable row level security;
revoke all on public.notificaciones from anon, authenticated;

-- Idioma en que el cliente hizo el pedido (el de la tienda en ese momento):
-- los emails le llegan en ese idioma. Sin dato, español.
alter table public.operaciones
  add column if not exists idioma text check (idioma in ('es', 'en'));

-- Lo mismo en la consulta: cuando el cliente acepta la cotización, el pedido
-- que nace hereda el idioma de la consulta.
alter table public.consultas
  add column if not exists idioma text check (idioma in ('es', 'en'));
