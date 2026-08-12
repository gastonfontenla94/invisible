# Invisible · Directorio del Audio Argentino

Sitio estático de [invisible.com.ar](https://www.invisible.com.ar).
Hecho con [Astro](https://astro.build). Se publica solo en Cloudflare Pages.

Los datos viven en Airtable (plan gratuito) y se traen al sitio exportando CSV.

---

## Cómo actualizar el sitio cuando cargás algo nuevo en Airtable

**1. Exportar desde Airtable.**
En cada tabla (Estudios, Ingenieros y Productores, Formación), abrí la vista con
todos los campos → menú de la vista → *Download CSV*.
Guardá los archivos en `OneDrive/Escritorio/Invisible/export/`, pisando los viejos.

**2. Bajar las imágenes nuevas.**
Click derecho en `OneDrive/Escritorio/Invisible/bajar-imagenes.ps1` →
*Ejecutar con PowerShell*. Las que ya estaban las saltea.

> Importante: las URLs de Airtable vencen a las pocas horas. Bajá los CSV y corré
> el script el mismo día.

**3. Regenerar y publicar.**
Desde esta carpeta, en la terminal, un solo comando:

```bash
npm run publicar
```

Eso relee los CSV, optimiza las imágenes, reconstruye el sitio y lo sube.
Cloudflare detecta el push y publica solo, en un par de minutos.

> Si algo falla, no publica nada y el sitio que está online queda intacto.

---

## Ver el sitio en tu compu antes de publicar

```bash
npm run datos    # solo si cambiaron los CSV
npm run dev
```

Y abrí http://localhost:4321

---

## Cómo está armado

```
scripts/importar-datos.mjs   Lee los CSV + mapa-imagenes.csv, arma src/data/*.json,
                             optimiza las fotos a .webp y las deja en public/img/
scripts/generar-redirects.mjs Manda las direcciones viejas de Softr a las nuevas
scripts/publicar.mjs         Lo que corre "npm run publicar"
src/pages/                   Una carpeta por sección; [slug].astro genera las fichas
src/lib/orden.js             Orden aleatorio que rota cada día
src/config.mjs               Identificador de Google Analytics
src/styles/global.css        Todo el diseño. Colores y tipografías arriba de todo
src/layouts/Base.astro       Cabecera, pie, SEO y metadatos sociales
.github/workflows/           La rotación diaria automática (ver abajo)
```

Las rutas de sección son las mismas que tenía el sitio en Softr
(`/estudios-de-grabacion/`, `/ingenierosyproductores/`, `/formacion/`, `/mapa/`)
para no perder lo que Google ya tenía indexado.

## Decisiones que conviene no romper

- **El orden de las listas es aleatorio y rota cada día.** No es un detalle
  técnico: es la garantía de que nadie compra posición. Está en `src/lib/orden.js`
  y se calcula en cada build. Como el sitio es estático, todas las noches a las
  00:10 GitHub lo reconstruye y lo publica solo para que la rotación ocurra:
  eso es `.github/workflows/publicar-diario.yml`. Por eso `npm run publicar`
  trae primero lo que hizo el robot; si publicás con `git push` a mano y te
  rechaza el envío, hacé `git pull` antes.
- **Las direcciones viejas del sitio en Softr redirigen a las nuevas**
  (`scripts/generar-redirects.mjs` arma `public/_redirects`). Google todavía
  tiene indexadas las de antes. No agregar ahí una regla comodín general:
  Cloudflare le da prioridad sobre las específicas y manda todo a la home.
- **Las imágenes se optimizan siempre.** Las originales de Airtable pesan hasta
  4 MB; sin esto el sitio se vuelve lento y el repositorio impracticable.
- **Los datos generados (`src/data/`, `public/img/`) van al repositorio.**
  Cloudflare no tiene acceso a tu OneDrive: si no están versionados, no hay sitio.
