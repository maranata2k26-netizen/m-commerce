# M Commerce — control de lanzamiento (10-10-2026)

## Regla de seguridad
Producción Supabase (`kjoixhzaxopdbmudzfsg`) **solo lectura** en auditorías. Ningún cambio ni pago de prueba en producción sin haber validado primero en staging y obtenido autorización específica. No fusionar cambios de forma automática.

## Fuente de verdad
- GitHub `main` aloja principalmente la carcasa de Vercel y Simple; el runtime avanzado del Panel Maestro se distribuye desde Supabase.
- La rama `improvement/staging-billing-complete-20261010` tiene 21 commits por encima de `main`; todavía no está integrada.
- Este cambio `fix/simple-staging-isolation-20261010` corrige el entorno del **frontend Simple**. No implica por sí solo el aislamiento completo del Panel Maestro en staging.

## Hallazgos comprobados
1. Producción: la cuenta `platform_billing_accounts` de Mercado Pago está conectada, verificada y registra identidad Joaquín Jesús/José Carreira; correo registrado coincide con el esperado. **No sustituye una prueba de extremo a extremo con el procesador de pagos.**
2. Los pagos de suscripción de la plataforma usan `platform_billing_accounts`; los pagos de compras de los comercios usan `mercadopago_connections`. La rama de staging tiene contratos automáticos para esta separación.
3. Producción: dos tiendas Simple registradas y **cero publicadas** a la fecha de lectura. No hay aún un lanzamiento Simple público verificado.
4. Staging Supabase: hay base de datos separada, pero `platform_runtime_files` figura vacía y no se encontró `j3-runtime` desplegada. El PRO/Panel Maestro **no** tiene paridad demostrada en staging.
5. Vercel: la cuenta vinculada permite enumerar proyectos pero `get_project` y los logs del equipo devuelven 403 por alcance `maranata3`. No se ha validado la configuración del proyecto de staging ni un despliegue real.
6. Supabase producción: los avisos del asesor incluyen 28 funciones `SECURITY DEFINER` invocables por anon, 159 por authenticated, y protección de contraseñas filtradas sin activar. Los avisos requieren análisis individual de permisos y argumentos; no revocar en bloque.
7. Los contratos y verificaciones de CI del PR de aislamiento pasaron el 10-10-2026; se trata de comprobaciones estáticas y smoke de rutas (sin efectuar pagos).

## Corrección introducida
- El hostname público de staging `m-commerce-staging.vercel.app` y previews con prefijo `m-commerce-staging-` apuntan al proyecto Supabase `jcgvunffeskkbgsbomgy` usando su clave **publicable**, nunca una clave de servicio.
- `mcommerce.vercel.app` y el dominio anterior siguen apuntando a producción con la configuración previa.
- `simple.js`, `simple-bootstrap.js`, `simple-fixes-v3.js` y `simple-location-v4.js` leen una única configuración de entorno.
- Simple ya no carga `/config.js`, que en `vercel.json` se reescribe al runtime de producción.
- Test `scripts/frontend-environment.test.cjs` confirma aislamiento y orden de scripts.

## Criterios obligatorios de aceptación ANTES de vender Simple
- [ ] Autenticación real: registro, confirmación por correo, login/logout, reseteo y sesiones.
- [ ] Alta autogestionable; comprobar que un nuevo usuario no recibe ni modifica la tienda de otro.
- [ ] Asistente: perfil, logo, fotos, rubro, categorías, productos, variantes, stock, entregas y pagos.
- [ ] Vista previa privada; publicación bloqueada mientras suscripción esté pendiente.
- [ ] En staging con cuentas de prueba: suscripción Mercado Pago de M Commerce en cuenta verificada, retorno, validación del estado en servidor, webhook autenticado y reintentos idempotentes. Nunca inferir pago por una redirección del navegador.
- [ ] En staging: pedido efectivo/transferencia, pedido Mercado Pago del COMERCIO, cobro asociado al site correcto, precios/stock validados en servidor, doble clic/replay sin duplicar pedidos.
- [ ] Comprobaciones negativas: órdenes de otra tienda, pagos sin site_id, token/estado inválido, webhooks sin firma, tenant suspendido, comercio sin conexión MP.
- [ ] Control RLS A/B/outsider con pgTAP realmente ejecutado; asesor de seguridad sin hallazgos críticos sin resolver.
- [ ] Responsive en móviles, enlaces QR, email de usuario, errores, performance, accesibilidad y despliegue Vercel de staging confirmado.
- [ ] Alta real de una tienda piloto, de principio a fin, antes de habilitar comercialización general.

## Antes de ofrecer PRO/Panel Maestro
Reproducir runtime, infraestructura y pruebas del panel en staging. Auditar publicaciones, permisos de colaboradores, pedidos, devoluciones, integraciones, dominios, backup/restauración y monitoreo en la versión exacta desplegada. El repositorio GitHub actual no es copia total del runtime de producción.

**Estado verificable: NO apta todavía para afirmar comercialización general sin E2E.** Seguir trabajando en staging; no publicar en producción sin autorización específica.
