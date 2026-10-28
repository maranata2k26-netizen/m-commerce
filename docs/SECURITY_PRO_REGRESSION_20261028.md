# Revisión adicional de seguridad y contratos PRO

## Aislamiento administrativo en staging

Se ejecutaron 22 RPC con una sesión de comerciante QA A intentando usar la tienda de QA B. Todas rechazaron el acceso mediante controles de miembro, propietario o administrador. Incluye dashboard, publicación y onboarding Simple; conexión y suscripción; catálogo, branding, dominios y diseños; administración de ferretería y canchas. Los cambios potenciales quedan dentro de una transacción con ROLLBACK. La suite está en supabase/tests/security-cross-tenant-staging.sql y requiere los dos actores QA existentes.

La RPC de carnicería se excluyó de esa suite porque la tienda objetivo no tiene ese rubro y el backend devuelve NOT_A_BUTCHERY antes de poder comprobar el caso de autorización de ese módulo. No se cuenta ese rechazo como prueba completa de acceso a una carnicería ajena.

Se comprobó adicionalmente que create_checkout_order_v117, platform_apply_order_payment, platform_claim_subscription_attempt, simple_create_offline_order y simple_reconcile_subscription_entitlement tienen EXECUTE solo para service_role entre los tres roles cliente/backend inspeccionados. anon y authenticated carecen de acceso directo. Esto no sustituye la revisión de todos los demás contratos.

## Regresión de pagos PRO en base de datos

Se creó un fixture transaccional, se configuró explícitamente product_tier=pro antes de todas las comprobaciones de checkout y se utilizó create_checkout_order_v117, el contrato que usa checkout-create. No se cambiaron comercios persistentes ni se cobró a nadie.

Pasaron 15 comprobaciones: centavos exactos; reserva de stock; mismo pedido y stock al reintentar checkout; rechazo y reposición única; aprobación; notificación única al reintentar; rechazo tardío que no degrada un pago aprobado; stock del aprobado preservado; devolución que no puede degradarse por aprobación tardía; reconciliación Simple que deja PRO fuera; y checkout en efectivo con importe/stock correctos. La suite supabase/tests/pro-order-payment-staging.sql terminó con ROLLBACK.

Los estados de proveedor de esta suite son fixtures SQL. No se presentan como pagos genuinos de Mercado Pago ni como prueba de todo el frontend histórico PRO. El pago y devolución genuinos ficticios anteriores se comprobaron en el checkout Simple que comparte estos contratos de backend.

## Ensayo reproducible

La misma suite PRO se agregó al ensayo aislado de actualización. Resultado: 19 migraciones aprobadas, cero limitaciones del modelo declarado, suite integral de 92 comprobaciones, privilegios de RPC internas y las 15 comprobaciones PRO aprobadas. El ensayo sigue sin copiar datos de clientes y no equivale a un backup completo restaurado.

## Respaldo productivo

Producción usa PostgreSQL 17.6. El dashboard Free no ofrece backups y la conexión muestra [YOUR-PASSWORD]; no revela la contraseña existente. Se verificó la alternativa Session pooler del proyecto para preparar una exportación de solo lectura. No se restableció la contraseña ni se modificó producción. La exportación completa requiere la contraseña PostgreSQL actual o un respaldo existente; una sesión de dashboard/MCP no proporciona por sí sola ese acceso.

Continúa pendiente la protección contra contraseñas filtradas, el cierre de los restantes avisos de seguridad y la restauración completa aislada. No se amplían planes ni se habilitan gastos. El candidato permanece sin merge y sin publicación productiva.
