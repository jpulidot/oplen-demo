# Oplen Demo — interfaz compartida en vivo

El demo utiliza `frontend.php` y `assets/` de la instalación de Oplen en el mismo servidor. No copia el frontend: cada petición lee la versión desplegada de la app. No hay sincronización de repositorios ni tareas programadas necesarias.

La app conserva sus controles de sesión, empresa y acceso en `index.php`; la plantilla solo contiene presentación. El demo no carga `installation.php`, configuración de clientes ni base de datos. Su adaptador `demo/backend.js` usa datos ficticios en localStorage e intercepta las solicitudes API antes de cargar los scripts de la app. Los servicios externos continúan simulados o limitados.

## Instalación en Hostinger (una vez)

1. Desplegar `index.php` y `frontend.php` del repositorio `oplen-master` en la raíz de la app.
2. Subir `.htaccess`, `index.php`, `asset.php`, `shared-app.php` y `demo/backend.js` de este repositorio a la raíz de demo.oplen.io. Incluir el archivo oculto `.htaccess` y reemplazar el existente. No subir `tests/` ni `scripts/`.
3. Por defecto, la app se busca en `../app` respecto a la carpeta del demo. Si el demo está en `/home/u173390266/domains/oplen.io/public_html/demo`, encuentra la app en `/home/u173390266/domains/oplen.io/public_html/app`. También se detecta automáticamente la estructura `domains/demo.oplen.io/public_html` con la app en `domains/oplen.io/public_html/app`. Para otra distribución configurar la variable de entorno PHP `OPLEN_SHARED_APP_ROOT` con esa ruta absoluta.
4. Retirar el antiguo `index.html`. Las carpetas `assets/` y `demo-assets/` antiguas ya no se usan: las reglas de Apache sirven exclusivamente los assets de la app.

La app debe desplegarse primero. Sin la plantilla compartida, el demo devuelve 503, evitando mostrar una copia desactualizada. `index.php` no se almacena en caché, sus versiones reflejan el contenido real y los assets usan ETag y revalidación.

Después de esta instalación, un despliegue de frontend en app se refleja en demo en la siguiente carga. Un cambio de contrato API puede requerir actualizar el adaptador ficticio; compartir código no inventa respuestas de backend.

## Pruebas

Con la app en la carpeta hermana `app`, ejecutar `php -S 127.0.0.1:8878 -t . tests/router.php`. Ejecutar `node tests/browser.cjs`, `node tests/interactions.cjs` y `python3 tests/shared-source.py`. Playwright debe estar instalado; `OPLEN_CHROMIUM` permite especificar Chromium. El servidor integrado solo se usa para pruebas; Hostinger usa `.htaccess`.

El script antiguo `scripts/sync-frontend.mjs` y el manifiesto de la versión estática son históricos; la instalación compartida no los utiliza.


## Empresa ficticia ampliada · datos v1.1.0

Horizonte contiene 100 colaboradores activos en 10 departamentos (10 personas por área): Dirección, Operaciones, Marketing, Soporte, Ventas, Finanzas, People & Culture, Producto, Tecnología y Customer Success. Incluye 40 puestos, 30 responsabilidades con guías relacionadas, 10 rutas de desarrollo y 61 evaluaciones de ejemplo (incluida la propia cuenta de demo). Las evaluaciones usan el formato de competencias anterior; el dashboard calcula cobertura real de estos ejemplos y no inventa promedios del nuevo formato de desempeño.

El frontend sigue leyendo la plantilla compartida de app. Solo cambian los datos ficticios y su adaptador. Para publicar esta actualización desplegar `demo/backend.js` del repositorio en el demo; no necesita migraciones ni cambios a las empresas reales.

La nueva empresa usa `oplen-mirror-scale-v2` en localStorage. La clave anterior se conserva intacta, y los visitantes reciben la nueva empresa al recargar después del despliegue. Las ediciones hechas dentro de esta versión se conservan; Restablecer demo vuelve a generar los 100 colaboradores. El pie muestra la versión y fecha del conjunto de datos además de la versión de la app compartida.

Ejecutar `node tests/scale.cjs` para validar cantidades, jerarquía sin ciclos, referencias a documentos y responsables, filtros y cobertura de evaluaciones, y aislamiento del estado local.

## Importación de equipo · adaptador v1.1.1 · 01 Oct 2026 · 17:50 CDMX

La pantalla compartida de App V1.49.7 permite descargar la plantilla, validar un CSV y simular altas en el navegador. Valida estructura, correos repetidos, permisos y ciclos de responsables. La vista previa no modifica datos; las altas se guardan localmente y los accesos ficticios solo se devuelven en la respuesta, sin almacenarse. No se envían correos. Para usar este flujo desplegar el frontend de App y este adaptador.

## Invitaciones · adaptador v1.1.2 · 01 Oct 2026 · 18:12 CDMX

Las altas individuales y CSV pueden quedar pendientes de activar sin generar contraseñas compartidas. El diálogo compartido permite simular el envío; el adaptador responde `simulated: true` y conserva la cuenta pendiente. No sale correo ni se genera un enlace real. Los estados y el límite de reenvío se guardan localmente. Las cuentas existentes conservan sus datos. Desplegar App V1.49.8 y este adaptador.

## Adaptador 1.1.3 · 02 Oct 2026 · 00:16 CDMX

Dashboard, DNC y capacitaciones externas de App V1.50.0. Agrega ocho diagnósticos y tres cursos ficticios al abrir el módulo, sin sustituir personas, evaluaciones ni datos locales existentes. Nuevos ejemplos de evaluación incluyen brechas; las evaluaciones previamente guardadas se conservan. ROI distingue costos y retorno estimados de evidencia validada, con seguimientos acumulados de 30/60/90 días. Correr `node tests/training.cjs`.

## Adaptador 1.1.4 · 02 Oct 2026 · 13:30 CDMX

Migración única para navegadores que guardaron una lista vacía de evaluaciones en una versión anterior. Recupera ejemplos para personas activas cuyo departamento y puesto siguen coincidiendo; conserva nombres editados, empresa, comentarios y todos los demás datos locales. Una lista con evaluaciones existentes se conserva completa. No requiere restablecer el demo.

## Adaptador 1.1.5
- Fichas del colaborador con evaluaciones publicadas, brechas y DNC/capacitaciones vinculadas exclusivamente a esa persona.
- Mismos límites de consulta para responsables, vista previa y rutas personales.
- Las rutas nuevas guardan su propietario; rutas antiguas sin propietario se conservan y no se atribuyen a otra persona.


## Career Path por casos · adaptador 1.2.0

Nuevas sesiones usan el caso ficticio de una solicitud incompleta, cuatro preguntas de comprensión y tres apartados de aplicación. Preguntas: 60 puntos; aplicación: 40 puntos. La aplicación se simula mediante extensión del texto (20 caracteres = parcial; 60 = cumplido), y no valida comprensión ni llama a IA. El resultado lo identifica expresamente como simulación.

Las sesiones anteriores y los cambios locales se conservan. App V1.52.0 comparte estilos, recorrido y resultados con el demo; desplegar primero oplen-master y después demo/backend.js. No requiere reiniciar datos ficticios.
