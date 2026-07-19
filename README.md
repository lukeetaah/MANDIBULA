# MANDÍBULA: PATAGONIA

Vertical slice jugable de una simulación 3D sistémica a escala de insecto. La partida local pone al jugador en una sucesión de obreras de _Acromyrmex lobicornis_: recolectar sustrato, sostener el cultivo, leer y emitir señales químicas, sobrevivir a depredadores y superar a una colonia bot.

## Estado real

Funciona sin cuenta ni servicios externos. Incluye una partida completa local contra bots, tutorial integrado, victoria/derrota, guardado local, tres niveles de mandato, cinco feromonas, clima, fauna NPC, dos gremios de arañas, cuatro identidades tróficas y modo táctico. Supabase, el lockstep y RLS están preparados pero requieren una instancia conectada para convertirse en multijugador real.

## Requisitos

- Node.js 22 o superior.
- pnpm 10 o superior.
- Navegador con WebGL 2.
- Supabase CLI sólo para validar o usar el backend opcional.

## Ejecutar

```bash
pnpm install
pnpm dev
```

Abrir `http://localhost:3000`. No hacen falta variables de entorno para la partida local.

## Verificar

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Para Supabase local:

```bash
supabase start
supabase db reset
```

Copiar `.env.example` a `.env.local` y completar sólo las claves públicas indicadas por `supabase status`. La service role nunca debe usar el prefijo `NEXT_PUBLIC_`.

## Controles

- WASD: mover.
- Mouse: orientar cámara (tras hacer clic en el juego).
- Shift: acelerar consumiendo energía.
- E: sujetar o entregar recurso.
- Q: emitir la señal seleccionada.
- F: cambiar tipo de señal desbloqueado.
- Tab: lectura táctica orgánica.
- Rueda: cambiar radio.
- Clic derecho: cancelar señales propias cercanas.
- Esc: pausa completa en el modo local.

## Estructura

- `apps/web`: Next.js, React Three Fiber, UX y persistencia local.
- `packages/simulation`: simulación determinista pura a 10 Hz.
- `packages/biology`: taxones, etiquetas de evidencia y perfiles.
- `packages/bots`: evaluación utility AI sin información oculta.
- `packages/networking`: comandos, checksums, snapshots y autoridad reemplazable.
- `supabase`: esquema, funciones atómicas y políticas RLS.
- `docs`: decisiones, evidencia, riesgos y despliegue.

## Alcance deliberado

Este slice no finge login, salas ni amistad: esas pantallas no existen hasta conectar y probar el backend. Vespula, Bombus y Porotermes son agentes sistémicos, no facciones seleccionables todavía. La araña dominante es una crisis rara preparada en la simulación y normalmente se evita o expulsa; su muerte no es el objetivo de la partida.

Licencia MIT. Los recursos visuales y sonoros actuales son procedurales; ver `docs/assets.md`.
