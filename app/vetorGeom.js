/**
 * Geometria do porta-chaves de imagem a cores — PARTILHADO entre o backend
 * (Maker_Pro_Docker_Prod/app/vetorGeom.js) e o browser
 * (Maker_Pro_Frontend_Prod/lib/vetorGeom.js). Mantém os dois ficheiros iguais:
 * é isto que garante que a pré-visualização é exatamente o ficheiro descarregado.
 *
 * Entrada: o resultado de vetorizarImagem() (contornos em píxeis) + parâmetros.
 * Saída: peças, cada uma feita de "fatias" (região 2D extrudida entre z0 e z1),
 * e a conversão de fatias em triângulos.
 */
import ClipperLib from 'clipper-lib';
import earcut from 'earcut';

const ESC = 1000;              // Clipper trabalha em inteiros: 1 unidade = 1 µm
const PAREDE_FURO = 2.0;       // mm de material à volta do furo
const PARAM_PADRAO = {
  modo: 'sem_ams',             // 'sem_ams' | 'ams'
  largura: 40,                 // mm — largura do desenho (a base acrescenta o contorno)
  contorno: 2.5,               // mm de base à volta do desenho
  espessura_base: 2.0,         // mm
  relevo: 1.2,                 // mm (altura das cores por cima da base)
  acabamento: 'relevo',        // AMS: 'relevo' (cores salientes) | 'liso' (cores embutidas, superfície plana)
  cor_relevo: 1,               // sem AMS + SVG: cor que fica em relevo (1 = mais escura)
  furo_pos: 'cima',            // 'cima' | 'esquerda' | 'direita' | 'cima-esquerda' | 'cima-direita' | 'nenhum'
  furo_d: 4.5,                 // mm
  detalhe_min: 0.4,            // mm² — ilhas mais pequenas são removidas (não imprimem bem)
  preencher_buracos: 1,        // base sem buracos interiores
  encaixe: 0.6,                // sem AMS + PNG: profundidade dos encaixes na base (mm)
  folga: 0.2,                  // sem AMS + PNG: folga total entre peça e encaixe (mm)
};

export function normalizarParametros(p = {}) {
  const n = { ...PARAM_PADRAO };
  for (const k of Object.keys(PARAM_PADRAO)) {
    if (p[k] === undefined || p[k] === null || p[k] === '') continue;
    n[k] = typeof PARAM_PADRAO[k] === 'number' ? Number(p[k]) : String(p[k]);
  }
  const lim = (k, a, b) => { if (!Number.isFinite(n[k])) n[k] = PARAM_PADRAO[k]; n[k] = Math.max(a, Math.min(b, n[k])); };
  lim('largura', 15, 150); lim('contorno', 0, 10); lim('espessura_base', 0.8, 8); lim('relevo', 0.2, 5);
  lim('furo_d', 2, 12); lim('detalhe_min', 0, 10); lim('encaixe', 0.2, 2); lim('folga', 0, 1); lim('cor_relevo', 1, 6);
  if (!['sem_ams', 'ams'].includes(n.modo)) n.modo = 'sem_ams';
  if (!['relevo', 'liso'].includes(n.acabamento)) n.acabamento = 'relevo';
  if (!['cima', 'esquerda', 'direita', 'cima-esquerda', 'cima-direita', 'nenhum'].includes(n.furo_pos)) n.furo_pos = 'cima';
  n.preencher_buracos = n.preencher_buracos ? 1 : 0;
  n.encaixe = Math.min(n.encaixe, n.espessura_base - 0.4);
  return n;
}

// ── Clipper helpers ──────────────────────────────────────────────────────────

const C = ClipperLib;
const FILL_EO = C.PolyFillType.pftEvenOdd;
const FILL_NZ = C.PolyFillType.pftNonZero;

function executar(tipo, sujeito, recorte = [], fill = FILL_NZ) {
  const c = new C.Clipper();
  if (sujeito.length) c.AddPaths(sujeito, C.PolyType.ptSubject, true);
  if (recorte.length) c.AddPaths(recorte, C.PolyType.ptClip, true);
  const sol = new C.Paths();
  c.Execute(tipo, sol, fill, fill);
  return sol;
}
const uniao = (a, b = [], fill = FILL_NZ) => executar(C.ClipType.ctUnion, a, b, fill);
const diferenca = (a, b) => (b.length ? executar(C.ClipType.ctDifference, a, b) : a);
const intersecao = (a, b) => executar(C.ClipType.ctIntersection, a, b);

function offset(paths, mm) {
  if (!paths.length || Math.abs(mm) < 1e-4) return paths;
  const co = new C.ClipperOffset(2, 0.02 * ESC);
  co.AddPaths(paths, C.JoinType.jtRound, C.EndType.etClosedPolygon);
  const out = new C.Paths();
  co.Execute(out, mm * ESC);
  return out;
}

/** Remove ilhas e buracos com área < minMm2. */
function limparPequenos(paths, minMm2) {
  if (minMm2 <= 0) return paths;
  const min = minMm2 * ESC * ESC;
  return uniao(paths.filter(p => Math.abs(C.Clipper.Area(p)) >= min));
}

function circulo(cx, cy, r, seg = 48) {
  const p = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    p.push({ X: Math.round((cx + r * Math.cos(a)) * ESC), Y: Math.round((cy + r * Math.sin(a)) * ESC) });
  }
  return p;
}

function casco(pontos) {
  const pts = pontos.slice().sort((a, b) => a.X - b.X || a.Y - b.Y);
  const cross = (o, a, b) => (a.X - o.X) * (b.Y - o.Y) - (a.Y - o.Y) * (b.X - o.X);
  const lo = [], hi = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

// ── Conversão píxeis → mm ────────────────────────────────────────────────────

function aneisParaPaths(aneis, s, H) {
  return aneis.map(a => {
    const p = [];
    for (let i = 0; i < a.length; i += 2) p.push({ X: Math.round(a[i] * s * ESC), Y: Math.round((H - a[i + 1]) * s * ESC) });
    return p;
  });
}

// ── Peças ────────────────────────────────────────────────────────────────────

/**
 * @returns {{ pecas: {nome:string, cor:string, fatias:{z0:number,z1:number,regiao:any[]}[]}[],
 *             largura:number, altura:number, alturaTotal:number, guia:string[], avisos:string[] }}
 */
export function construirPecas(vetor, parametros) {
  const p = normalizarParametros(parametros);
  // "largura" = largura do DESENHO (sem o contorno da base)
  const bb = vetor.ancoras?.bbox;
  const larguraPx = bb ? Math.max(1, bb[2] - bb[0] + 1) : vetor.w;
  const s = p.largura / larguraPx;               // mm por píxel
  const H = vetor.h;
  const avisos = [];

  // Cores: limpas, sem pequenos detalhes, e sem sobreposições entre si
  // (a cor mais escura tem prioridade nas fronteiras).
  const cores = [];
  let ocupado = [];
  for (const c of vetor.cores) {
    let reg = limparPequenos(uniao(aneisParaPaths(c.aneis, s, H), [], FILL_EO), p.detalhe_min);
    reg = diferenca(reg, ocupado);
    reg = limparPequenos(reg, p.detalhe_min);
    if (!reg.length) continue;
    ocupado = uniao(ocupado, reg);
    cores.push({ hex: c.hex, regiao: reg });
  }
  if (!cores.length) throw new Error('Não sobrou nenhuma cor depois da limpeza de detalhes — baixa o "detalhe mínimo".');

  // Fecha as frestas finas entre cores vizinhas (o potrace traça cada cor à parte e
  // as fronteiras não coincidem ao micrómetro): sem isto apareciam riscos da cor da
  // base entre as cores, e lascas impossíveis de imprimir.
  const G = 0.12;
  const fechado = offset(offset(ocupado, G), -G);
  for (const c of cores) {
    const livre = diferenca(fechado, ocupado);
    if (!livre.length) break;
    const extra = intersecao(offset(c.regiao, G), livre);
    if (extra.length) { c.regiao = uniao(c.regiao, extra); ocupado = uniao(ocupado, extra); }
  }
  for (const c of cores) c.regiao = limparPequenos(c.regiao, Math.max(p.detalhe_min, 0.01));

  // Silhueta da base
  let silhueta = uniao(aneisParaPaths(vetor.silhueta, s, H), [], FILL_EO);
  silhueta = uniao(silhueta, ocupado);
  if (p.preencher_buracos) silhueta = uniao(silhueta.filter(q => C.Clipper.Area(q) > 0));
  silhueta = limparPequenos(silhueta, p.detalhe_min);
  let base2d = offset(silhueta, p.contorno);

  // Furo com aba agarrada ao desenho, fora da arte
  let furo = [];
  if (p.furo_pos !== 'nenhum' && vetor.ancoras?.[p.furo_pos]) {
    const [ax, ay] = vetor.ancoras[p.furo_pos];
    const a = { x: ax * s, y: (H - ay) * s };
    const dir = { cima: [0, 1], esquerda: [-1, 0], direita: [1, 0], 'cima-esquerda': [-0.7071, 0.7071], 'cima-direita': [0.7071, 0.7071] }[p.furo_pos];
    const rFuro = p.furo_d / 2;
    const rAba = rFuro + PAREDE_FURO;
    const dist = Math.max(p.contorno, 0) + rFuro + 1.2;  // parede entre o desenho e o furo
    const cx = a.x + dir[0] * dist, cy = a.y + dir[1] * dist;
    const aba = casco([...circulo(cx, cy, rAba), ...circulo(a.x, a.y, Math.min(rAba, 2.5))]);
    base2d = uniao(base2d, [aba]);
    furo = [circulo(cx, cy, rFuro, 64)];
  }
  base2d = diferenca(base2d, furo);
  const coresR = cores.map(c => ({ ...c, regiao: diferenca(intersecao(c.regiao, base2d), furo) }));

  const eb = p.espessura_base, rv = p.relevo;
  const pecas = [];
  const guia = [];
  let alturaTotal = eb + rv;
  const comp = (h) => `${h.toFixed(2).replace('.', ',')} mm`;

  if (p.modo === 'ams') {
    if (p.acabamento === 'liso') {
      const todasCores = uniao(coresR.flatMap(c => c.regiao));
      pecas.push({ nome: 'base', cor: '#f5f5f5', fatias: [
        { z0: 0, z1: eb, regiao: base2d },
        // abertura de 10 µm: tira pontos onde o anel encosta a si próprio (aresta não-manifold)
        { z0: eb, z1: eb + rv, regiao: offset(offset(diferenca(base2d, todasCores), -0.01), 0.01) },
      ] });
      coresR.forEach((c, i) => pecas.push({ nome: `cor ${i + 1}`, cor: c.hex, fatias: [{ z0: eb, z1: eb + rv, regiao: c.regiao }] }));
    } else {
      pecas.push({ nome: 'base', cor: '#f5f5f5', fatias: [{ z0: 0, z1: eb, regiao: base2d }] });
      coresR.forEach((c, i) => pecas.push({ nome: `cor ${i + 1}`, cor: c.hex, fatias: [{ z0: eb, z1: eb + rv, regiao: c.regiao }] }));
    }
    guia.push(`Ficheiro 3MF com ${pecas.length} partes já montadas: base + ${coresR.length} cor(es).`);
    guia.push('No Bambu Studio / OrcaSlicer / PrusaSlicer, atribui um filamento do AMS a cada parte (as cores detetadas estão indicadas abaixo).');
    pecas.forEach(pc => guia.push(`  • ${pc.nome}: ${pc.cor}`));
  } else if (vetor.ehSvg) {
    // Sem AMS + SVG: base + a cor escolhida em relevo, numa só peça; troca de filamento manual.
    const idx = Math.min(p.cor_relevo, coresR.length) - 1;
    const topo = coresR[idx];
    pecas.push({ nome: 'porta-chaves', cor: '#f5f5f5', fatias: [
      { z0: 0, z1: eb, regiao: base2d },
      { z0: eb, z1: eb + rv, regiao: topo.regiao, cor: topo.hex },  // cor só para a pré-visualização
    ] });
    guia.push(`Peça única: base de ${comp(eb)} + desenho (${topo.hex}) em relevo de ${comp(rv)}.`);
    guia.push(`Imprime a base com o filamento claro e faz a troca de filamento (pausa / M600) na primeira camada acima de ${comp(eb)}, para o filamento escuro.`);
    guia.push('No slicer: clica com o botão direito na barra das camadas à altura indicada → "Adicionar pausa" ou "Mudar filamento".');
  } else {
    // Sem AMS + PNG: base com encaixes + uma peça por cor para colar.
    const enc = p.encaixe, f2 = p.folga / 2;
    const encaixes = uniao(coresR.flatMap(c => offset(c.regiao, f2)));
    pecas.push({ nome: 'base', cor: '#f5f5f5', fatias: [
      { z0: 0, z1: eb - enc, regiao: base2d },
      { z0: eb - enc, z1: eb, regiao: diferenca(base2d, encaixes) },
    ] });
    coresR.forEach((c, i) => {
      const reg = limparPequenos(offset(c.regiao, -f2), p.detalhe_min);
      if (reg.length) pecas.push({ nome: `cor ${i + 1}`, cor: c.hex, fatias: [{ z0: 0, z1: enc + rv, regiao: reg }], solta: true });
    });
    alturaTotal = eb + rv;
    guia.push(`Base com encaixes de ${comp(enc)} + ${pecas.length - 1} peça(s) de cor, cada uma com ${comp(enc + rv)} de altura.`);
    guia.push('Imprime cada peça com a sua cor (cor_N.stl), encaixa-as na base e cola com cola de contacto ou cianoacrilato.');
    guia.push(`Folga entre peça e encaixe: ${comp(p.folga)}. Se ficarem apertadas, aumenta a folga; se ficarem soltas, diminui.`);
    pecas.slice(1).forEach(pc => guia.push(`  • ${pc.nome}: ${pc.cor}`));
    const pequenas = pecas.slice(1).filter(pc => pc.fatias[0].regiao.every(q => Math.abs(C.Clipper.Area(q)) < 6 * ESC * ESC));
    if (pequenas.length) avisos.push(`${pequenas.length} cor(es) só têm peças muito pequenas (< 6 mm²) — difíceis de colar. Aumenta a largura ou o "detalhe mínimo".`);
  }

  // Dimensões finais
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const q of base2d) for (const pt of q) { if (pt.X < minX) minX = pt.X; if (pt.X > maxX) maxX = pt.X; if (pt.Y < minY) minY = pt.Y; if (pt.Y > maxY) maxY = pt.Y; }
  // Centra tudo na origem
  const dx = (minX + maxX) / 2, dy = (minY + maxY) / 2;
  for (const pc of pecas) for (const f of pc.fatias) f.regiao = f.regiao.map(q => q.map(pt => ({ X: pt.X - dx, Y: pt.Y - dy })));

  return {
    pecas,
    largura: (maxX - minX) / ESC,
    altura: (maxY - minY) / ESC,
    alturaTotal,
    guia,
    avisos,
    parametros: p,
  };
}

// ── Malha ────────────────────────────────────────────────────────────────────

/** Fatias → lista plana de triângulos [x,y,z, x,y,z, x,y,z, …] em mm (normais para fora). */
export function fatiasParaTriangulos(fatias) {
  const out = [];
  for (const { z0, z1, regiao } of fatias) {
    if (!regiao.length || z1 - z0 < 1e-6) continue;
    const c = new C.Clipper();
    c.StrictlySimple = true;  // sem vértices encostados → malha fechada sem arestas partilhadas por 4 faces
    c.AddPaths(C.Clipper.CleanPolygons(regiao, 5), C.PolyType.ptSubject, true);
    const arvore = new C.PolyTree();
    c.Execute(C.ClipType.ctUnion, arvore, FILL_NZ, FILL_NZ);

    const visitar = (no) => {
      for (const filho of no.Childs()) {
        if (!filho.IsHole()) {
          const exterior = filho.Contour();
          const buracos = filho.Childs().map(h => h.Contour());
          tampasEParedes(exterior, buracos, z0, z1, out);
        }
        visitar(filho);
      }
    };
    visitar(arvore);
  }
  return out;
}

function tampasEParedes(exterior, buracos, z0, z1, out) {
  const coords = [];
  const furos = [];
  for (const pt of exterior) coords.push(pt.X / ESC, pt.Y / ESC);
  for (const b of buracos) { furos.push(coords.length / 2); for (const pt of b) coords.push(pt.X / ESC, pt.Y / ESC); }
  const tri = earcut(coords, furos, 2);

  // As paredes saem das arestas de fronteira da PRÓPRIA triangulação do topo (e não
  // dos contornos): o earcut descarta vértices colineares, e paredes feitas a partir
  // dos contornos deixariam junções em T → malha não fechada.
  const arestas = new Map(); // "xa,ya|xb,yb" (sentido CCW visto de cima) → [xa,ya,xb,yb]
  const kp = (i) => coords[i * 2] + ',' + coords[i * 2 + 1];
  for (let i = 0; i < tri.length; i += 3) {
    let a = tri[i], b = tri[i + 1], c = tri[i + 2];
    const ax = coords[a * 2], ay = coords[a * 2 + 1], bx = coords[b * 2], by = coords[b * 2 + 1], cx = coords[c * 2], cy = coords[c * 2 + 1];
    if ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) < 0) { const t = b; b = c; c = t; }
    const Bx = coords[b * 2], By = coords[b * 2 + 1], Cx = coords[c * 2], Cy = coords[c * 2 + 1];
    out.push(ax, ay, z1, Bx, By, z1, Cx, Cy, z1);  // topo, normal +z
    out.push(ax, ay, z0, Cx, Cy, z0, Bx, By, z0);  // fundo, normal −z
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const k = kp(u) + '|' + kp(v), inv = kp(v) + '|' + kp(u);
      // Pares (u→v, v→u) anulam-se: aresta interior. Usa coordenadas e não índices,
      // porque um buraco pode tocar no exterior num vértice repetido.
      if (arestas.has(inv)) arestas.delete(inv);
      else arestas.set(k, [coords[u * 2], coords[u * 2 + 1], coords[v * 2], coords[v * 2 + 1]]);
    }
  }
  for (const [ax, ay, bx, by] of arestas.values()) {
    // interior à esquerda de u→v (CCW) → exterior à direita
    out.push(ax, ay, z0, bx, by, z0, bx, by, z1);
    out.push(ax, ay, z0, bx, by, z1, ax, ay, z1);
  }
}
