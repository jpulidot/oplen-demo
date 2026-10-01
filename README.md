# Oplen Demo — interfaz compartida en vivo

El demo utiliza `frontend.php` y `assets/` de la instalación de Oplen en el mismo servidor. No copia el frontend: cada petición lee la versión desplegada de la app. No hay sincronización de repositorios ni tareas programadas necesarias.

La app conserva sus controles de sesión, empresa y acceso en `index.php`; la plantilla solo contiene presentación. El demo no carga `installation.php`, configuración de clientes ni base de datos. Su adaptador `demo/backend.js` usa datos ficticios en localStorage e intercepta las solicitudes API antes de cargar los scripts de la app. Los servicios externos continúan simulados o limitados.

## Instalación en Hostinger (una vez)

1. Desplegar `index.php` y `frontend.php` del repositorio `oplen-master` en la raíz de la app.
2. Subir `.htaccess`, `index.php`, `asset.php`, `shared-app.php` y `demo/backend.js` de este repositorio a la raíz de demo.oplen.io. Incluir el archivo oculto `.htaccess` y reemplazar el existente. No subir `tests/` ni `scripts/`.
3. Por defecto, la app se busca en `../app` respecto a la carpeta del demo. Si el demo está en `/home/u173390266/domains/oplen.io/public_html/demo`, encuentra la app en `/home/u173390266/domains/oplen.io/public_html/app`. Para otra distribución configurar la variable de entorno PHP `OPLEN_SHARED_APP_ROOT` con esa ruta absoluta.
4. Retirar el antiguo `index.html`. Las carpetas `assets/` y `demo-assets/` antiguas ya no se usan: las reglas de Apache sirven exclusivamente los assets de la app.

La app debe desplegarse primero. Sin la plantilla compartida, el demo devuelve 503, evitando mostrar una copia desactualizada. `index.php` no se almacena en caché, sus versiones reflejan el contenido real y los assets usan ETag y revalidación.

Después de esta instalación, un despliegue de frontend en app se refleja en demo en la siguiente carga. Un cambio de contrato API puede requerir actualizar el adaptador ficticio; compartir código no inventa respuestas de backend.

## Pruebas

Con la app en la carpeta hermana `app`, ejecutar `php -S 127.0.0.1:8878 -t . tests/router.php`. Ejecutar `node tests/browser.cjs`, `node tests/interactions.cjs` y `python3 tests/shared-source.py`. Playwright debe estar instalado; `OPLEN_CHROMIUM` permite especificar Chromium. El servidor integrado solo se usa para pruebas; Hostinger usa `.htaccess`.

El script antiguo `scripts/sync-frontend.mjs` y el manifiesto de la versión estática son históricos; la instalación compartida no los utiliza.
