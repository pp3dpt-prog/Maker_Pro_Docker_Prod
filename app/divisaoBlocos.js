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
    const reg = semMigalhas(sol);
    if (reg.length) out.push({ ...f, regiao: reg });
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

// ══ Encaixes entre blocos ══════════════════════════════════════════════════════════════════════
// Sem peças de reforço por trás (fariam sombra na frente iluminada): as próprias juntas encaixam.
//  • Painéis (frente, tampa): rabos de andorinha no plano do painel, ao longo de cada corte — o
//    bloco da esquerda/de cima tem as patilhas, o vizinho os entalhes (com FOLGA à volta). Só se
//    vê a linha fina da junta, e os blocos ficam presos no plano e alinhados.
//  • Paredes (corpo, canal do neon): a junta em ziguezague na altura (dentes a 45°, imprimíveis
//    sem suportes de pé) — alinha os blocos em altura e dá mais área de cola. Feita em fatias finas
//    só junto ao corte; o resto da parede continua a ser um prisma só.

export const ENCAIXE = {
  folga: 0.15,          // mm de folga total entre blocos
  // rabo de andorinha (painéis)
  pescoco: 6, cabeca: 10, comprimento: 6, espaco: 35, margem: 2,
  // dentes das paredes
  amplitude: 2.5, periodo: 10, passoZ: 0.3,
};

const P = (x, y) => ({ X: Math.round(x * ESC), Y: Math.round(y * ESC) });
/** Tira migalhas (< 0,5 mm²) que os cortes deixam nos cantos. */
const semMigalhas = (paths) => paths.filter(q => Math.abs(C.Clipper.Area(q)) >= 0.5 * ESC * ESC);
const rectP = (x0, x1, y0, y1) => [[P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]];
function clip(tipo, a, b) {
  if (!a.length) return tipo === C.ClipType.ctUnion ? b : [];
  if (!b.length) return tipo === C.ClipType.ctIntersection ? [] : a;
  const c = new C.Clipper();
  c.AddPaths(a, C.PolyType.ptSubject, true);
  c.AddPaths(b, C.PolyType.ptClip, true);
  const sol = new C.Paths();
  c.Execute(tipo, sol, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
  return sol;
}
const uniaoP = (a, b) => clip(C.ClipType.ctUnion, a, b);
const difP = (a, b) => clip(C.ClipType.ctDifference, a, b);
const interP = (a, b) => clip(C.ClipType.ctIntersection, a, b);
function offsetP(paths, mm) {
  if (!paths.length) return paths;
  const co = new C.ClipperOffset(2, 0.02 * ESC);
  co.AddPaths(paths, C.JoinType.jtMiter, C.EndType.etClosedPolygon);
  const out = new C.Paths();
  co.Execute(out, mm * ESC);
  return out;
}

/** Intervalos [a, b] (mm) da linha eixo = v dentro de `paths` (paridade par-ímpar). */
function intervalos(paths, eixo, v) {
  const us = [];
  for (const q of paths) for (let k = 0; k < q.length; k++) {
    const A = q[k], B = q[(k + 1) % q.length];
    const a = (eixo === 'x' ? A.X : A.Y) / ESC, b = (eixo === 'x' ? B.X : B.Y) / ESC;
    if (a === b) continue;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    if (v < lo || v >= hi) continue;
    const ua = (eixo === 'x' ? A.Y : A.X) / ESC, ub = (eixo === 'x' ? B.Y : B.X) / ESC;
    us.push(ua + ((v - a) / (b - a)) * (ub - ua));
  }
  us.sort((x, y) => x - y);
  const out = [];
  for (let k = 0; k + 1 < us.length; k += 2) out.push([us[k], us[k + 1]]);
  return out;
}

const chave = (col, lin) => `${col},${lin}`;
function vizinhos(blocos) {
  const m = new Map(blocos.map(b => [chave(b.col, b.lin), b]));
  return blocos.map(b => ({ b, dir: m.get(chave(b.col + 1, b.lin)), baixo: m.get(chave(b.col, b.lin + 1)) }));
}
/** Lados do bloco que são cortes (e não a borda da peça). */
const internos = (b, nCols, nLins) => ({ esq: b.col > 0, dir: b.col < nCols - 1, cima: b.lin > 0, baixo: b.lin < nLins - 1 });

/**
 * Zonas 2D de cada bloco (Map id → paths) para um painel, com rabos de andorinha nos cortes.
 * `ref`: região do painel (onde as patilhas têm de caber inteiras).
 */
export function zonasComEncaixes(ref, divisao, opt = ENCAIXE) {
  const { blocos } = divisao;
  const nCols = Math.max(...blocos.map(b => b.col)) + 1, nLins = Math.max(...blocos.map(b => b.lin)) + 1;
  const f = opt.folga, h2 = f / 2;
  const zonas = new Map();
  for (const b of blocos) {
    const i = internos(b, nCols, nLins);
    zonas.set(b.id, rectP(i.esq ? b.x0 + h2 : b.rect.x0, i.dir ? b.x1 - h2 : b.rect.x1, i.baixo ? b.y0 + h2 : b.rect.y0, i.cima ? b.y1 - h2 : b.rect.y1));
  }
  const dentro = offsetP(ref, -opt.margem);
  const meio = opt.cabeca / 2 + opt.margem + 1;
  // patilha ao longo de um corte: u ao longo do corte, t para dentro do vizinho
  const patilha = (pt) => [[pt(-1, -opt.pescoco / 2), pt(0, -opt.pescoco / 2), pt(opt.comprimento, -opt.cabeca / 2),
    pt(opt.comprimento, opt.cabeca / 2), pt(0, opt.pescoco / 2), pt(-1, opt.pescoco / 2)]];
  for (const { b, dir, baixo } of vizinhos(blocos)) {
    const lados = [];
    if (dir) lados.push({ viz: dir, eixo: 'x', c: b.x1, lo: b.y0, hi: b.y1, i: internos(b, nCols, nLins), pt: (u) => (t, s) => P(b.x1 + t, u + s) });
    if (baixo) lados.push({ viz: baixo, eixo: 'y', c: b.y0, lo: b.x0, hi: b.x1, i: internos(b, nCols, nLins), pt: (u) => (t, s) => P(u + s, b.y0 - t) });
    for (const L of lados) {
      // afasta as patilhas dos cortes perpendiculares (cantos dos blocos)
      const lo = L.lo + (L.eixo === 'x' ? (L.i.baixo ? meio : 0) : (L.i.esq ? meio : 0));
      const hi = L.hi - (L.eixo === 'x' ? (L.i.cima ? meio : 0) : (L.i.dir ? meio : 0));
      for (const [a0, b0] of intervalos(ref, L.eixo, L.c)) {
        const a = Math.max(a0 + meio, lo), z = Math.min(b0 - meio, hi);
        if (z < a) continue;
        // candidatas de 2 em 2 mm onde a patilha cabe inteira no painel; escolhe-se com o
        // espaçamento pedido, centradas no troço que as aceita
        const ok = [];
        for (let u = a; u <= z + 1e-6; u += 2) if (!difP(patilha(L.pt(u)), dentro).length) ok.push(u);
        if (!ok.length) continue;
        const escolhidas = [];
        for (const u of ok) if (!escolhidas.length || u - escolhidas[escolhidas.length - 1] >= opt.espaco) escolhidas.push(u);
        const sobra = ok[ok.length - 1] - escolhidas[escolhidas.length - 1];
        const desvio = Math.min(sobra / 2, Math.max(0, opt.espaco / 2));
        for (const u0 of escolhidas) {
          // desloca para centrar, se a posição deslocada ainda couber
          const u = ok.some(v => Math.abs(v - (u0 + desvio)) < 1.01) ? u0 + desvio : u0;
          const T = patilha(L.pt(u));
          zonas.set(b.id, uniaoP(zonas.get(b.id), T));
          zonas.set(L.viz.id, difP(zonas.get(L.viz.id), offsetP(T, f)));
        }
      }
    }
  }
  return zonas;
}

/** Fatias recortadas por uma zona 2D (Clipper paths). */
export function fatiasNaZona(fatias, zona) {
  const out = [];
  for (const f of fatias) {
    if (!f.regiao?.length) continue;
    const r = semMigalhas(interP(f.regiao, zona));
    if (r.length) out.push({ ...f, regiao: r });
  }
  return out;
}

/**
 * Paredes (fatias de pé, z para cima) cortadas com dentes a 45° em cada corte: Map id → fatias.
 * Cada bloco = prisma inteiro longe dos cortes + fatias finas (passoZ) numa faixa à volta deles.
 */
export function paredesComDentes(fatias, divisao, opt = ENCAIXE) {
  const { blocos } = divisao;
  const nCols = Math.max(...blocos.map(b => b.col)) + 1, nLins = Math.max(...blocos.map(b => b.lin)) + 1;
  const A = opt.amplitude, h2 = opt.folga / 2, F = 1e4;
  const tri = (x) => 1 - 2 * Math.abs(x - Math.floor(x) - 0.5);       // 0..1..0
  const corte = (c, z) => c + A * (2 * tri(z / opt.periodo) - 1);   // ±A, inclinação 4A/periodo = 45°
  const out = new Map();
  for (const b of blocos) {
    const i = internos(b, nCols, nLins);
    const nucleo = rectP(i.esq ? b.x0 + A + h2 : -F, i.dir ? b.x1 - A - h2 : F, i.baixo ? b.y0 + A + h2 : -F, i.cima ? b.y1 - A - h2 : F);
    const fora = rectP(i.esq ? b.x0 - A - h2 : -F, i.dir ? b.x1 + A + h2 : F, i.baixo ? b.y0 - A - h2 : -F, i.cima ? b.y1 + A + h2 : F);
    const faixa = difP(fora, nucleo);
    const res = [];
    for (const f of fatias) {
      if (!f.regiao?.length) continue;
      const nuc = semMigalhas(interP(f.regiao, nucleo));
      if (nuc.length) res.push({ ...f, regiao: nuc });
      const banda = interP(f.regiao, faixa);
      if (!banda.length) continue;
      const n = Math.max(1, Math.ceil((f.z1 - f.z0) / opt.passoZ));
      for (let k = 0; k < n; k++) {
        const z0 = f.z0 + ((f.z1 - f.z0) * k) / n, z1 = f.z0 + ((f.z1 - f.z0) * (k + 1)) / n, zm = (z0 + z1) / 2;
        const r = rectP(i.esq ? corte(b.x0, zm) + h2 : -F, i.dir ? corte(b.x1, zm) - h2 : F,
          i.baixo ? corte(b.y0, zm) + h2 : -F, i.cima ? corte(b.y1, zm) - h2 : F);
        const reg = semMigalhas(interP(banda, r));
        if (reg.length) res.push({ ...f, z0, z1, regiao: reg });
      }
    }
    out.set(b.id, res);
  }
  return out;
}

/** params.encaixes_blocos: liga/desliga os encaixes (por omissão, ligados). */
export const comEncaixes = (params) => !(params?.encaixes_blocos === 0 || params?.encaixes_blocos === false || params?.encaixes_blocos === '0' || params?.encaixes_blocos === 'nao');

/** Volume (mm³) de uma lista de fatias — para largar blocos que só apanham uma lasca da peça. */
export function volumeFatias(fatias) {
  let v = 0;
  for (const f of fatias) for (const q of f.regiao ?? []) v += (C.Clipper.Area(q) / (ESC * ESC)) * (f.z1 - f.z0);
  return Math.abs(v);
}
export const VOLUME_MIN = 30;   // mm³: menos do que isto não vale um ficheiro (é uma lasca do canto)
