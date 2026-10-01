# Oplen Demo — espejo de la app

El demo carga los mismos archivos JavaScript, CSS e iconos de `jpulidot/oplen-master`, fijados al commit `70aaa949cb038cf1a2b12d341d63c70118dab155`. No tiene un renderer ni un tema alternativo. `demo/frontend-source.json` registra el origen de los archivos.

## Hostinger

Subir `index.html`, `assets/` y `demo/` a la raíz de demo.oplen.io. El demo es estático y no requiere PHP, base de datos ni credenciales. El repositorio no configura un despliegue automático. La carpeta antigua `demo-assets/` ya no se utiliza.

## Datos y acciones

Horizonte es una empresa ficticia. `demo/backend.js` responde localmente a las solicitudes API del frontend. Las solicitudes API no salen al servidor. Los datos se guardan en localStorage con una clave propia del demo. Restablecer demo restaura la empresa de ejemplo. No se incluyen datos reales ni secretos.

El frontend es el de la app; los servicios son simulados. Las rutas, sesiones, evaluación de comprensión y prácticas usan contenido y reglas predefinidos, sin IA. Las ediciones de equipo, empresa, responsabilidades y documentos se guardan localmente. No se envían correos o reportes, ni se procesan pagos. Los archivos, comentarios y el envío de proyectos finales necesitan servicios de backend y muestran su limitación en el demo.

## Validación

Se verificaron las rutas principales en modo claro y oscuro, escritorio y móvil; navegación, pestañas, fichas y ausencia de tráfico API al servidor. Se probó crear una ruta, generar una sesión, comprobar comprensión, evaluar una práctica, editar empresa y mantener el estado local.

`tests/browser.cjs` permite repetir las comprobaciones con Playwright y Chromium, usando OPLEN_DEMO_URL y OPLEN_CHROMIUM. `tests/interactions.cjs` comprueba el recorrido de aprendizaje y edición. Sirve el proyecto con `python -m http.server 8878` antes de ejecutarlos.

## Actualizar el espejo

`node scripts/sync-frontend.mjs COMMIT` descarga los archivos del frontend desde un commit de oplen-master, actualiza el manifiesto y cambia las versiones de caché del HTML. Revisar el contrato del backend simulado y repetir las pruebas antes de subir el nuevo paquete. No modificar los archivos en assets directamente: los cambios visuales deben hacerse en la app y sincronizarse.

