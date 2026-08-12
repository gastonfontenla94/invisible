/**
 * Orden aleatorio que rota cada día.
 *
 * Mismo criterio que la fórmula que había en Airtable: combina la fecha de hoy
 * con un hash del slug, de modo que el orden es estable durante todo el día
 * (igual para todos los visitantes) y cambia al día siguiente.
 *
 * Se resuelve en el build. El workflow de GitHub Actions vuelve a publicar
 * el sitio todos los días para que la rotación ocurra sola.
 */

function hash(texto, semilla) {
  let h = semilla >>> 0;
  for (let i = 0; i < texto.length; i++) {
    h = (h ^ texto.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function ordenDiario(items) {
  const hoy = new Date();
  const semilla =
    hoy.getFullYear() * 10000 + (hoy.getMonth() + 1) * 100 + hoy.getDate();

  return [...items].sort(
    (a, b) => hash(a.slug, semilla) - hash(b.slug, semilla)
  );
}
