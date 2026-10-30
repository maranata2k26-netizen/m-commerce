# Restricción de RPC internas — 27 de octubre de 2026

La revisión de staging identificó 28 funciones SECURITY DEFINER ejecutables por anon, 173 por authenticated y 33 tablas con RLS sin políticas. Estos avisos no equivalen por sí solos a explotación: los contratos públicos necesitan acceso anónimo y los contratos privados necesitan autorización dentro de la función.

Se restringieron siete RPC que ya exigían identidad o permisos administrativos: hardware_category_admin_summary, hardware_delete_category, hardware_move_category, platform_create_site_v178 y las tres RPC de administración de suscripciones push. Se revocó EXECUTE de PUBLIC y anon, manteniendo authenticated y service_role. Se preservan las verificaciones de comercio y administrador existentes.

Tres funciones de trigger —platform_order_growth_trigger, platform_prevent_master_membership y platform_prevent_member_promotion— dejan de ser invocables directamente por clientes. Sus triggers permanecen instalados; su ejecución por trigger no depende de conceder EXECUTE al cliente.

La migración 20261027155431 se creó con Supabase CLI y su SQL se aplicó únicamente en staging mediante transacción. El historial remoto aún debe reconciliarse antes del lanzamiento; no se ejecutó db push ni se modificó producción. La migración omite funciones ausentes para admitir instalaciones sin esos módulos.

Validación ejecutada en staging:

- Comprobación de privilegios de las diez funciones: anon denegado, authenticated conservado para las siete RPC y denegado para triggers, service_role conservado.
- Ejecución anónima real de dos RPC administrativas: insufficient_privilege. simple_public_plan sigue funcionando anónimamente.
- Suite supabase/tests/simple-security-staging.sql ejecutada íntegramente con rollback después del cambio: sin excepciones; aislamiento entre comerciantes y autorización conservados.
- Advisors posterior: avisos de ejecución anónima bajaron de 28 a 18 y autenticada de 173 a 170.
- Ensayo aislado actualizado para incluir todas las migraciones posteriores al baseline, incluida la del 27/10: 19 migraciones aprobadas, suite integral de 92 comprobaciones y suite de privilegios aprobadas. El selector anterior terminaba implícitamente el 19/10 y habría omitido esta migración; se corrigió. Esto sigue siendo ensayo de esquema, no restauración de datos productivos.

Las 33 tablas sin políticas mantienen RLS y denegación por defecto a clientes. 32 también carecen de SELECT directo; hardware_order_counters conserva SELECT concedido, pero RLS sin políticas impide visibilidad para los roles cliente. No se agregaron políticas permisivas para ocultar el aviso. Deben mantenerse los accesos mediante backend/RPC autorizadas.

Continúan pendientes la revisión individual completa de las otras funciones y la protección contra contraseñas filtradas. No se declara auditoría completa ni se cambia el plan de Supabase. Referencias: https://supabase.com/docs/guides/database/functions y https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable .

Rollback de permisos: revertir exclusivamente las ACL desde la captura previa, sin cambiar cuerpos ni triggers. La captura anterior concedía EXECUTE a PUBLIC, anon, authenticated y service_role en las diez funciones. Esta reversión ampliaría otra vez exposición y debe reservarse para una regresión demostrada; no se ejecutó.
