-- Auditoría de hitos: quién marcó cada paso de la operación (email del
-- admin logueado). Se muestra en el panel ("por kiru") para saber a quién
-- preguntarle por cada paso. Se limpia al desmarcar el hito.
-- Datos internos: el RPC operacion_publica NO los expone.

alter table public.operaciones
  add column if not exists entrada_recibida_por text,
  add column if not exists pago_confirmado_por text,
  add column if not exists cerrada_por text;
