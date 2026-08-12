/**
 * Invisible — redirecciones de las URLs viejas (Softr)
 *
 * El sitio anterior servía los perfiles en /pagina/<slug>/r/<recordId>.
 * Esas URLs están indexadas en Google: si devuelven 404 se pierde el
 * posicionamiento ganado en julio. Acá se genera public/_redirects, que
 * Cloudflare lee para responder 301 hacia la ruta nueva.
 *
 * El recordId se ignora con un comodín (*): el slug alcanza para saber
 * a qué ficha apuntaba cada URL.
 *
 * OJO (verificado en producción el 12/8/2026): no agregar una regla general
 * tipo "/pagina/*  /" como red de contención. Cloudflare le da prioridad por
 * encima de las reglas específicas y termina mandando TODAS las fichas a la
 * home. Una ficha vieja que ya no existe es preferible que dé 404.
 *
 * Se corre solo antes de cada build (ver package.json).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');
const DATA = path.join(RAIZ, 'src', 'data');

const leer = (nombre) =>
  JSON.parse(fs.readFileSync(path.join(DATA, nombre + '.json'), 'utf8'));

const secciones = [
  { archivo: 'estudios', ruta: '/estudios-de-grabacion' },
  { archivo: 'ingenieros', ruta: '/ingenierosyproductores' },
  { archivo: 'formacion', ruta: '/formacion' },
];

const lineas = [
  '# Generado por scripts/generar-redirects.mjs — no editar a mano.',
  '# Redirecciones de las URLs del sitio viejo (Softr) a las nuevas.',
  '',
  '# Fichas: /pagina/<slug>/r/<recordId>  ->  /<seccion>/<slug>/',
];

let fichas = 0;

for (const { archivo, ruta } of secciones) {
  for (const item of leer(archivo)) {
    lineas.push(`/pagina/${item.slug}/r/*  ${ruta}/${item.slug}/  301`);
    fichas++;
  }
}

lineas.push(
  '',
  '# Plantillas de detalle de Softr (llevaban el registro en ?recordId=,',
  '# que no viaja en la redirección: se manda a la sección).',
  '/estudios-de-grabacion-details  /estudios-de-grabacion/  301',
  '/ingenieros-y-productores-details  /ingenierosyproductores/  301',
  '/ingenierosyproductores-details  /ingenierosyproductores/  301',
  '/formacion-details  /formacion/  301',
  '',
  '# Páginas del sitio viejo que no existen en el nuevo.',
  '/terminosycondiciones  /manifiesto/  301',
  '',
  '# El sitio vive en www. Sin esto, invisible.com.ar y www.invisible.com.ar',
  '# devuelven las mismas páginas por duplicado (Softr lo resolvía solo).',
  '# Va al final: las reglas de arriba se aplican primero.',
  'https://invisible.com.ar/*  https://www.invisible.com.ar/:splat  301',
  ''
);

fs.mkdirSync(path.join(RAIZ, 'public'), { recursive: true });
fs.writeFileSync(
  path.join(RAIZ, 'public', '_redirects'),
  lineas.join('\n'),
  'utf8'
);

console.log(`  Redirecciones generadas: ${fichas} fichas + reglas generales`);
