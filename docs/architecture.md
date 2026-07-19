# Arquitectura

## Corte vertical

El render corre libremente; la simulación avanza a 10 ticks por segundo. El frontend traduce entrada física en `SimCommand`, la simulación muta un estado serializable con orden estable y el render interpola la lectura más reciente. En local, Zustand agenda comandos y guarda snapshots en el navegador.

```text
teclado/mouse → comandos validados → simulación 10 Hz → snapshot/checksum
                                                ↘ estado observable → R3F
```

`packages/simulation` no conoce red ni UI. `packages/networking` aporta `MatchAuthorityAdapter`, batching por tick, comparación de checksum y restauración. `LocalAuthorityAdapter` permite probar el contrato. Un adaptador Supabase futuro transportará batches por Realtime Broadcast y usará Postgres sólo para snapshots periódicos y resultado.

## Decisiones

- Sin motor físico: el movimiento actual usa navegación plana y límites simples; Rapier no justifica aún su peso.
- Estado estructurado, no ECS completo: 150 agentes no requieren una dependencia adicional. Spatial hash es el siguiente umbral de rendimiento.
- Geometría procedural: identidad visual coherente sin licencias ni descarga de modelos.
- Local primero: el bucle central funciona offline después de cargar el bundle.
- Agregados tróficos: las cuatro facciones están representadas; sólo Acromyrmex recibe control corporal en este slice.

## Deuda conocida

El render crea un árbol React por individuo. Para superar 250 visibles se migrará a `InstancedMesh`, interpolación por buffers y spatial hashing. La navegación no resuelve túneles tridimensionales ni obstáculos cóncavos. Web Audio usa ruido generado localmente, no una mezcla final.
