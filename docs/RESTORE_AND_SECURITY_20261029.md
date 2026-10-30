# Restauración y revisión de acceso — 29 de octubre

## Restauración completada en un entorno aislado

Se preparó Ubuntu Minimal 24.04 en QEMU portable, con hashes de descargas verificados, sin instalar servicios ni reiniciar Windows. Dentro se ejecutó la imagen oficial supabase/postgres:17.6.1.136, compatible con PostgreSQL 17.6 del origen. El contenedor de la base tuvo network=none y cron.launch_active_jobs=off; no se conectó a producción ni emitió webhooks, correos o pagos.

Se restauraron roles y dump completos preservando propietarios/ACL. El rol inicial supabase_admin reproduce el contexto de administración requerido por los grants exportados. Se omitió únicamente su CREATE duplicado en el script derivado de roles; el archivo original quedó intacto.

Vault necesitó precargar pgsodium y supabase_vault. El cifrado del dump no es portable entre claves raíz de servidores diferentes. Se guardó un suplemento privado y se volvió a cifrar el secreto en el servidor aislado, preservando su UUID, nombre y descripción; una aserción comparó el hash del contenido descifrado. No se publica ese suplemento ni ningún secreto. El dump original permanece intacto.

Resultado: pg_restore completó sin errores; 148 tablas y 83.885 filas coinciden con los conteos derivados del propio archivo, sin diferencias. pg_amcheck --heapallindexed terminó correctamente. El contenedor y la VM quedaron detenidos. La máquina virtual con datos tiene ACL de usuario protegida.

Además del respaldo privado en C:, se creó una segunda copia en D:, disco físico 1 distinto del disco 0 del origen local. El archivo 7z pasó integridad y el dump extraído en memoria coincide por SHA256 con el original. Es redundancia local en la misma PC; no es una copia externa u offsite. Las claves/configuraciones externas de servicios gestionados no se incluyen automáticamente en el dump.

## Acceso de clientes reales a RPC

Se ejecutaron 35 solicitudes HTTP con JWT del comerciante QA A intentando operar QA B: 15 de ferretería, 8 de carnicería, 11 de canchas y el control de recepción de pedidos. Todas negaron acceso o devolvieron null sin datos según contrato. Cada grupo tuvo un control positivo con el propietario QA B y el rubro correspondiente. Se revirtió el rubro temporal al finalizar. Los resultados sanitizados quedan en los artefactos security-http-*-20261029.json.

Esto corrige una limitación del ensayo SQL: SET ROLE no cambia session_user, y el guard de carnicería permite tareas de administración desde postgres/supabase_admin. Las pruebas HTTP usan PostgREST con usuarios reales ficticios y no heredan ese bypass de mantenimiento. Los controles de ferretería ahora usan un objetivo realmente configurado como hardware, no solo un comercio de otro rubro.

Se inspeccionaron los guards compartidos de ferretería, carnicería y canchas, las funciones ligadas a sitio con controles directos/indirectos y los contratos públicos sensibles de tracking, confirmación de peso, carrito y feedback. Las 18 RPC públicas son escaparates u operaciones de cliente con alcance público/token; sus avisos no se eliminan revocando contratos necesarios. Los datos de carrito no determinan el importe de checkout; este se recalcula en servidor.

Se restringió simple_order_category_guard a ejecución interna/service_role porque es un trigger, no una RPC. Las pruebas de privilegios lo incluyen y las suites integrales comprueban que los triggers sigan operando. Las 33 tablas RLS sin políticas conservan denegación por defecto. No se concedió acceso para silenciar el asesor. La protección integrada contra contraseñas filtradas sigue deshabilitada y debe constar como limitación de configuración, no como función validada.

Esta revisión y sus pruebas no son una garantía de ausencia de vulnerabilidades en todos los módulos históricos. La publicación y configuración productivas requieren su etapa de aprobación separada; esta verificación no las ejecuta.
