# Guía para agentes

## Reglas del proyecto

1. La lógica de gameplay vive en `packages/simulation` y no puede importar React, DOM, Three.js ni Supabase.
2. Toda modificación de simulación debe conservar orden estable, RNG con semilla y serialización JSON. Agregar una prueba de igualdad o checksum cuando corresponda.
3. No describir una mecánica como biológica sin registrarla en `docs/biology.md` con DOCUMENTADA, GENERAL, PLAUSIBLE, ABSTRACCIÓN o FICCIÓN.
4. No inventar taxones. Cuando la evidencia regional no sostenga especie, usar un gremio funcional y declarar la incertidumbre.
5. No añadir ventajas ocultas a bots ni acceso a niebla de guerra.
6. No enviar transformaciones gráficas por red. Se sincronizan comandos, ticks, checksums y snapshots.
7. No exponer service role, resultados administrativos ni secretos al navegador.
8. Mantener la partida local operativa sin Supabase.
9. Antes de entregar: typecheck, tests, build y una partida headless larga.
10. No convertir insectos en humanos miniatura ni las arañas en jefes con una única barra de vida.
