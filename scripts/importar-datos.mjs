/**
 * Invisible — importador de datos
 *
 * Lee los CSV exportados de Airtable + el mapa de imágenes,
 * y genera:
 *   src/data/*.json      (datos limpios del sitio)
 *   public/img/...       (imágenes con nombres estables)
 *
 * Se corre solo antes de cada dev/build (ver package.json).
 * Para actualizar el sitio: exportás de nuevo desde Airtable y volvés a buildear.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');
const EXPORT = 'C:/Users/Gasto/OneDrive/Escritorio/Invisible/export';
const DATA = path.join(RAIZ, 'src', 'data');
const IMG = path.join(RAIZ, 'public', 'img');

// ---------------------------------------------------------------- utilidades

/** Parser de CSV que respeta comillas, comas y saltos de línea internos. */
function parseCSV(texto) {
  const filas = [];
  let fila = [];
  let campo = '';
  let enComillas = false;

  // saca BOM si viene
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];

    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"') {
      enComillas = true;
    } else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\r') {
      // ignorar
    } else if (c === '\n') {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else {
      campo += c;
    }
  }

  if (campo !== '' || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  if (filas.length === 0) return [];

  const cabecera = filas[0].map((h) => h.trim());
  return filas
    .slice(1)
    .filter((f) => f.some((v) => v.trim() !== ''))
    .map((f) => {
      const obj = {};
      cabecera.forEach((h, i) => {
        obj[h] = (f[i] ?? '').trim();
      });
      return obj;
    });
}

function leerCSV(nombre) {
  const ruta = path.join(EXPORT, nombre);
  if (!fs.existsSync(ruta)) {
    console.error(`  ! No encuentro ${nombre}`);
    return [];
  }
  return parseCSV(fs.readFileSync(ruta, 'utf8'));
}

/** "Control,Grabación en Vivo" -> ["Control", "Grabación en Vivo"] */
function lista(valor) {
  if (!valor) return [];
  return valor
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function slugificar(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Normaliza una URL suelta: agrega https:// si falta, limpia espacios. */
function url(valor) {
  if (!valor) return '';
  const v = valor.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return 'https://' + v.replace(/^\/+/, '');
}

/** De una URL de Instagram saca el @handle para mostrar. */
function handleInstagram(u) {
  if (!u) return '';
  const m = u.match(/instagram\.com\/([^/?#]+)/i);
  if (m) return '@' + m[1];
  if (u.startsWith('@')) return u;
  return '';
}

function numero(valor) {
  const n = parseFloat(String(valor).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// ------------------------------------------------------------------ imágenes

const mapaImagenes = leerCSV('mapa-imagenes.csv');

/**
 * Busca la imagen descargada para un registro+campo, la optimiza y la deja
 * en public/img como .webp.
 *
 * Las fotos de Airtable pesan hasta 4 MB y se muestran a 300-600 px: se
 * redimensionan y comprimen. Devuelve la ruta enseguida (es determinista) y
 * encola el trabajo pesado, que se resuelve al final del script.
 */
const tareasImagen = [];

function imagen(tablaMapa, registro, campo, carpetaDestino, slug, sufijo = '', ancho = 1400) {
  const fila = mapaImagenes.find(
    (m) =>
      m.Tabla === tablaMapa &&
      m.Registro === registro &&
      m.Campo === campo
  );
  if (!fila) return '';

  const origen = path.join(EXPORT, fila.Archivo.replace(/\//g, path.sep));
  if (!fs.existsSync(origen)) return '';

  const nombre = `${slug}${sufijo}.webp`;
  const destinoDir = path.join(IMG, carpetaDestino);
  const destino = path.join(destinoDir, nombre);

  tareasImagen.push(async () => {
    fs.mkdirSync(destinoDir, { recursive: true });
    try {
      await sharp(origen)
        .rotate()
        .resize({ width: ancho, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(destino);
    } catch (e) {
      console.log(`  ! No pude optimizar ${nombre}: ${e.message}`);
      fs.copyFileSync(origen, destino);
    }
  });

  return `/img/${carpetaDestino}/${nombre}`;
}

// -------------------------------------------------------------------- limpiar

fs.rmSync(DATA, { recursive: true, force: true });
fs.mkdirSync(DATA, { recursive: true });

// solo se limpian las carpetas que genera este script;
// public/img/marca (logo, tarjeta social) se mantiene a mano y no se toca
for (const sub of ['estudios', 'ingenieros', 'formacion']) {
  fs.rmSync(path.join(IMG, sub), { recursive: true, force: true });
}
fs.mkdirSync(IMG, { recursive: true });

console.log('\nInvisible — importando datos\n');

// -------------------------------------------------------------------- ESTUDIOS

const estudiosRaw = leerCSV('Estudios de Grabación-Grid view.csv');
const TABLA_ESTUDIOS = 'estudios-de-grabaci-n-grid-view';

const estudios = estudiosRaw
  .filter((r) => r['Estado'] === 'Publicado')
  .map((r) => {
    const nombre = r['Nombre del Estudio'];
    const slug = r['SEO:Slug'] || slugificar(nombre);
    return {
      tipo: 'estudio',
      nombre,
      slug,
      descripcion: r['Descripción'],
      anio: r['Año de fundación'],
      direccion: r['Dirección'],
      barrio: r['Barrio'],
      ciudad: r['Ciudad'],
      provincia: r['Provincia'],
      lat: numero(r['Latitud']),
      lng: numero(r['Longitud']),
      telefono: r['Teléfono / WhatsApp'],
      email: r['Email'],
      web: url(r['Sitio Web']),
      instagram: url(r['Instagram']),
      instagramHandle: handleInstagram(r['Instagram']),
      tipoSala: lista(r['Tipo de Sala']),
      consola: r['Consola Principal'],
      daw: r['DAW Principal'],
      equipamiento: r['Equipamiento Destacado'],
      generos: lista(r['Géneros Principales']),
      ingenieros: lista(r['Ingenieros y Productores']),
      logo: imagen(TABLA_ESTUDIOS, nombre, 'Logo', 'estudios', slug, '-logo', 700),
      foto: imagen(TABLA_ESTUDIOS, nombre, 'Fotos', 'estudios', slug, '-foto', 1400),
      seoTitle: r['SEO:Title'],
      seoDescription: r['SEO:Description'],
    };
  });

// ------------------------------------------------------------------ INGENIEROS

const ingenierosRaw = leerCSV('Ingenieros y Productores-Grid view.csv');
const TABLA_ING = 'ingenieros-y-productores-grid-view';

const ingenieros = ingenierosRaw
  .filter((r) => r['Estado'] === 'Publicado')
  .map((r) => {
    const nombre = r['Nombre Completo'];
    const slug = r['SEO:Slug'] || slugificar(nombre);
    return {
      tipo: 'ingeniero',
      nombre,
      slug,
      bio: r['Bio'],
      ciudad: r['Ciudad'],
      especialidad: lista(r['Especialidad']),
      estudios: lista(r['Estudios Asociados']),
      web: url(r['Sitio Web']),
      instagram: url(r['Instagram']),
      instagramHandle: handleInstagram(r['Instagram']),
      email: r['Email'],
      foto: imagen(TABLA_ING, nombre, 'Foto', 'ingenieros', slug, '', 1000),
      seoTitle: r['SEO:Title'],
      seoDescription: r['SEO:Description'],
    };
  });

// ------------------------------------------------------------------- FORMACIÓN

const formacionRaw = leerCSV('Formación-Grid view.csv');
const TABLA_FOR = 'formaci-n-grid-view';

const formacion = formacionRaw
  .filter((r) => r['Estado'] === 'Publicado')
  .map((r) => {
    const nombre = r['Nombre'];
    const slug = r['SEO:Slug'] || slugificar(nombre);
    return {
      tipo: 'formacion',
      nombre,
      slug,
      descripcion: r['Descripción'],
      tipoInstitucion: r['Tipo de institución'],
      tiposFormacion: lista(r['Tipos de Formación']),
      impartidoPor: lista(r['Impartido por']),
      especialidad: lista(r['Especialidad']),
      modalidad: r['Modalidad'],
      ubicacion: r['Ubicación'],
      web: url(r['Sitio Web']),
      instagram: url(r['Instagram']),
      instagramHandle: handleInstagram(r['Instagram']),
      estudio: r['Estudio'],
      certificado: /checked|true|sí|si/i.test(r['Certificado Ofrecido'] || ''),
      logo: imagen(TABLA_FOR, nombre, 'Logo', 'formacion', slug, '-logo', 700),
      seoTitle: r['SEO:Title'],
      seoDescription: r['SEO:Description'],
    };
  });

// ------------------------------------------------- vinculación bidireccional

// Los CSV traen los vínculos por NOMBRE. Los resolvemos a slugs para poder
// linkear en ambas direcciones, y completamos la relación que falte de un lado.

const porNombreEstudio = new Map(estudios.map((e) => [e.nombre, e]));
const porNombreIngeniero = new Map(ingenieros.map((i) => [i.nombre, i]));

for (const ing of ingenieros) {
  ing.estudiosVinculados = ing.estudios
    .map((n) => porNombreEstudio.get(n))
    .filter(Boolean)
    .map((e) => ({ nombre: e.nombre, slug: e.slug }));
}

for (const est of estudios) {
  const desdeEstudio = est.ingenieros
    .map((n) => porNombreIngeniero.get(n))
    .filter(Boolean);

  // los que se declararon del lado del ingeniero
  const desdeIngeniero = ingenieros.filter((i) =>
    i.estudios.includes(est.nombre)
  );

  const unidos = new Map();
  for (const i of [...desdeEstudio, ...desdeIngeniero]) {
    unidos.set(i.slug, { nombre: i.nombre, slug: i.slug });
  }
  est.ingenierosVinculados = [...unidos.values()];
}

// ------------------------------------------------------------------- escribir

const escribir = (nombre, datos) => {
  fs.writeFileSync(
    path.join(DATA, nombre + '.json'),
    JSON.stringify(datos, null, 2),
    'utf8'
  );
};

escribir('estudios', estudios);
escribir('ingenieros', ingenieros);
escribir('formacion', formacion);

// ------------------------------------------------------- optimizar imágenes

console.log(`  Optimizando ${tareasImagen.length} imágenes…`);

// de a 6 por vez, para no saturar la máquina
for (let i = 0; i < tareasImagen.length; i += 6) {
  await Promise.all(tareasImagen.slice(i, i + 6).map((t) => t()));
}

const pesoFinal = (dir) => {
  let total = 0;
  const recorrer = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) recorrer(p);
      else total += fs.statSync(p).size;
    }
  };
  recorrer(dir);
  return total;
};

console.log(`  Peso total de imágenes: ${(pesoFinal(IMG) / 1024 / 1024).toFixed(1)} MB\n`);

// ------------------------------------------------------------------- reporte

const sinFoto = (arr, campo) => arr.filter((x) => !x[campo]).length;
const conCoords = estudios.filter((e) => e.lat && e.lng).length;
const vinculos = estudios.reduce((n, e) => n + e.ingenierosVinculados.length, 0);

console.log(`  Estudios    ${String(estudios.length).padStart(3)}   sin foto: ${sinFoto(estudios, 'foto')}   sin logo: ${sinFoto(estudios, 'logo')}   con mapa: ${conCoords}`);
console.log(`  Ingenieros  ${String(ingenieros.length).padStart(3)}   sin foto: ${sinFoto(ingenieros, 'foto')}`);
console.log(`  Formación   ${String(formacion.length).padStart(3)}   sin logo: ${sinFoto(formacion, 'logo')}`);
console.log(`  Vínculos estudio↔ingeniero: ${vinculos}`);
console.log('');

const sinCoords = estudios.filter((e) => !e.lat || !e.lng);
if (sinCoords.length) {
  console.log('  Estudios sin coordenadas (no salen en el mapa):');
  sinCoords.forEach((e) => console.log('    - ' + e.nombre));
  console.log('');
}
