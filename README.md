# Frontend

CRM de Con Buena Compañía con inicio de sesión administrativo, panel de resumen, clientes con búsqueda y ficha, y visitas a clientes con el formulario de siete etapas. Diseño mobile-first con el PNG original de marca.

## Probar localmente

Inicia el backend en el puerto 3001 y ejecuta `npm run dev` en esta carpeta. Abre `http://127.0.0.1:4173` o `http://localhost:4173`; la API usará el mismo nombre de host para conservar la sesión. El usuario inicial se crea desde el backend con `npm run admin:create`.

El administrador debe cambiar su contraseña inicial antes de acceder a los registros. No hay registro público de usuarios. Las sesiones usan cookies HttpOnly; las contraseñas y los tokens no se guardan en localStorage. Los borradores de visitas se guardan en sessionStorage por administrador y se limpian al cerrar sesión.

## Vercel

El frontend usa `/api` en producción. Configura **BACKEND_URL** en las variables de entorno del proyecto frontend de Vercel con la URL HTTPS del backend, por ejemplo `https://tu-backend.example.com`. `api/[...path].js` reenvía únicamente las rutas del CRM. No pongas contraseñas ni DATABASE_URL en el frontend. El backend debe incluir el dominio del frontend en **CRM_ALLOWED_ORIGINS** y ejecutarse con **NODE_ENV=production**. Así la cookie queda en el mismo sitio y funciona también en navegadores móviles que bloquean cookies de terceros.

La aplicación no contiene credenciales de demostración ni listas de clientes ficticios. Si falta la conexión al backend se muestra un mensaje y no se simula un ingreso.

## Verificación

`npm run check` revisa la sintaxis. `scripts/verify-crm.cjs` prueba el flujo visual con respuestas de API simuladas en 320, 375, 390, 768 y 1440 px; requiere instalar `playwright-core` en `.local/qa` y Chrome local. `scripts/verify-admin-login.cjs` comprueba el ingreso real contra un backend temporal en el puerto 3002 usando el archivo de acceso local del backend, sin cambiar la contraseña inicial ni imprimirla.

## Ubicación

La ubicación actual conserva `visitLatitude` y `visitLongitude` como campos separados y completa `visitLocation` con una dirección aproximada editable. Se consulta Photon únicamente al pulsar el botón; si falla, las coordenadas se conservan y la dirección puede ingresarse manualmente.

Se usa el servidor público de Photon para un volumen moderado de consultas, sin garantía de disponibilidad. Para mayor volumen, configura una instancia propia compatible con Photon mediante `window.CBC_GEOCODING_URL` antes de cargar `app.js`. La consulta envía únicamente las coordenadas; el aviso junto al botón informa al usuario y acredita los datos de OpenStreetMap.
