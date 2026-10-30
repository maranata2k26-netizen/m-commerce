# Ítem 10 — Correos y notificaciones · verificación para staging

**Estado:** la bandeja interna queda implementada y probada. Los correos externos NO se envían desde esta PR. Esto es intencional: no hay proveedor SMTP transaccional verificado en el alcance de GitHub/Supabase disponible.

## Eventos que se registran automáticamente
- Pedido creado en una tienda Simple: mensaje con identificador de pedido, sin datos privados del cliente.
- Pago aprobado mediante actualización real del estado del pedido: se registra una vez por pedido.
- Pago rechazado, cancelado o devuelto: evento separado e idempotente.
- Cambio de estado de suscripción Simple: evento informativo separado.
- El comerciante ve sólo su tienda, puede actualizar la bandeja y marcar un aviso como leído. No se envía ningún email ni SMS ni se afirma que se entregó una notificación push.

**Protección de compra:** la base de datos registra el evento después del cambio; cualquier error de escritura en la bandeja es atrapado por el trigger para que no revierta compras, stock o actualizaciones verificadas de Mercado Pago.

## Verificación externa de correo, antes de habilitar el lanzamiento
1. En proyecto Supabase **staging**, comprobar Auth → Email templates, SMTP personalizado, remitente verificado (SPF, DKIM, DMARC del dominio elegido) y cuotas. No introducir secretos SMTP en GitHub.
2. Crear una cuenta de prueba independiente con email controlado; comprobar confirmación, spam, enlaces al dominio staging y reenvío con límites de frecuencia. No confundir la respuesta exitosa de Auth con entrega del email.
3. Probar recuperación de contraseña con token nuevo, expirado y utilizado; comprobar que no revela si existe el correo, y que la sesión sólo se habilita si Supabase valida el enlace.
4. Si se quieren **emails por pedidos**, aprobar proveedor transaccional, origen de correo, plantillas, consentimientos y reglas de reintento. Luego añadir un worker dedicado con outbox y deduplicación por `event_key`. No enviar desde triggers SQL ni webhooks de pagos, y evitar avisos duplicados.
5. Probar pagos por **webhook verificado**, no por vuelta del navegador a una URL `payment=success`. Los eventos de esta bandeja derivan de la columna `orders.payment_status` y no de parámetros del cliente.
6. Separar avisos para comerciantes y clientes. La bandeja Simple sólo es visible a comerciantes autenticados y no debe exponer datos de otras tiendas.

**Staging:** `jcgvunffeskkbgsbomgy`. **Producción: sólo lectura, sin merge ni despliegue.**
