# Oplen Demo

Demo interactivo para mostrar cómo Oplen conecta estructura organizacional, responsabilidades, conocimiento y desarrollo. Usa una empresa ficticia: Horizonte.

## Abrir

Abre `index.html` en un navegador moderno, o sirve la raíz del repositorio con `python3 -m http.server 8080` y entra a `http://localhost:8080`.

Para Hostinger, sube `index.html` y `demo-assets/` a la raíz del subdominio del demo. No requiere PHP, MySQL ni claves de IA. Este repositorio no activa despliegues automáticos.

## Recorrido

1. Equipo: personas, departamentos, puestos y mapa de empresa.
2. Responsabilidades: responsable, alcance, decisiones y escalamiento. Dirección y Manager pueden cambiar la asignación.
3. Documentación: buscar, leer, crear y editar procedimientos.
4. Career Path: tres sesiones de ejemplo con lectura y comprobación de comprensión.
5. Evaluaciones: completar tres casos, consultar resultado e historial.

Cambia la perspectiva en el encabezado. Dirección puede agregar personas; Dirección y Manager pueden editar documentos. El selector simula una experiencia de usuario; no implementa autorización ni aislamiento de datos.

Los cambios se guardan en localStorage y solo son visibles en ese navegador. Restablecer demo elimina los cambios locales. Los reportes de error se guardan localmente y no se envían a Oplen. Las evaluaciones usan reglas fijas, no IA. No hay gestor de tareas.

## Base y alcance

El ZIP `_public_html (1).zip` aportado por Julio se revisó como referencia: contiene un sitio personal y la aplicación original en `os/`, con frontend JavaScript y API PHP/MySQL. El demo conserva el alcance y recorrido de sus módulos, pero es una implementación de presentación independiente. No reemplaza ni despliega la aplicación de producción. No incluye datos reales, configuración privada, claves ni el sitio personal del ZIP.

## Verificación

- `node --check demo-assets/demo.js`
- `node demo-tests/smoke.cjs`

El smoke test comprueba rutas, mapa, variantes de perspectiva, edición y escape de documentos, puntuación de sesiones/evaluaciones y persistencia con un DOM simulado. La revisión visual en navegador real queda pendiente; el entorno de ejecución no dispone de Chromium.
