// Imagem com as cores próprias (suportes de telemóvel personalizados): a partir do vetor do
// vetorizador (app/vetorPortachaves.js → obterVetor, com num_cores = n) devolve uma região por
// cor, em µm, centrada no desenho e com a largura pedida (Y para cima), SEM sobreposições entre
// cores (a 1.ª cor do vetor — a mais escura — ganha nas fronteiras) e com as frestas finas entre
// cores vizinhas fechadas — o mesmo critério de construirPecas (app/vetorGeom.js).
//
// Este ficheiro é IGUAL em Maker_Pro_Docker_Prod/lib/imagemCores.js (ficheiro final, lib/logo.js)
// e Maker_Pro_Frontend_Prod/lib/imagemCores.js (pré-visualização): se mudares um, copia para o outro.
import ClipperLib from 'clipper-lib';

const C = ClipperLib;
const ESC = 1000;                                   // µm
const EO = C.PolyFillType.pftEvenOdd, NZ = C.PolyFillType.pftNonZero;
const MIN_MM2 = 0.3;                                // ilhas e buracos mais pequenos saem
const G = 0.12;                                     // fecho das frestas entre cores (mm)

function executar(tipo, a, b = [], fa = NZ) {
  const c = new C.Clipper();
  c.StrictlySimple = true;                          // sem vértices encostados (o OpenSCAD fecha mal a malha)
  if (a.length) c.AddPaths(a, C.PolyType.ptSubject, true);
  if (b.length) c.AddPaths(b, C.PolyType.ptClip, true);
  const out = [];
  c.Execute(tipo, out, fa, NZ);
  return out;
}
const uniao = (a, fa = NZ) => (a.length ? executar(C.ClipType.ctUnion, a, [], fa) : []);
const diferenca = (a, b) => (a.length && b.length ? executar(C.ClipType.ctDifference, a, b) : a);
const intersecao = (a, b) => (a.length && b.length ? executar(C.ClipType.ctIntersection, a, b) : []);
function offset(paths, mm) {
  if (!paths.length) return [];
  const co = new C.ClipperOffset(2, 0.02 * ESC);
  co.AddPaths(paths, C.JoinType.jtRound, C.EndType.etClosedPolygon);
  const out = [];
  co.Execute(out, mm * ESC);
  return out;
}
/** Tira ilhas pequenas e buracos pequenos (área < min mm²). */
function limpar(paths, min = MIN_MM2) {
  const m = min * ESC * ESC;
  return paths.filter(p => p.length >= 3 && Math.abs(C.Clipper.Area(p)) >= m);
}

/** Escala do vetor: mm por píxel e centro do desenho (como lib/logo.js). */
export function escalaVetor(vetor, largura) {
  const bb = vetor?.ancoras?.bbox || [0, 0, (vetor?.w || 1) - 1, (vetor?.h || 1) - 1];
  return { s: largura / Math.max(1, bb[2] - bb[0] + 1), cx: (bb[0] + bb[2]) / 2, cy: (bb[1] + bb[3]) / 2 };
}
function aneisParaPaths(aneis, { s, cx, cy }) {
  return (aneis || []).map(a => {
    const p = [];
    for (let i = 0; i + 1 < a.length; i += 2) p.push({ X: Math.round((a[i] - cx) * s * ESC), Y: Math.round((cy - a[i + 1]) * s * ESC) });
    return p;
  }).filter(p => p.length >= 3);
}

/**
 * @returns {{ uniao: Path[], cores: { hex: string, regiao: Path[] }[] }} regiões em µm; uniao = todas
 *   as cores juntas (o rebaixo no corpo).
 */
export function regioesCores(vetor, largura) {
  if (!vetor?.cores?.length) return { uniao: [], cores: [] };
  const esc = escalaVetor(vetor, largura);
  const cores = [];
  let ocupado = [];
  for (const c of vetor.cores) {
    let reg = limpar(uniao(aneisParaPaths(c.aneis, esc), EO));
    reg = limpar(diferenca(reg, ocupado));
    if (!reg.length) continue;
    ocupado = uniao([...ocupado, ...reg]);
    cores.push({ hex: String(c.hex || '#FFFFFF'), regiao: reg });
  }
  const fechado = offset(offset(ocupado, G), -G);
  for (const c of cores) {
    const livre = diferenca(fechado, ocupado);
    if (!livre.length) break;
    const extra = intersecao(offset(c.regiao, G), livre);
    if (extra.length) { c.regiao = uniao([...c.regiao, ...extra]); ocupado = uniao([...ocupado, ...extra]); }
  }
  for (const c of cores) c.regiao = limpar(c.regiao, 0.05);
  return { uniao: ocupado, cores: cores.filter(c => c.regiao.length) };
}
