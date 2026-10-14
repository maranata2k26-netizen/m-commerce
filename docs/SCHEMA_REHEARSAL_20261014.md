# Ensayo de actualización del 14 de octubre

Se reconstruyó una base PostgreSQL aislada con PGlite 0.3.14 a partir de metadatos del catálogo productivo obtenidos exclusivamente por SELECT. No se copiaron filas de clientes, pedidos, cuentas de cobro ni credenciales. Los snapshots de esquema quedan privados en work, fuera del repositorio y de los ZIP públicos.

El modelo reconstruido contiene 131 tablas, 239 funciones SQL/PLpgSQL (incluidas nueve funciones privadas de dependencia), 655 restricciones, 214 índices independientes, 20 triggers y 126 políticas. Se conservaron grants de tablas, secuencias, columnas y funciones para PUBLIC, anon, authenticated y service_role, columnas generadas, enums y defaults. Las vistas, las extensiones remotas y el proceso externo de Auth/Storage no se reproducen como servicios operativos.

Las **18 migraciones posteriores al baseline productivo**, desde catálogo/legal del 6 de octubre hasta reconciliación de suscripciones del 13, se aplicaron ordenadas sin error. Después, la suite SQL integral pasó **92 comprobaciones** y confirmó el rollback de sus fixtures. No se detectaron objetos faltantes dentro del conjunto reconstruido.

Los primeros intentos del harness señalaron carencias del modelo de ensayo: índices únicos independientes, columnas generadas, funciones privadas, privilegios por columna/función y buckets de fixture. Se incorporaron desde metadatos o como fixtures ficticios explícitos; no se relajaron políticas ni validaciones de las migraciones o de la suite para conseguir el resultado.

## Reproducción

Con npm ci completado, ejecutar:

```text
node scripts/rehearse-schema-upgrade.cjs <directorio-privado-de-snapshots>
```

El directorio debe contener production-schema-only.json, production-schema-extra.json, production-schema-grants.json, production-schema-column-grants.json y production-schema-function-grants.json. Los archivos guardados en el workspace son la evidencia privada usada en esta entrega; no contienen filas productivas. El script produce migration-rehearsal-results.json y termina con código distinto de cero ante limitaciones, migraciones fallidas o pruebas fallidas. Las migraciones y la suite se leen directamente del checkout.

Este ensayo reduce el riesgo de incompatibilidad de esquema. No equivale a una restauración completa de producción, una prueba de rendimiento con datos reales ni una validación de los proveedores externos de pagos, correo o Storage. El historial de versiones de staging requiere reconciliación documentada porque sus timestamps remotos difieren de algunos archivos; no debe repararse ni aplicarse ciegamente.

## Comprobación de servicios externos

Consultas HTTP autenticadas con la identidad Maestro QA de staging:

- platform-admin / mail_status: HTTP 200, provider manual_link, transport null, sender_domain null. No hay configuración Resend utilizable en esta función.
- j3-billing-account / account_status: HTTP 200, connected false, status disconnected.
- Resend en navegador: formulario de inicio de sesión, sin sesión operativa.
- Mercado Pago en navegador: solicita verificación/contraseña, sin sesión de desarrollador operativa.
- El único dominio propio inventariado en el equipo Vercel corresponde al comercio heredado y tiene DNS administrado por un tercero. No se reutilizó para la marca M Commerce ni se modificó su DNS.

Por tanto, el circuito de correo Auth de prueba está verificado, pero el remitente comercial y las cuentas de prueba de Mercado Pago no se pueden dar por configurados. No se registraron cuentas, aceptaron contratos, compraron dominios ni reemplazaron credenciales. No hubo cambios de producción ni movimientos de dinero.
