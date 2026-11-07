/**
 * Tipo de gerador de um design, independente da família.
 *
 * A `familia` serve para AGRUPAR designs na loja (categorias como
 * "Iluminárias", "Litofânias"…) e pode ser mudada à vontade no admin. O
 * gerador a usar vem de `generation_schema.gerador` quando existe (ex.:
 * 'litofania-curva', 'litofania-esfera', 'litofania-cubo', 'letras-caixa-luz');
 * os designs sem esse campo continuam a usar a família (comportamento antigo).
 * Nota: não usar `generation_schema.engine` — já tem outros significados
 * ('openscad', 'vetor-cores').
 */
export function tipoDesign(design) {
  const g = design?.generation_schema?.gerador;
  if (typeof g === 'string' && g.trim()) return g.trim().toLowerCase();
  return String(design?.familia || '').trim().toLowerCase();
}
