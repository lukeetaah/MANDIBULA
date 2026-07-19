# Networking

## Modelo

Lockstep casual basado en comandos. Cada cliente recibe semilla/configuración, envía comandos numerados para ticks futuros y ejecuta la misma simulación. Se compara un checksum FNV-1a de estado cuantizado; una divergencia solicita el último snapshot validado.

`MatchAuthorityAdapter` separa coordinación de transporte. El adaptador futuro de Supabase debe usar Realtime Broadcast para batches, confirmaciones y solicitud de snapshot. Presence sólo representa lobby, listo, conexión, espectador y reconexión. Nunca se emiten transformaciones de cientos de agentes.

## Riesgos reales

El MVP no es autoritativo: un cliente modificado puede intentar omitir órdenes, adelantar información o proponer snapshots falsos. RLS impide escribir por otro UUID, pero no prueba que un comando sea físicamente válido. Los resultados sólo se insertan por una función/autoridad no expuesta; ranking queda fuera hasta contar con coordinador persistente.

## Reconexión

1. Presencia marca desconexión pendiente.
2. Cliente pide snapshot validado y batches posteriores.
3. Verifica checksum y protocolo.
4. Reproduce hasta el tick de seguridad.
5. Reanuda envío con el último número de secuencia.

Los snapshots usan JSON en el slice; producción debería comprimirlos y limitar retención. Vercel WebSockets no es dependencia y cualquier experimento debe quedar bajo feature flag.
