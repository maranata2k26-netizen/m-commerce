# Preparación de receptor ficticio en staging

La función qa-mp-platform-setup es una herramienta de QA exclusiva de https://jcgvunffeskkbgsbomgy.supabase.co. No se debe desplegar como parte del lanzamiento productivo y su guardia rechaza cualquier otro proyecto antes de leer credenciales.

Requiere JWT y perfil Maestro verificado en base de datos. El token se carga directamente como secreto QA_MP_ACCESS_TOKEN desde el dashboard; nunca se envía en el cuerpo de la petición ni se devuelve en la respuesta. Se consulta users/me de Mercado Pago y se exige tag test_user, identidad exacta esperada y sitio MLA. Rechaza identidades reales, receptores usados por comercios y cualquier cuenta de plataforma ya conectada.

POST con action=verify y expected_test_user_id valida sin escribir. action=prepare guarda únicamente pending_confirmation. Después debe ejecutarse account_confirm de j3-billing-account, que vuelve a verificar la identidad por el camino normal. Las escrituras condicionales preservan una conexión que aparezca concurrentemente.

## Evidencia del 25 y 26 de octubre de 2026

- Verificación API del token: test_user=true, identidad esperada y país correctos.
- Receptor conectado mediante prepare seguido de account_confirm, sin conflicto con comercios.
- Suscripción ficticia creada para QA Final Integración A, plan ARS 25.000. Segundo intento devuelve la misma suscripción; un solo evento de creación.
- La tienda continúa draft/pending y last_paid_at=null mientras el proveedor está pending.
- Webhook de la aplicación ficticia apunta a staging. Tras confirmar el reemplazo del secreto de staging, firma inválida devuelve 401 y replay firmado de la suscripción devuelve 200. Esto verifica el receptor y su firma; no es prueba de entrega originada en Mercado Pago.
- El checkout venció durante la pausa entre días; se retomó con el init_point de la misma suscripción. Aprobación y rechazo de tarjeta siguen pendientes al escribir esta evidencia.

148 pruebas Node aprobadas y Deno check de la herramienta aprobado. Producción y main permanecen sin cambios. No se ejecutaron cobros reales.
