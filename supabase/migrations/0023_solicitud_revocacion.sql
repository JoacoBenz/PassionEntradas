-- Revocación de acceso de un cliente ya aprobado. No cambia el estado
-- (sigue 'aprobada'): la revocación es un sub-estado con su propia auditoría.
-- Revocar = quitarle el rol al usuario de Auth; reactivar = devolvérselo.

alter table public.solicitudes_acceso
  add column if not exists revocada_at timestamptz,
  add column if not exists revocada_por text;
