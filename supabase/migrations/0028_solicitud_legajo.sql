-- El formulario de solicitud de acceso pedía "Dirección"; pasa a pedir
-- "Legajo / CUIL / CUIT", que es lo que el negocio necesita para dar de alta
-- a un agente.
--
-- Se agrega una columna nueva en vez de reusar `direccion`: dejar un campo
-- llamado `direccion` guardando un CUIT confunde a cualquiera que lea la tabla
-- después. `direccion` queda como está, con los datos de las solicitudes
-- históricas (y la sigue usando el perfil del cliente en /cuenta).
--
-- Nullable a propósito: las solicitudes ya cargadas no tienen legajo, y la
-- obligatoriedad para las nuevas vive en la validación de la API.

alter table public.solicitudes_acceso
  add column if not exists legajo text;

comment on column public.solicitudes_acceso.legajo is
  'Legajo / CUIL / CUIT del agente que solicita acceso. Texto libre: el formato lo valida la app, no la base.';
