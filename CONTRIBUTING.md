# Contribuir

Crear una rama corta y mantener cada cambio en un solo dominio: simulación, render, datos, UX o documentación biológica.

Antes de un pull request:

1. Ejecutar `pnpm format:check`, `pnpm typecheck`, `pnpm test` y `pnpm build`.
2. Explicar impacto determinista, de base de datos y biológico.
3. Adjuntar fuente primaria para conductas nuevas; una fuente taxonómica no demuestra conducta.
4. Si cambia el protocolo, incrementar su versión y documentar compatibilidad.
5. Si cambia SQL, añadir una migración nueva: nunca editar una ya publicada.

No incluir `.env`, tokens, dumps de producción, material sin licencia ni telemetría personal.
