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
