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

## Evaluación breve · adaptador 1.3.0

Nuevas clases: ocho preguntas cerradas y una aplicación, con reparto 80/20. La valoración escrita continúa simulada por extensión y no valida aprendizaje. Las clases pendientes anteriores ofrecen conversión con copia de su entrega y nota; clases aprobadas conservadas.

## Notas privadas · adaptador 1.4.0

Mis notas guarda texto por clase y cuenta en este navegador, conserva revisión y detecta conflictos entre pestañas. Las notas no aparecen en vista previa. El frontend compartido incluye el botón «Enviar para evaluar».

## Proyectos y tareas · prototipo 0.1.0 · 23 Oct 2026

Disponible exclusivamente en demo.oplen.io, ruta `#/proyectos`. Proyectos, tareas, responsables del equipo ficticio, prioridades, fechas, estados, lista y tablero con arrastre. Cada tarea puede vincular una actividad de Operación y conservar subtareas, comentarios e historial. Las tareas se archivan y restauran.

El módulo usa `oplen-demo-projects-v1` en localStorage. Los datos no se sincronizan entre personas o dispositivos, no envían notificaciones y no conectan con ClickUp. Las vistas previas de colaboradores son de consulta. Restablecer demo elimina también este conjunto de prueba; no cambia los servicios reales.

`index.php` añade CSS/JS propios y `asset.php` aplica `demo/projects-bridge.php` al JavaScript compartido únicamente dentro de esta demo. La app de producción y la demo de oplenteams.io no se modifican. El adaptador verifica todos sus puntos de inserción antes de transformar la respuesta; ante un frontend incompatible, devuelve la fuente original y no añade la navegación del módulo. El ETag refleja los bytes transformados.

Pruebas: `node --check demo/projects.js`, `php tests/projects-bridge.php` y `node tests/projects.cjs` (jsdom 30.1.1; Node 22). Cubren guardado local, relaciones, filtros, tablero, subtareas, comentarios, archivo/restauración, conflictos entre pestañas, almacenamiento lleno, vista de consulta y texto no confiable.

Rollback: revertir el commit del prototipo y desplegar. La interfaz compartida original vuelve a servirse y la clave de proyectos queda intacta hasta que se restablezca la demo. No requiere migración de base de datos.

### Entrada pública y carpeta del despliegue

La instalación actual de Hostinger despliega este repo dentro de `/demo/`. El dominio conserva una portada anterior que carga `/demo/demo/backend.js`. El adaptador reconoce exclusivamente esa combinación en `demo.oplen.io` y redirige la portada `/` o `/index.php` a `/demo/`, conservando la consulta y la ruta de pantalla. La demo sigue en el mismo origen y conserva sus datos locales. Una instalación en raíz, otros dominios y la entrada canónica no se redirigen. El adaptador se sirve con revalidación de caché. Prueba: `node tests/entry-routing.cjs`.


## Proyectos conectados · prototipo 0.2.0 · 23 Oct 2026

El módulo combina la organización flexible de Command con el contexto de Oplen. Incluye una vista general de proyectos, resumen por proyecto/iniciativa, progreso acumulado sin duplicar tareas, lista y tablero, filtros por persona/departamento/prioridad/fecha, y navegación compacta con iniciativas y subproyectos opcionales. Un proyecto puede involucrar a varios departamentos; el departamento no es una carpeta obligatoria.

Cada tarea abre un panel lateral que consulta los colaboradores, puestos, actividades publicadas y documentos de Oplen. La responsabilidad operativa conserva su alcance, autoridad y escalamiento; la tarea conserva su entrega, fechas y estado. Los documentos publicados se leen dentro del contexto; contenido con bloques abre el lector existente en otra pestaña. Se respetan los permisos de Operación y Documentación y la visibilidad del documento. Las subtareas tienen responsable, estado y fecha propios y aparecen mediante su tarea principal en Mi trabajo cuando están pendientes y asignadas a la persona.

La jerarquía admite iniciativa → proyecto → subproyecto, y rechaza ciclos o niveles adicionales. El avance se calcula con tareas principales activas, no con subtareas; completar una tarea no cambia automáticamente las subtareas. Las solicitudes y automatizaciones quedan fuera de este bloque.

Se conserva la clave `oplen-demo-projects-v1`; el contenido tiene `version: 2`. Los datos de la versión anterior se adaptan en memoria y se escriben en v2 únicamente al guardar un cambio. No se sustituyen proyectos, tareas, comentarios ni fechas existentes, ni se agrupan automáticamente proyectos anteriores. Los ejemplos nuevos incluyen una iniciativa y un subproyecto. La versión 0.1.0 no lee el formato v2: un rollback debe conservar un lector compatible o retirar el módulo sin borrar la clave.

Pruebas adicionales: `node tests/projects-hybrid.cjs` con jsdom 30.1.1. Cubre creación y movimiento de la jerarquía, ciclos, agregado sin duplicados, contexto de Oplen, lectura segura de documentos y permisos, subtareas, filtros, consulta y migración de datos v1.

## Identificación del despliegue · Demo 1.6.0

El pie de página muestra primero la versión y fecha de publicación de esta demo (zona America/Mexico_City), junto con la versión del módulo Proyectos que realmente se cargó. La versión/fecha de la interfaz compartida se conserva dentro de «Versión de la interfaz base». Los metadatos del demo se mantienen en `demoBuild` de `demo/backend.js`; la versión de Proyectos proviene de `window.OplenProjects.version`. No se atribuye una actualización de la demo a la app compartida.

## Solicitudes y feedback · Proyectos 0.3.0 · Demo 1.7.0

Peticiones, errores y mejoras se registran dentro del proyecto o subproyecto, con solicitante, responsable de revisión, prioridad, fecha solicitada, actividad operativa, conversación e historial. Aparecen en el resumen y encima de las tareas de lista/tablero; el filtro «Mostrar» permite ver trabajo mixto, solo tareas o todas las solicitudes (incluidas aceptadas/cerradas). No se añade otro módulo ni una bandeja global separada.

Flujo: nueva → en revisión → aceptada y convertida en tarea, o cerrada sin tarea con motivo obligatorio. Una solicitud cerrada sin tarea se puede reabrir. La conversión requiere responsable activo y guarda solicitud/tarea en una sola escritura con control de revisión, evitando duplicados. La tarea conserva `sourceRequestId` y la solicitud conserva `taskId`; el contexto y la conversación original se consultan desde la tarea. Al completar o reabrir la tarea, el estado visible de la solicitud se actualiza de forma derivada. Archivar una tarea conserva el vínculo y muestra ese estado sin crear reemplazos.

El solicitante puede ajustar una petición pendiente; las decisiones corresponden en esta demo a Administración, responsable del proyecto/iniciativa o revisor asignado. La vista previa sigue siendo de consulta. Son controles de experiencia sobre datos ficticios locales, no sustituyen autorización en servidor ni colaboración multiusuario. No se envían mensajes, correos ni notificaciones externas.

El contenido guardado pasa a `version: 3` al siguiente cambio; se conserva la misma clave. Navegadores con v1/v2 mantienen todos sus proyectos, tareas y comentarios y comienzan con solicitudes vacías. Una demo nueva incluye tres ejemplos de solicitudes. La versión 0.2.0 rechaza v3 para evitar sobrescrituras desde pestañas antiguas; un rollback requiere lector compatible o retirar el módulo conservando la clave.

Prueba: `node tests/projects-requests.cjs` (jsdom 30.1.1). Cubre recepción, jerarquía, filtros, conversación, revisión, conversión atómica sin duplicados, origen, cierre/reapertura/archivo de tareas, motivo de rechazo, permisos, consulta, conflictos entre pestañas, fallos de almacenamiento y migración v2.

## Semáforo de proyectos · Demo 1.8.0 / Proyectos 0.4.0 · 26 Oct 2026

El resumen general, cada iniciativa, proyecto y subproyecto muestran un semáforo calculado y un acceso a sus motivos. Cada tarea se cuenta una sola vez al agrupar la jerarquía; una tarea puede tener varios motivos. El detalle abre la tarea implicada o el proyecto cuya fecha objetivo necesita revisión.

- **Requiere atención (rojo):** tarea o subtarea vencida, bloqueo con motivo, o fecha objetivo de proyecto/iniciativa vencida con tareas pendientes.
- **En riesgo (amarillo):** entrega de tarea/subtarea o fecha objetivo dentro de los próximos tres días de calendario, incluido hoy; responsable ausente o no disponible. Una subtarea sin asignación usa el responsable de su tarea.
- **En orden:** existen tareas pendientes y ninguna alerta de las anteriores.
- **Completado:** todas las tareas activas están completadas; **Sin evaluar:** no hay tareas activas. Los proyectos vacíos no se presentan como saludables.

Los cálculos usan el día local del navegador, se actualizan al guardar/cambiar estado/abrir Proyectos y no se escriben en localStorage. Las tareas completadas y archivadas, incluidas sus subtareas, quedan fuera de las alertas. Las solicitudes pendientes mantienen su propio seguimiento; al aceptarlas, su tarea participa en el cálculo como cualquier otra.

El formulario de tarea permite declarar un bloqueo con motivo obligatorio. No cambia la columna de ejecución. El motivo y su resolución quedan en el historial; desmarcar el bloqueo o completar la tarea lo resuelve. Al reabrirla no reaparece un bloqueo ya resuelto. Lista y tablero incluyen un filtro de Atención que pasa a Solo tareas y permite revisar alertas, riesgo, atención o bloqueos.

La clave `oplen-demo-projects-v1` y su formato v3 se conservan. `blockedReason` es opcional en los datos anteriores y solo se guarda al editar una tarea. Se mantienen solicitudes, conversaciones, asignaciones, permisos de consulta y controles contra conflictos entre pestañas y errores de guardado. Sigue siendo una demo local sin colaboración en servidor ni cambios en la app real.

Validación: `node tests/projects-health.cjs` cubre límites de fechas, cambio de mes, jerarquía, subtareas, fechas objetivo, exclusiones, ciclo de bloqueo/resolución, filtros lista/tablero, escape de contenido, consulta, conservación de datos y fallos de guardado. Se ejecuta junto a las suites existentes en GitHub Actions.
