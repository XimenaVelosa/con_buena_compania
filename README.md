# A tu ritmo — Landing Page

Web estática lista para abrir en Visual Studio Code y publicar con GitHub Pages.

## Archivos

- `index.html` — página principal
- `styles.css` — diseño responsive
- `script.js` — carrusel, menú móvil y formulario
- `assets/` — logo e imágenes

## Abrir localmente

Puedes abrir `index.html` directamente en el navegador.

Para trabajar mejor en VS Code:

1. Abre esta carpeta con Visual Studio Code.
2. Instala la extensión **Live Server**.
3. Haz clic derecho sobre `index.html`.
4. Selecciona **Open with Live Server**.

## Publicar gratis con GitHub Pages

1. Crea un repositorio nuevo en GitHub, por ejemplo:
   `a-tu-ritmo-web`

2. Sube todo el contenido de esta carpeta al repositorio.

3. En GitHub abre:
   **Settings → Pages**

4. En **Build and deployment** selecciona:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`

5. Haz clic en **Save**.

Después de unos minutos GitHub te dará una URL parecida a:

`https://TU-USUARIO.github.io/a-tu-ritmo-web/`

## Cambiar datos de contacto

Busca en `index.html` y `script.js`:

- `+57 300 123 4567`
- `hola@aturitmo.com`
- `@aturitmo.co`

y reemplázalos por los reales.

## Formulario

Por ahora el botón **Enviar** abre WhatsApp con los datos escritos por el usuario.
Esto funciona sin servidor ni base de datos, ideal para un MVP temporal.
