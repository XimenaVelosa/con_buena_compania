# Frontend

CRM de Con Buena Compañía con inicio de sesión administrativo, panel de resumen, clientes con búsqueda y ficha, y visitas a clientes con el formulario de ocho etapas. Diseño mobile-first con el PNG original de marca.

## Probar localmente

Inicia el backend en el puerto 3001 y ejecuta `npm run dev` en esta carpeta. Abre `http://127.0.0.1:4173` o `http://localhost:4173`; la API usará el mismo nombre de host para conservar la sesión. El usuario inicial se crea desde el backend con `npm run admin:create`.

El administrador debe cambiar su contraseña inicial antes de acceder a los registros. No hay registro público de usuarios. Las sesiones usan cookies HttpOnly; las contraseñas y los tokens no se guardan en localStorage. Los borradores de visitas se guardan en sessionStorage por administrador y se limpian al cerrar sesión.

## Vercel

El frontend usa `/api` en producción. `vercel.json` dirige esas rutas a `api/proxy.js`, que reenvía únicamente los endpoints del CRM al backend verificado `https://con-buena-compania-backend.vercel.app`. **BACKEND_URL** es un override opcional para otro entorno. No pongas contraseñas ni DATABASE_URL en el frontend. El backend debe incluir el dominio del frontend en **CRM_ALLOWED_ORIGINS** y ejecutarse con **NODE_ENV=production**. Así la cookie queda en el mismo sitio y funciona también en navegadores móviles que bloquean cookies de terceros.

La aplicación no contiene credenciales de demostración ni listas de clientes ficticios. Si falta la conexión al backend se muestra un mensaje y no se simula un ingreso.

## Verificación

`npm run check` revisa la sintaxis. `scripts/verify-crm.cjs` prueba el flujo visual con respuestas de API simuladas en 320, 375, 390, 768 y 1440 px; requiere instalar `playwright-core` en `.local/qa` y Chrome local. `scripts/verify-admin-login.cjs` comprueba el ingreso real contra un backend temporal en el puerto 3002 usando el archivo de acceso local del backend, sin cambiar la contraseña inicial ni imprimirla. Para comprobar producción, define `CRM_FRONTEND_URL=https://con-buena-compania.vercel.app`; se usará el proxy publicado sin sobrescribir la URL de la API.

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
