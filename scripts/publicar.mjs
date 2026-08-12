/**
 * Invisible — publicar el sitio
 *
 * Hace todo el trámite de una sola vez:
 *   1. importa los datos exportados de Airtable
 *   2. construye el sitio (dist/)
 *   3. lo sube a GitHub, que dispara la publicación en Cloudflare
 *
 * El paso de traer los cambios de GitHub existe porque todas las noches
 * un robot vuelve a publicar el sitio solo (para rotar el orden de las
 * listas): sin eso, el push sería rechazado.
 *
 * Uso:  npm run publicar
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function correr(comando, args, { silencioso = false } = {}) {
  return execFileSync(comando, args, {
    cwd: RAIZ,
    encoding: 'utf8',
    stdio: silencioso ? 'pipe' : 'inherit',
  });
}

const git = (...args) => correr('git', args, { silencioso: true }).trim();

function paso(texto) {
  console.log(`\n─── ${texto}\n`);
}

try {
  paso('1/4  Leyendo los datos exportados de Airtable');
  correr(process.execPath, ['scripts/importar-datos.mjs']);

  paso('2/4  Construyendo el sitio');
  correr(process.execPath, ['scripts/generar-redirects.mjs']);
  correr(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['astro', 'build']);

  paso('3/4  Guardando los cambios');
  git('add', '-A');

  const hayCambios = git('status', '--porcelain') !== '';
  if (hayCambios) {
    git('commit', '-m', 'Actualizo los datos del directorio');
    console.log('  Cambios guardados.');
  } else {
    console.log('  No hay cambios para guardar.');
  }

  paso('4/4  Subiendo a GitHub');
  git('fetch', 'origin', 'main');

  const atrasados = git('rev-list', '--count', 'HEAD..origin/main');
  if (atrasados !== '0') {
    console.log(`  Traigo ${atrasados} publicación(es) automática(s) del robot…`);
    // Ante un choque en dist/ gana lo recién construido acá, que es lo más nuevo.
    git('merge', '-X', 'ours', '--no-edit', 'origin/main');
  }

  const pendientes = git('rev-list', '--count', 'origin/main..HEAD');
  if (pendientes === '0') {
    console.log('\n  Ya estaba todo publicado. No hice falta.\n');
  } else {
    correr('git', ['push', 'origin', 'main']);
    console.log('\n  Listo. Cloudflare publica el sitio en un minuto.\n');
  }
} catch (error) {
  console.error('\n  Algo falló y no se publicó nada.');
  console.error('  ' + (error.stderr?.toString().trim() || error.message));
  console.error('\n  El sitio que está online no se tocó.\n');
  process.exit(1);
}
