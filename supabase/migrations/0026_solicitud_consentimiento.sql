-- Consentimiento de términos y condiciones al pedir acceso. Se guarda que el
-- solicitante aceptó los términos (el momento queda en created_at). Aditiva:
-- las solicitudes previas quedan en false por defecto.
alter table public.solicitudes_acceso
  add column if not exists acepto_terminos boolean not null default false;
