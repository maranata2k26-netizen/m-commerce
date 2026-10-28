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

## Actualización verificada del 28 de octubre

Los estados pendientes del párrafo anterior quedan actualizados: se completaron rechazo OTHE, aprobación APRO y cancelación de suscripciones ficticias. El último ensayo activó QA A, permitió publicar mediante el botón normal y terminó con la suscripción ficticia cancelada. Se conservaron las verificaciones de receptor test_user y comprador ficticio identificado.

OAuth de comercio quedó configurado con callback exacto de staging y PKCE; MC Comercio QA, receptor 3768186746, es distinto de la plataforma 3764484563. La compra desde el catálogo público de QA A produjo el pedido #59, ARS 123,45, pago 185410090891. Consulta al proveedor confirmó comprador 3768187092, cobrador correcto, moneda, importe y referencia. El webhook dejó paid/approved; stock de variante 3 a 2; un aviso de pedido y un aviso de pago. Dos reenvíos firmados por QA conservaron un evento y stock 2.

La devolución por API con ese token OAuth devolvió 401/code 7, Unauthorized use of live credentials: esa vía no se da por validada. Se completó por la interfaz de la cuenta ficticia vendedora. El proveedor confirmó refunded total ARS 123,45, refund 3478385460 approved. El webhook guardó payment_status=refunded y dos reenvíos conservaron un único evento refunded. El stock no se repone automáticamente por una devolución financiera. La pantalla de retorno ahora consulta tracking autorizado, compara tienda y pedido y muestra el estado del servidor: Pago aprobado antes de devolver y El pago fue devuelto después, incluso con payment=success en la URL.

149 pruebas Node aprobadas; CI Simple run 40625995261 y staging payments run 40625995253 SUCCESS para código 72da3a951a205fc7714613a8fd33f760556f8dde. Deployment READY dpl_7uG6WWETr3g2D4P3EtNuXKr7DjQ7 del proyecto separado m-commerce-staging; alias actualizado y siete assets comparados por hash. Producción conserva dpl_2LhGy4pfsx7F6VSmkw2hZGuyhg4D.

El dashboard productivo confirma que Free no incluye backups. El ensayo de esquema pasó 19 migraciones y 92 comprobaciones, pero no sustituye el backup completo restaurado. Continúan pendientes la preparación productiva, regresión histórica PRO de pagos y cierre completo de la revisión de seguridad. No se afirma APTO PARA VENDER ni se ejecutan cobros reales.
