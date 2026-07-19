# Seguridad

## Fronteras

- El navegador es no confiable.
- La anon key de Supabase es pública y depende de RLS.
- La service role nunca llega al bundle, logs del cliente ni variables `NEXT_PUBLIC_*`.
- Sólo participantes leen una partida; sólo el UUID autenticado inserta sus batches.
- Los resultados no tienen política de inserción cliente.

## Controles

RLS en todas las tablas expuestas, funciones atómicas para crear/unirse a lobby, límite de cuatro miembros, secuencias únicas, payload JSON acotado, código de sala sin caracteres ambiguos, expiración y limpieza segura. Headers reducen sniffing, permisos innecesarios y filtrado de referrer.

## Pendiente antes de online público

Rate limiting por usuario/IP en funciones, validación semántica de cada comando, coordinador de snapshots, moderación de nombres, pruebas de RLS contra una instancia local, política de retención/borrado y revisión de dependencias. El lockstep casual no evita trampas; no habilitar ranking con este modelo.
