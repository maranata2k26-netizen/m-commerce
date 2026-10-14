# Integración Simple: auditoría y entrega del 13 de octubre de 2026

## Alcance y decisión

Se consolidó la cadena de PR #7–12 y #15–21, junto con main y el contacto Joaco de #14. #13 está cerrado sin merge y queda excluido. Los PR originales no se fusionaron ni cerraron. Se recuperaron contratos SQL y pruebas de una copia local anterior sin sobrescribir sus cambios. Esta entrega es candidata para revisión: **NO APTO todavía para lanzamiento comercial de suscripciones**. Producción no fue modificada.

## Cambios

- Recibo de pedido confirmado con número y total; WhatsApp requiere una acción explícita. Catálogo y stock se actualizan al completar el pedido. Los precios conservan centavos.
- Errores de tienda y enlaces Auth vencidos tienen salida visible. Staging y producción mantienen clientes separados.
- La activación de una suscripción Simple no levanta una suspensión del Maestro. La reconciliación SQL bloquea la suscripción y deriva el acceso de pagos aprobados, vencimiento y eventos adversos. Solo service_role puede ejecutarla; PRO queda fuera de esta reconciliación.
- El webhook exige firma, cobrador, moneda e importe exactos; los errores de persistencia permiten reintento. Las simulaciones cubren rechazos, cancelaciones, devoluciones y contracargos.
- Envío transaccional del administrador con timeout y validación de respuesta. No se cambiaron credenciales ni destinatarios de producción.

## Evidencia de staging

Proyecto Supabase: `jcgvunffeskkbgsbomgy`. Sitio: https://m-commerce-staging.vercel.app . La URL antes servía una versión del 10 de octubre anterior a la cadena completa; se actualizó exclusivamente el alias de staging.

- 135 pruebas Node aprobadas, sin fallos ni omisiones. Type-check Deno de diez funciones aprobado.
- Suite SQL integral: 92 verificaciones, rollback completo. Suite de reconciliación: 14 verificaciones, rollback completo. Suites existentes de seguridad, Maestro, delivery y notificaciones aprobadas.
- Navegador: onboarding de diez pasos, carga de imagen real en Storage de staging, categoría, producto con precio 123,45, variante y delivery. Aislamiento entre dos comerciantes y denegación del Maestro a un comerciante comprobados. Suspensión/reactivación desde Maestro auditadas.
- Pedido ficticio offline #54, total 100, stock decrementado una vez y una notificación. No hubo cobro ni mensaje de WhatsApp. Se conserva identificado como QA en staging; hay usuarios y tiendas QA persistentes, separados de clientes.
- Publicar una tienda sin cuenta de cobro conectada devuelve `J3_BILLING_ACCOUNT_NOT_CONNECTED`; no se falseó el alta de pagos.

## Correo Auth: causa y corrección

El usuario confirmó llegada de ambos correos a Recibidos. Los enlaces validaban en Supabase, pero el retorno terminaba en `127.0.0.1:4318` y el navegador mostraba conexión rechazada. La Site URL y allowlist de staging solo admitían localhost.

Se guardó en el dashboard de **staging** Site URL `https://m-commerce-staging.vercel.app/simple/app` y se agregaron exactamente tres retornos públicos: `/simple/app`, `/simple/app?verified=1` y `/simple/app?reset=1`. Se conservaron los dos retornos locales existentes. No se agregaron comodines.

Los retornos Auth legítimos de las pestañas fallidas se abrieron en el dominio correcto: confirmación mostró el onboarding de M Commerce; recuperación mostró «Elegí una nueva contraseña». No se cambió la contraseña personal. Pruebas HTTP con token inválido también confirmaron el dominio público de retorno. Un primer reenvío recibió 429 por cuota del correo integrado.

**Actualización del 14 de octubre:** una vez restablecida la cuota, ambos envíos nuevos respondieron HTTP 200. Se verificaron directamente en Gmail y se abrieron sus enlaces nuevos: confirmación lleva al onboarding Simple y recuperación al formulario de nueva contraseña, ambos en `m-commerce-staging.vercel.app/simple/app`. No hubo redirecciones antiguas ni cambio de contraseña. Las capturas finales y resultados HTTP están en la entrega local, sin tokens. Esta segunda prueba sí verifica envío, entrega y retorno real con la configuración corregida.

El remitente observado fue Supabase Auth con correo integrado. Falta configurar un proveedor SMTP comercial y dominio verificado. La documentación de Supabase explica la cuota y restricciones: https://supabase.com/docs/guides/auth/auth-smtp . No se contrató un servicio ni se reutilizaron secretos de producción.

## Bloqueos comerciales restantes

1. Conectar y verificar la identidad real de la cuenta plataforma y cuentas de prueba Mercado Pago. Staging no tiene cuenta plataforma ni OAuth de comerciante configurados. Falta prueba genuina de proveedor, aprobación, rechazo, cancelación, devolución y conciliación; las pruebas simuladas no la sustituyen.
2. Configurar SMTP comercial y dominio verificado para atender registros de clientes ajenos al equipo y volumen comercial. La entrega y retorno real de ambos correos ya se comprobaron el 14 de octubre; el remitente integrado sigue limitado.
3. Reconciliar las migraciones antes de producción, ensayar la actualización sobre copia representativa y verificar regresión PRO de pagos. Los controles locales no prueban todas las operaciones históricas PRO.
4. Revisar los avisos de seguridad restantes: funciones SECURITY DEFINER expuestas, tablas RLS sin políticas y protección contra contraseñas filtradas deshabilitada. Son hallazgos a clasificar, no una afirmación de explotación ni de seguridad total. No se compró una mejora de plan.

## Migraciones y despliegue previsto

No ejecutar `supabase db push` ciegamente. Los ocho contratos recuperados de octubre 6–8 ya existen operacionalmente en staging, con historial distinto; producción tiene un historial más antiguo. Comparar definiciones y ACL mediante `pg_get_functiondef` y catálogos y mapear versión/nombre/hash antes de reparar historial.

Orden por dependencias: catálogo/legal y redacción de costos; gestión de solicitudes/categorías/políticas/tier público; stock atómico y protección de roles; contratos de billing, onboarding e idempotencia; seguridad/Maestro/delivery/inbox; reconciliación de entitlement del 13 de octubre. La nueva migración `20261013213042_simple_subscription_entitlement_reconciliation.sql` se aplicó solo en staging. Las migraciones recuperadas no se ejecutaron de nuevo ni se aplicaron en producción.

Antes de producción: backup restaurable de DB y funciones/ACL, inventario de secretos por nombre sin exportar valores, prueba de restauración aislada, ensayo SQL y PRO, revisión de PR y CI. Luego SQL compatible, Edge Functions, frontend, Auth URLs del entorno y smoke completo. Cada acción de producción requiere la autorización específica pendiente.

## Rollback

Producción permanece en deployment `dpl_2LhGy4pfsx7F6VSmkw2hZGuyhg4D` y main `6804444deee5cfa1f265aa812959694f3f817aaf`. Staging antes de esta integración: `dpl_CMmgMbSU7vXxVVBt7Yhg7i4cEHbr`.

Para revertir una futura liberación: volver al deployment previo, restaurar las versiones Edge compatibles antes de quitar RPC nuevas, y conservar eventos/pedidos/stock. Preferir rollback aditivo; no borrar pagos ni restaurar stock masivamente. Restaurar definiciones/ACL solo desde backup verificado y según dependencias. La configuración Auth corregida de staging debe mantenerse con el dominio público; restaurar localhost reproduciría el fallo.

Las credenciales QA, retornos con tokens y copias privadas quedan fuera del repositorio y de los entregables públicos. No se fusionó main, no se desplegó producción y no se efectuaron transacciones monetarias.

## Cierre reproducible

PR único de integración: https://github.com/maranata2k26-netizen/m-commerce/pull/22 . Rama `integration/simple-commercial-20261013`. Código validado en commit `54857480565e848b2b4ab17849f6a502c7055079`, árbol `322295966dcaa0cf118ddb41c9d2ea957003295a`; las actualizaciones posteriores de este informe no cambian el código ejecutable.

GitHub Actions: Simple, run 38473323356, **success**; staging payments, run 38473323444, **success**. PR sin conflictos, draft y sin merge. Frontend final READY: `dpl_Dy3mY3v2U32zEKPADB9FehQMdwrC`; siete assets verificados por SHA256 normalizado contra el candidato.

Supabase staging aplicado: reconciliación con versión remota `20261013213200`, equivalente al archivo local `20261013213042`. Edge activas: platform-admin v8, j3-billing v7, j3-billing-webhook v6. Se requiere reconciliar los timestamps del historial antes de aplicar la cadena en otro entorno.

La revisión adicional de Mercado Pago encontró inicio de sesión sujeto a verificación. El intento de acceso por el método disponible fue rechazado por el proveedor; no se accedió a sus credenciales ni se modificó la cuenta. Sin acceso verificado y sin cuentas de prueba conectadas a staging, la identidad y el circuito real de cobro siguen pendientes. No se sustituyó esta evidencia por el alias personal ni por una simulación.
