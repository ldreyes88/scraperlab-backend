/**
 * Utilidades de tiempo con zona horaria de Colombia (America/Bogota, UTC-5)
 * Centraliza toda la lógica de timestamps para que sean consistentes
 */

const COLOMBIA = {
  tz: 'America/Bogota',
  offset: '-05:00',
  locale: 'es-CO'
};

/**
 * Formatea las partes de una fecha en zona horaria de Colombia
 */
function formatParts(date = new Date(), opts = {}) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: COLOMBIA.tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...opts
  });
  return Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
}

/**
 * Retorna un ISO string con offset de Colombia
 * Ejemplo: "2026-02-07T14:30:45-05:00"
 */
function nowColombiaISO(date = new Date()) {
  const p = formatParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${COLOMBIA.offset}`;
}

/**
 * Retorna la fecha actual en Colombia como YYYY-MM-DD
 * Ejemplo: "2026-02-07"
 */
function dayKeyColombia(date = new Date()) {
  const p = formatParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Convierte un timestamp ISO a fecha YYYY-MM-DD en zona horaria de Colombia
 * Útil para filtros de fecha
 */
function toColombiaDateKey(isoString) {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return null;
    const p = formatParts(date);
    return `${p.year}-${p.month}-${p.day}`;
  } catch {
    return null;
  }
}

module.exports = {
  nowColombiaISO,
  dayKeyColombia,
  toColombiaDateKey,
  COLOMBIA
};
