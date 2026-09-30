# Auditoría inicial · M Commerce Simple

Fecha: 2026-09-30  
Proyecto: `maranata2k26-netizen/m-commerce`  
Supabase: `kjoixhzaxopdbmudzfsg`

## Resultado ejecutivo

M Commerce no necesita una reescritura. La plataforma ya tiene una base multi-tenant sustancial que debe reutilizarse. La implementación de Simple en esta rama es incremental y mantiene a todos los sitios existentes como `pro`.

## Infraestructura reutilizada

- Supabase Auth y sesiones persistentes.
- `sites` como tenant inmutable y `site_memberships` para autorización.
- RLS en todas las tablas públicas revisadas.
- `settings`, `products`, `product_variants`, `orders` y `order_items`.
- Checkout transaccional con cálculo de precios y reserva de stock en backend.
- Mercado Pago por comercio mediante `mercadopago_connections.site_id`.
- Webhook que consulta al proveedor, valida importes y registra eventos idempotentes.
- Suscripciones separadas en `site_subscriptions`, `subscription_plans` y `subscription_payment_events`.
- Auditoría mediante `platform_audit_logs`.
- Publicación y storefront mediante RPC existentes.
- Panel Maestro y funciones de suspensión/reactivación existentes.

## Separación confirmada

Los pagos de pedidos usan las credenciales del comercio correspondiente. Las suscripciones de la plataforma usan la cuenta de facturación de M Commerce y tablas/eventos separados.

## Riesgos detectados

1. El código fuente principal no vive en GitHub: se sirve desde `platform_runtime_files` y Edge Functions. Esta rama comienza a versionar los componentes nuevos.
2. Supabase Branching no está disponible en el plan actual. La migración se validó contra el esquema real dentro de una transacción finalizada con `ROLLBACK`.
3. El bucket histórico `product-images` no tiene límite de tamaño ni tipos MIME. Simple usa un bucket nuevo, limitado a 8 MB y formatos de imagen web.
4. Los asesores de Supabase informan funciones `SECURITY DEFINER` expuestas. Las revisadas contienen validaciones internas, pero el conjunto completo debe seguir auditándose.
5. La protección de contraseñas filtradas está deshabilitada en Supabase Auth.
6. Hay advertencias de índices faltantes, políticas permisivas duplicadas y un índice duplicado en `settings`.

## Decisiones conservadoras

- No se modifica la experiencia PRO.
- No se reemplazan las tablas de catálogo/pedidos existentes.
- Simple agrega clasificación, onboarding y categorías genéricas compatibles.
- Todos los RPC de escritura validan membresía en backend.
- El alta autogestionable usa el usuario autenticado; nunca acepta un `owner_id` enviado por el navegador.
- Las imágenes se aíslan con la ruta `sites/<site_id>/...` y políticas de Storage.
- El checkout público vuelve a validar tenant, plan, método, productos, precios y stock.
- WhatsApp se abre solamente después de persistir el pedido.

## Estado de verificación

- Auditoría de esquema, RLS, Storage, funciones y Edge Functions: realizada.
- Migración completa ejecutada con `ROLLBACK`: sin errores.
- Pruebas pgTAP de aislamiento A/B: incluidas para ejecutar en staging.
- Validación estática de frontend y Edge Function: automatizada en CI.
- Pruebas E2E reales, Mercado Pago sandbox y publicación: pendientes de un entorno Supabase de staging o activación controlada.
