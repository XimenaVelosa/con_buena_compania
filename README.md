# Frontend

Landing editorial de Con Buena Compañía en la página principal y acceso al CRM en `/crm`. La landing presenta las ocho actividades, sus detalles y exclusiones, el proceso de acompañamiento y el contacto por correo para solicitar una cotización. El CRM conserva el inicio de sesión administrativo, el resumen, la consulta de clientes y el formulario de visitas de ocho etapas. Ambas páginas usan el PNG original de marca y diseño mobile-first.

## Probar localmente

Ejecuta `npm run dev` en esta carpeta y abre `http://127.0.0.1:4173` o `http://localhost:4173` para la landing. El CRM se encuentra en `/crm`, con alias `/crm/` y `/crm.html`. Para el CRM, inicia el backend en el puerto 3001; la API usa el mismo nombre de host para conservar la sesión. El usuario inicial se crea desde el backend con `npm run admin:create`.

La contraseña se administra únicamente desde el código del backend mediante `npm run admin:password -- admin`. El CRM no ofrece formulario ni botón para cambiarla, y el proxy bloquea la antigua ruta de cambio de contraseña. Las cuentas antiguas pendientes de actualización muestran que el administrador debe habilitar su acceso. No hay registro público de usuarios. Las sesiones usan cookies HttpOnly; las contraseñas y los tokens no se guardan en localStorage. Los borradores de visitas se guardan en sessionStorage por administrador y se limpian al cerrar sesión.

## Vercel

El frontend usa `/api` en producción. `vercel.json` dirige esas rutas a `api/proxy.js`, que reenvía únicamente los endpoints del CRM al backend verificado `https://con-buena-compania-backend.vercel.app`. **BACKEND_URL** es un override opcional para otro entorno. No pongas contraseñas ni DATABASE_URL en el frontend. El backend debe incluir el dominio del frontend en **CRM_ALLOWED_ORIGINS** y ejecutarse con **NODE_ENV=production**. Así la cookie queda en el mismo sitio y funciona también en navegadores móviles que bloquean cookies de terceros.

La aplicación no contiene credenciales de demostración ni listas de clientes ficticios. Si falta la conexión al backend se muestra un mensaje y no se simula un ingreso.

`vercel.json` dirige `/crm` a `crm.html`; los estilos y scripts del CRM usan rutas absolutas. Los enlaces anteriores de la página principal con `#home`, `#clients`, `#visits` o `#new-visit` llevan a la vista correspondiente en `/crm`. La landing carga sus propios estilos y scripts; los datos del CRM se consultan al acceder a su página y con la sesión correspondiente.

## Landing editorial

Los textos, fotografías, contacto y tarifa base provienen del HTML editorial proporcionado. Se conservaron las ocho actividades actuales y sus límites: acompañamiento no médico, transporte de terceros, acompañantes que no conducen y exclusión de oficios domésticos. Cada actividad tiene detalles accesibles en un diálogo con su descripción, video y lista «No incluye ni se permite».

Cada detalle reserva un espacio de video 16:9, responsive, con controles nativos y reproducción dentro de la página en móviles. Debajo se muestra únicamente la lista «No incluye ni se permite», sin los párrafos adicionales de condiciones y consideraciones. Los videos aún no se han proporcionado: se muestra «Disponible próximamente» hasta configurar una fuente real en `landing-videos.js`. Cada clave corresponde al `data-service` de su tarjeta y acepta un enlace directo HTTPS a MP4/WebM o un objeto como `{ src: '/videos/citas-medicas.mp4', poster: '/images/service-medical.jpg' }`. Para archivos locales, crea `videos/` y utiliza nombres sin espacios. Los enlaces a páginas de YouTube u otras plataformas requieren su integración específica y no son enlaces directos de video.

Los videos no se reproducen automáticamente ni se descargan al abrir la página. Al cerrar el detalle se detienen y se libera su fuente; cambiar de actividad carga únicamente el video correspondiente. Un fallo de carga muestra una opción para reintentar y conserva el acceso a la consulta por correo.

La cotización se prepara según las actividades y las horas solicitadas. Los botones de consulta preparan un correo para `gerencia@conbuenacompania.com`. El envío se completa desde la aplicación de correo del visitante. La landing no crea visitas ni consulta datos de clientes.

El logo original se reutiliza en cabecera y pie sin alterar el archivo. Las fotografías están en `images/`; la imagen principal se extrajo del HTML suministrado. La tipografía Nunito se sirve desde `fonts/` con su licencia OFL. El menú móvil, el carrusel y los diálogos admiten navegación por teclado y respetan la preferencia de movimiento reducido.

## Verificación

`npm run check` revisa la sintaxis. `scripts/verify-landing.cjs` verifica el logo, menú, detalles, espacio de video, carrusel, solicitud de acompañamiento, enlaces de correo, acceso al CRM y enlaces antiguos en 320, 375, 390, 768, 1024 y 1440 px. También reproduce un clip de prueba generado en memoria a 390 y 1440 px para comprobar los controles nativos, ausencia de reproducción automática, detención al cerrar, separación entre actividades y reintento tras un fallo; ese clip no se publica ni se guarda como contenido del sitio. `scripts/verify-crm.cjs` prueba el flujo completo del CRM en `/crm` con respuestas de API simuladas en 320, 375, 390, 768 y 1440 px. Las pruebas de navegador requieren instalar `playwright-core` en `.local/qa` y Chrome local. `scripts/verify-admin-login.cjs` comprueba el ingreso real contra un backend temporal en el puerto 3002 usando el archivo de acceso local vigente del backend, sin modificar ni imprimir la contraseña. Define `CRM_QA_ACCESS_FILE` con la ruta absoluta del archivo si se generó mediante `admin:password`. Para comprobar producción, define `CRM_FRONTEND_URL=https://con-buena-compania.vercel.app`; se usará `/crm` y el proxy publicado.

## Contactos de emergencia

El panel 8 permite seleccionar al acudiente del panel 4, agregar un contacto adicional o ambas opciones. Cada contacto incluye nombre, cédula, dirección y celular. Se serializan como una lista JSON en el campo de texto `emergencyContacts` existente; no se requiere una migración de base de datos. Los registros antiguos de texto libre siguen mostrándose en la ficha. Los borradores guardan también el estado de las opciones y conservan los campos del contacto adicional si se desmarca temporalmente.

## Autorización de datos personales

El paso 2 carga el aviso vigente desde `GET /clients/privacy-notice`. Antes de recoger la ubicación o información de la persona se solicita la autorización de datos personales y la declaración de veracidad. No se guardan borradores antes de esa decisión. La casilla de datos sensibles de salud es independiente y opcional; sin ella se puede completar el informe y se excluyen las respuestas de movilidad, medicamentos y cuidado personal tanto del borrador como del envío.

Ninguna casilla viene aceptada. Se identifica al titular o a quien esté legitimado para representarlo; en este último caso se registra el fundamento, sin considerar el parentesco una acreditación de representación. Una nueva visita limpia estas decisiones. Un borrador solo recupera las decisiones si coinciden la versión y el hash del aviso actual; si cambia, la persona debe revisar y aceptar nuevamente.

El aviso está publicado a nombre de Con Buena Compañía y se puede aceptar sin que exista una política enlazada. Explica expresamente que la política aún no está publicada y permite contactar al equipo por el canal usado para solicitar el servicio o durante la visita. No incluye correos, teléfonos ni enlaces inventados. El nombre o razón social del responsable, correo y teléfono reales se pueden completar mediante `CRM_PRIVACY_CONTROLLER`, `CRM_PRIVACY_EMAIL` y `CRM_PRIVACY_PHONE`; `CRM_PRIVACY_POLICY_URL` añadirá el enlace cuando se publique la política. Esa información pendiente no bloquea el formulario. El backend conserva si los datos de contacto estaban completos al registrar cada declaración. La ficha muestra la autorización de cada informe; los informes anteriores no se consideran autorizados por defecto. El aviso no reemplaza la política completa ni acredita por sí solo la identidad o representación del declarante.

## Actividades de interés y taxis

El paso 06 se llama «Actividades que le interesaría contratar». Carga las ocho opciones desde `GET /clients/activity-options`, con una descripción, exclusiones específicas y la prohibición común de conducir vehículos y realizar oficios domésticos. Las exclusiones permanecen visibles en cada tarjeta. La aplicación registra interés; la operación del servicio y la coordinación con el transportador se realizan por el equipo.

Cuando se selecciona alguna actividad, se indica cómo se resolverán los traslados: uno o varios taxis de confianza de la persona, autorización para buscar y coordinar un taxi prestado por un tercero, o actividad en casa / traslado ya resuelto por la persona. Se admiten hasta cinco contactos con nombre y teléfono, más empresa y placa opcionales. La segunda opción exige el nombre de quien autoriza y una casilla desmarcada inicialmente al final de la sección. El nombre se sugiere a partir de quien autorizó los datos personales y se puede editar.

`activities.js` envía `activitySelection`; el backend valida el catálogo y guarda su texto, actividades seleccionadas, exclusiones, contactos y autorización en `activityPreferences`. Los contactos de opciones inactivas permanecen en el borrador de sesión y no se envían a la API. Si cambia el catálogo, se solicita revisar de nuevo la selección y la autorización. Si falla una actualización, se conservan los datos del borrador. Una nueva visita y el cierre de sesión limpian estas decisiones. Las fichas antiguas conservan sus datos y se identifican como actividades del formulario anterior.

La prueba visual admite `CRM_ACTIVITY_FIXTURE` con una exportación JSON del catálogo real y `CRM_QA_WIDTHS` con anchos separados por comas. Cubre contactos múltiples, autorización, cambios de opción, restauración del borrador, fallas de conexión y actualización de condiciones.

## Ubicación actual

La ubicación actual conserva `visitLatitude` y `visitLongitude` como campos separados y completa `visitLocation` con una dirección aproximada editable. Se consulta Photon únicamente al pulsar el botón; si falla, las coordenadas se conservan y la dirección puede ingresarse manualmente.

Se usa el servidor público de Photon para un volumen moderado de consultas, sin garantía de disponibilidad. Para mayor volumen, configura una instancia propia compatible con Photon mediante `window.CBC_GEOCODING_URL` antes de cargar `app.js`. La consulta envía únicamente las coordenadas; el aviso junto al botón informa al usuario y acredita los datos de OpenStreetMap.
