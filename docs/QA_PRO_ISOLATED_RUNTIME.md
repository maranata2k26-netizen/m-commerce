# Runtime PRO aislado para verificación

La ruta /qa-pro/:path* carga únicamente una instantánea de código público del runtime histórico. El guard del bootstrap rechaza cualquier hostname distinto de m-commerce-staging.vercel.app antes de consultar el backend. El bootstrap histórico continúa bloqueando PRO en staging; no se modifica ese comportamiento para los usuarios normales.

La función qa-pro-runtime existe exclusivamente en el proyecto jcgvunffeskkbgsbomgy y devuelve STAGING_ONLY en cualquier otro proyecto. Su cuerpo valida la clave API pública de staging y el origen cuando está presente. verify_jwt=false es necesario para cargar scripts/estilos públicos; no entrega datos de comercios ni secretos. Solo permite once archivos conocidos y recursos de marca/manifiesto QA. Comprueba SHA256 y rechaza referencias al backend productivo antes de servir contenido. No admite rutas arbitrarias.

Se copiaron diez fuentes públicas de la versión 182 del runtime, sustituyendo proyecto/clave pública, origen oficial y rutas de navegación para mantenerlas en staging. Se verificaron los hashes de todas las filas. No se copiaron datos de comercios reales a staging. Las filas de platform_runtime_files están marcadas qa-pro-snapshot:20261029; las tablas conservan RLS y acceso de servidor.

Se añadió después seguimiento.html para completar el recorrido posterior a la compra. Las rutas de seguimiento del snapshot se mantienen bajo /qa-pro. La prueba detectó además la ausencia de /seguimiento en la configuración Vercel; se agrega su mapeo al bootstrap histórico y a seguimiento.html. El guard existente sigue sin cargar ese runtime productivo en staging normal.

La política CSP de /qa-pro permite el JavaScript inline requerido por las páginas históricas únicamente en esta ruta de QA, conecta a staging y bloquea service workers. Las políticas de Simple permanecen intactas. La ruta no debe usarse como entrega comercial ni como sustituto del proceso de publicación productivo.

El comercio QA B se preparó temporalmente como fixture PRO, con plan trial sintético, retiro y efectivo, producto explícitamente ficticio y stock 10. Esa configuración no representa una suscripción cobrada ni una activación comercial genuina. Se guarda el estado previo privado para restaurarlo al terminar. El comprador, los pedidos y las interacciones deben identificarse como QA y no entregar. Mercado Pago permanece deshabilitado en ese fixture.

El panel exigió la primera activación porque staging no tenía términos PRO activos. Para probar el escenario de un comercio ya configurado se creó una versión de términos expresamente sintética, sin efecto contractual, y un registro de fixture marcado QA_SYNTHETIC_ALREADY_ONBOARDED_FIXTURE_NOT_LEGAL_ACCEPTANCE. No se cambió ninguna contraseña ni se aceptó un contrato real. Esa preparación no demuestra el recorrido inicial de invitación/cambio de contraseña de un propietario nuevo.

El primer pedido desde el navegador fue #70, total ARS 246,90 por dos unidades de ARS 123,45, efectivo y retiro. La base confirmó status=new, payment_status=unpaid y stock de 10 a 8. Se detectó que el panel PRO redondeaba ARS 123,45 a ARS 123. La migración 20261029185257_pro_currency_fraction_digits.sql, generada con CLI, cambia solo el formateador monetario del runtime y actualiza su hash. No cambia precios, pedidos ni otros formatos numéricos. Es idempotente y se detiene si el formato fuente cambió; las pruebas ejecutan el SQL y el formateador corregido.

Las pruebas de qa-pro-runtime cubren bloqueo fuera de staging, clave pública, origen, integridad, referencia productiva, rutas arbitrarias, preflight y guard de producción. Los resultados del recorrido de navegador se registran después de desplegar esta ruta solo en staging.
