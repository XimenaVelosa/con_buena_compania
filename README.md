# Frontend

La ubicación actual conserva `visitLatitude` y `visitLongitude` como campos separados y completa `visitLocation` con una dirección aproximada editable. Se consulta Photon únicamente al pulsar el botón; si falla, las coordenadas se conservan y la dirección puede ingresarse manualmente.

Se usa el servidor público de Photon para un volumen moderado de consultas, sin garantía de disponibilidad. Para mayor volumen, configura una instancia propia compatible con Photon mediante `window.CBC_GEOCODING_URL` antes de cargar `app.js`. La consulta envía únicamente las coordenadas; el aviso junto al botón informa al usuario y acredita los datos de OpenStreetMap.

Panel interactivo para el registro inicial de clientes.

Para probarlo localmente, sirve esta carpeta con cualquier servidor estático y asegúrate de tener el backend en `http://localhost:3001`.

Si el backend usa otra URL, define antes de cargar `app.js`:

```html
<script>window.CBC_API_URL = 'https://tu-api.example.com';</script>
```
