// Filtro das partes/ficheiros de um modelo multicor (generation_schema.multicor.partes,
// sem_ams_ficheiros, ficheiros_extra, ficheiros) — uma parte só corre quando:
//   "so_quando": { "<param>": "<valor>" | ["<valor>", …] }   o parâmetro tem esse valor (ou um deles)
//   "min_param": { "<param>": n }                            o parâmetro (número) é >= n
// Usado para as cores da imagem dos suportes de telemóvel: a parte "rampa_c3" só existe com
// cores_imagem_rampa = "Cores da imagem" e num_cores_rampa >= 3 — assim não se corre o OpenSCAD
// para peças que sairiam vazias.
export function parteAtiva(p, params) {
  if (p?.so_quando && !Object.entries(p.so_quando).every(([k, v]) =>
    (Array.isArray(v) ? v.map(String) : [String(v)]).includes(String(params?.[k] ?? '')))) return false;
  if (p?.min_param && !Object.entries(p.min_param).every(([k, n]) => Number(params?.[k]) >= Number(n))) return false;
  return true;
}

const HEX = /^#[0-9a-f]{6}$/i;
/** Cor de uma parte: o parâmetro escolhido (cor_param) ou, vazio, a cor automática (cor_auto_param). */
export function corParte(p, params, omissao = '#FFFFFF') {
  const c = String(params?.[p.cor_param] ?? '');
  if (HEX.test(c)) return c;
  const a = String(params?.[p.cor_auto_param] ?? '');
  return HEX.test(a) ? a : omissao;
}
