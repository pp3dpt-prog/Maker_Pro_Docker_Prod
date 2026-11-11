/**
 * Divisão em blocos — peças maiores do que a mesa da impressora (Caixa de Luz logótipo/neon).
 *
 * Partilhado TAL E QUAL entre o backend (Maker_Pro_Docker_Prod/app/divisaoBlocos.js) e o
 * frontend (Maker_Pro_Frontend_Prod/lib/divisaoBlocos.js): a sugestão e os cortes que o cliente
 * vê no browser são exatamente os que o servidor aplica. Se mudares um, copia para o outro.
 *
 * As peças destes geradores são "fatias" ({ z0, z1, regiao }: regiões 2D do Clipper extrudidas
 * em z), por isso cortar é só intersetar cada região com o rectângulo de cada bloco.
 *
 * Cortes: rectos, verticais (x = …) e horizontais (y = …), guardados como FRAÇÕES (0–1) da caixa
 * envolvente da peça — assim acompanham a peça quando o cliente muda o tamanho.
 * Sugestão: o menor número de blocos que cabe na mesa (com MARGEM_MESA de folga; os blocos podem
 * rodar 90° na mesa) e, entre as posições possíveis, as que atravessam MENOS material — p.ex.
 * entre letras, onde o contorno estreita — e evitam partir as zonas de cor.
 * Blocos: colunas A, B, C… da esquerda para a direita; linhas 1, 2, 3… de cima para baixo.
 */
import ClipperLib from 'clipper-lib';

const ESC = 1000;
const C = ClipperLib;

export const MARGEM_MESA = 6;     // mm livres na mesa, por eixo (borda/skirt)
export const BLOCO_MIN = 20;      // mm: nenhum bloco mais estreito do que isto
const PASSO = 1;                  // mm: resolução da procura dos cortes
const PESO_CORES = 3;             // atravessar zonas de cor custa 3× mais do que a moldura

/** Caixa envolvente (mm) de uma lista de paths do Clipper. */
export function caixaDe(paths) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const q of paths) for (const pt of q) {
    if (pt.X < a) a = pt.X; if (pt.X > c) c = pt.X;
    if (pt.Y < b) b = pt.Y; if (pt.Y > d) d = pt.Y;
  }
  if (!Number.isFinite(a)) return null;
  return { minX: a / ESC, minY: b / ESC, maxX: c / ESC, maxY: d / ESC, w: (c - a) / ESC, h: (d - b) / ESC };
}

/**
 * Perfil de "material atravessado": para cada posição v da grelha (de v0 em v0 + i·PASSO), o
 * comprimento (mm) da linha eixo = v dentro das regiões (paridade par-ímpar — regiões do Clipper
 * já unidas, com buracos). eixo 'x' = linhas verticais.
 */
function perfilCorte(regioes, eixo, v0, n) {
  const cortes = Array.from({ length: n }, () => []);
  for (const paths of regioes) for (const q of paths) {
    for (let k = 0; k < q.length; k++) {
      const A = q[k], B = q[(k + 1) % q.length];
      const a = (eixo === 'x' ? A.X : A.Y) / ESC, b = (eixo === 'x' ? B.X : B.Y) / ESC;
      const ua = (eixo === 'x' ? A.Y : A.X) / ESC, ub = (eixo === 'x' ? B.Y : B.X) / ESC;
      if (a === b) continue;
      const lo = Math.min(a, b), hi = Math.max(a, b);
      const i0 = Math.max(0, Math.ceil((lo - v0) / PASSO)), i1 = Math.min(n - 1, Math.floor((hi - v0) / PASSO));
      for (let i = i0; i <= i1; i++) {
        const v = v0 + i * PASSO;
        if (v === hi) continue;                    // meio-aberto: cada vértice conta uma vez
        cortes[i].push(ua + ((v - a) / (b - a)) * (ub - ua));
      }
    }
  }
  return cortes.map((us, i) => {
    us.sort((x, y) => x - y);
    let L = 0;
    for (let k = 0; k + 1 < us.length; k += 2) L += us[k + 1] - us[k];
    return L;
  });
}

/**
 * k cortes entre lo e hi, cada pedaço ≤ maxBloco e ≥ BLOCO_MIN, com custo mínimo
 * (programação dinâmica na grelha de PASSO mm). Devolve posições em mm, ou null se não der.
 */
function melhoresCortes(custo, lo, hi, k, maxBloco) {
  if (k <= 0) return [];
  const n = custo.length;                          // custo[i] na posição lo + i·PASSO
  const pos = (i) => lo + i * PASSO;
  const media = (hi - lo) / (k + 1);
  const pen = (gap) => 0.02 * Math.abs(gap - media); // desempate: blocos parecidos
  let ant = new Float64Array(n).fill(Infinity), de = [];
  for (let i = 0; i < n; i++) {
    const g = pos(i) - lo;
    if (g >= BLOCO_MIN && g <= maxBloco) ant[i] = custo[i] + pen(g);
  }
  for (let c = 1; c < k; c++) {
    const cur = new Float64Array(n).fill(Infinity), arg = new Int32Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < i; j++) {
        if (ant[j] === Infinity) continue;
        const g = pos(i) - pos(j);
        if (g < BLOCO_MIN || g > maxBloco) continue;
        const v = ant[j] + custo[i] + pen(g);
        if (v < cur[i]) { cur[i] = v; arg[i] = j; }
      }
    }
    de.push(arg); ant = cur;
  }
  let best = -1, bv = Infinity;
  for (let i = 0; i < n; i++) {
    const g = hi - pos(i);
    if (ant[i] === Infinity || g < BLOCO_MIN || g > maxBloco) continue;
    const v = ant[i] + pen(g);
    if (v < bv) { bv = v; best = i; }
  }
  if (best < 0) return null;
  const out = [pos(best)];
  for (let c = de.length - 1; c >= 0; c--) { best = de[c][best]; out.unshift(pos(best)); }
  return out;
}

/** Cortes num eixo: o mínimo de blocos que cabe (com até +2 blocos se a forma não deixar). */
function cortesEixo(regioes, pesos, eixo, lo, hi, maxBloco) {
  const comp = hi - lo;
  if (comp <= maxBloco) return [];
  const n = Math.max(1, Math.floor(comp / PASSO) + 1);
  const perfis = regioes.map(r => perfilCorte([r], eixo, lo, n));
  const custo = Array.from({ length: n }, (_, i) => perfis.reduce((s, p, j) => s + p[i] * pesos[j], 0));
  for (let k = Math.ceil(comp / maxBloco) - 1; k <= Math.ceil(comp / maxBloco) + 1; k++) {
    const c = melhoresCortes(custo, lo, hi, k, maxBloco);
    if (c) return c;
  }
  // último recurso: espaçamento igual
  const k = Math.ceil(comp / maxBloco) - 1;
  return Array.from({ length: k }, (_, i) => lo + ((i + 1) * comp) / (k + 1));
}

/**
 * Sugestão de cortes para `fronteira` (contorno exterior da peça) numa mesa mesaX × mesaY.
 * `cores`: regiões a evitar partir (peças de cor). Devolve { fx, fy } (frações 0–1 da caixa).
 */
export function sugerirCortes({ fronteira, cores = [], mesaX, mesaY }) {
  const bb = caixaDe(fronteira);
  if (!bb) return { fx: [], fy: [] };
  const regioes = [fronteira, ...cores.filter(r => r?.length)];
  const pesos = [1, ...cores.filter(r => r?.length).map(() => PESO_CORES)];
  const opcoes = [];
  for (const [A, B] of [[mesaX, mesaY], [mesaY, mesaX]]) {   // blocos direitos ou rodados 90° na mesa
    const LA = A - MARGEM_MESA, LB = B - MARGEM_MESA;
    if (LA < BLOCO_MIN || LB < BLOCO_MIN) continue;
    const cx = cortesEixo(regioes, pesos, 'x', bb.minX, bb.maxX, LA);
    const cy = cortesEixo(regioes, pesos, 'y', bb.minY, bb.maxY, LB);
    opcoes.push({ cx, cy, n: (cx.length + 1) * (cy.length + 1) });
  }
  if (!opcoes.length) return { fx: [], fy: [] };
  opcoes.sort((a, b) => a.n - b.n);
  const o = opcoes[0];
  return {
    fx: o.cx.map(x => (x - bb.minX) / Math.max(1e-9, bb.w)),
    fy: o.cy.map(y => (y - bb.minY) / Math.max(1e-9, bb.h)),
  };
}

/** Frações (do cliente ou da sugestão) → limpas: números em ]0,1[, ordenadas, no máx. 12. */
export function normalizarFracoes(v) {
  if (!Array.isArray(v)) return null;
  const f = v.map(Number).filter(x => Number.isFinite(x) && x > 0.001 && x < 0.999).sort((a, b) => a - b);
  return f.slice(0, 12);
}

/**
 * Blocos (rectângulos em mm) para os cortes dados, com o tamanho de cada um e se cabe na mesa
 * (direito ou rodado). Os blocos das pontas vão até bem fora da peça (para não a aparar).
 */
export function blocosDe(bb, fx, fy, mesaX, mesaY) {
  const xs = [bb.minX, ...fx.map(f => bb.minX + f * bb.w), bb.maxX];
  // linhas de cima para baixo (y maior primeiro)
  const ys = [bb.maxY, ...[...fy].reverse().map(f => bb.minY + f * bb.h), bb.minY];
  const letra = (i) => (i < 26 ? String.fromCharCode(65 + i) : `Z${i - 25}`);
  const out = [];
  for (let j = 0; j + 1 < ys.length; j++) for (let i = 0; i + 1 < xs.length; i++) {
    const x0 = xs[i], x1 = xs[i + 1], y1 = ys[j], y0 = ys[j + 1];
    const w = x1 - x0, h = y1 - y0;
    out.push({
      id: `${letra(i)}${j + 1}`, col: i, lin: j, x0, x1, y0, y1, w, h,
      cabe: (w <= mesaX && h <= mesaY) || (w <= mesaY && h <= mesaX),
      rect: {
        x0: i === 0 ? x0 - 1e4 : x0, x1: i === xs.length - 2 ? x1 + 1e4 : x1,
        y0: j === ys.length - 2 ? y0 - 1e4 : y0, y1: j === 0 ? y1 + 1e4 : y1,
      },
    });
  }
  return out;
}

function retangulo({ x0, x1, y0, y1 }) {
  return [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ X: Math.round(x * ESC), Y: Math.round(y * ESC) }))];
}

/** Fatias recortadas por um bloco (as que ficam vazias saem). */
export function fatiasNoBloco(fatias, bloco) {
  const r = retangulo(bloco.rect);
  const out = [];
  for (const f of fatias) {
    if (!f.regiao?.length) continue;
    const c = new C.Clipper();
    c.AddPaths(f.regiao, C.PolyType.ptSubject, true);
    c.AddPaths(r, C.PolyType.ptClip, true);
    const sol = new C.Paths();
    c.Execute(C.ClipType.ctIntersection, sol, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
    if (sol.length) out.push({ ...f, regiao: sol });
  }
  return out;
}

/**
 * Tudo o que um gerador precisa: decide se divide (params.dividir: "auto" — só se não couber —,
 * "sim" ou "nao"), escolhe os cortes (params.cortes_x / cortes_y, frações, ou a sugestão) e
 * devolve os blocos. null = não dividir.
 */
export function planoDivisao({ fronteira, cores = [], mesaX, mesaY, params }) {
  const bb = caixaDe(fronteira);
  if (!bb) return null;
  const modo = params?.dividir === 'nao' || params?.dividir === 0 || params?.dividir === false ? 'nao'
    : params?.dividir === 'sim' ? 'sim' : 'auto';
  const cabeInteira = (bb.w <= mesaX && bb.h <= mesaY) || (bb.w <= mesaY && bb.h <= mesaX);
  const sugestao = sugerirCortes({ fronteira, cores, mesaX, mesaY });
  if (modo === 'nao' || (modo === 'auto' && cabeInteira && !Array.isArray(params?.cortes_x) && !Array.isArray(params?.cortes_y))) {
    return { ativo: false, bb, cabeInteira, sugestao, fx: [], fy: [], blocos: [] };
  }
  const fx = normalizarFracoes(params?.cortes_x) ?? sugestao.fx;
  const fy = normalizarFracoes(params?.cortes_y) ?? sugestao.fy;
  const blocos = blocosDe(bb, fx, fy, mesaX, mesaY);
  return { ativo: blocos.length > 1, bb, cabeInteira, sugestao, fx, fy, blocos };
}
