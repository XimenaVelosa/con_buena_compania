# Frontend

CRM de Con Buena Compañía con inicio de sesión administrativo, panel de resumen, clientes con búsqueda y ficha, y visitas a clientes con el formulario de siete etapas. Diseño mobile-first con el PNG original de marca.

## Probar localmente

Inicia el backend en el puerto 3001 y ejecuta `npm run dev` en esta carpeta. Abre `http://127.0.0.1:4173` o `http://localhost:4173`; la API usará el mismo nombre de host para conservar la sesión. El usuario inicial se crea desde el backend con `npm run admin:create`.

El administrador debe cambiar su contraseña inicial antes de acceder a los registros. No hay registro público de usuarios. Las sesiones usan cookies HttpOnly; las contraseñas y los tokens no se guardan en localStorage. Los borradores de visitas se guardan en sessionStorage por administrador y se limpian al cerrar sesión.

## Vercel

El frontend usa `/api` en producción. `vercel.json` dirige esas rutas a `api/proxy.js`, que reenvía únicamente los endpoints del CRM al backend verificado `https://con-buena-compania-backend.vercel.app`. **BACKEND_URL** es un override opcional para otro entorno. No pongas contraseñas ni DATABASE_URL en el frontend. El backend debe incluir el dominio del frontend en **CRM_ALLOWED_ORIGINS** y ejecutarse con **NODE_ENV=production**. Así la cookie queda en el mismo sitio y funciona también en navegadores móviles que bloquean cookies de terceros.

La aplicación no contiene credenciales de demostración ni listas de clientes ficticios. Si falta la conexión al backend se muestra un mensaje y no se simula un ingreso.

## Verificación

`npm run check` revisa la sintaxis. `scripts/verify-crm.cjs` prueba el flujo visual con respuestas de API simuladas en 320, 375, 390, 768 y 1440 px; requiere instalar `playwright-core` en `.local/qa` y Chrome local. `scripts/verify-admin-login.cjs` comprueba el ingreso real contra un backend temporal en el puerto 3002 usando el archivo de acceso local del backend, sin cambiar la contraseña inicial ni imprimirla. Para comprobar producción, define `CRM_FRONTEND_URL=https://con-buena-compania.vercel.app`; se usará el proxy publicado sin sobrescribir la URL de la API.

## Contactos de emergencia

El panel 7 permite seleccionar al acudiente del panel 3, agregar un contacto adicional o ambas opciones. Cada contacto incluye nombre, cédula, dirección y celular. Se serializan como una lista JSON en el campo de texto `emergencyContacts` existente; no se requiere una migración de base de datos. Los registros antiguos de texto libre siguen mostrándose en la ficha. Los borradores guardan también el estado de las opciones y conservan los campos del contacto adicional si se desmarca temporalmente.

## Ubicación actual

La ubicación actual conserva `visitLatitude` y `visitLongitude` como campos separados y completa `visitLocation` con una dirección aproximada editable. Se consulta Photon únicamente al pulsar el botón; si falla, las coordenadas se conservan y la dirección puede ingresarse manualmente.

Se usa el servidor público de Photon para un volumen moderado de consultas, sin garantía de disponibilidad. Para mayor volumen, configura una instancia propia compatible con Photon mediante `window.CBC_GEOCODING_URL` antes de cargar `app.js`. La consulta envía únicamente las coordenadas; el aviso junto al botón informa al usuario y acredita los datos de OpenStreetMap.
