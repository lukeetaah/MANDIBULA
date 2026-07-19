# Despliegue

## Vercel

1. Importar el repositorio desde GitHub.
2. Elegir `apps/web` como Root Directory, o mantener raíz y usar `pnpm --filter @mandibula/web build`.
3. Framework Preset: Next.js. No establecer `outputDirectory: out`.
4. Production Branch: `main`; previews en cada pull request.
5. Cargar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `NEXT_PUBLIC_ENABLE_REALTIME=true` por ambiente cuando el backend esté conectado.
6. Nunca cargar `SUPABASE_SERVICE_ROLE_KEY` como variable pública. Sólo funciones de servidor que la necesiten deben recibirla.
7. Verificar `/`, inicio de partida local, headers y logs sin valores secretos.

## Supabase

Crear un proyecto gratuito, vincular con `supabase link --project-ref …` y ejecutar `supabase db push`. Activar anonymous sign-ins y configurar Site URL/redirects por ambiente. Probar desde una base vacía antes de producción.

Un build local no es evidencia de despliegue. Registrar en el README/entrega la URL sólo después de abrirla y jugar el flujo mínimo.
