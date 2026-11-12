/** Convención usada en MAUI: 3 letras del primer nombre + iniciales de apellidos en mayúsculas. */
export function suggestedUsername(firstNames: string, surnames: string): string {
  const clean = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const first = clean(firstNames)[0]?.slice(0, 3).toLowerCase() || '';
  const last = clean(surnames);
  if (!first || !last.length) return '';
  return first[0].toUpperCase() + first.slice(1) +
    last.map(part => part[0].toUpperCase()).join('');
}
