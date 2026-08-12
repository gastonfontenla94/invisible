/**
 * Orden aleatorio que rota cada día.
 *
 * Mismo criterio que la fórmula que había en Airtable: combina la fecha de hoy
 * con un hash del slug, de modo que el orden es estable durante todo el día
 * (igual para todos los visitantes) y cambia al día siguiente.
 *
 * Se resuelve en el build. El workflow de GitHub Actions vuelve a publicar
 * el sitio todos los días para que la rotación ocurra sola.
 *
 * La fecha se toma en hora de Argentina y no en la del servidor: el build
 * automático corre en máquinas de GitHub, que están en UTC.
 */

function hash(texto, semilla) {
  let h = semilla >>> 0;
  for (let i = 0; i < texto.length; i++) {
    h = (h ^ texto.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Fecha de hoy en Buenos Aires, como número AAAAMMDD. */
export function fechaArgentina(momento = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(momento);

  return Number(partes.replaceAll('-', ''));
}

export function ordenDiario(items) {
  const semilla = fechaArgentina();

  return [...items].sort(
    (a, b) => hash(a.slug, semilla) - hash(b.slug, semilla)
  );
}
