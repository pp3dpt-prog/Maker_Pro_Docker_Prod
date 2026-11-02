// Gera as formas da etiqueta de mochila e actualiza, a partir delas:
//   lib/formasEtiqueta.json              dados (copiados também para o frontend: lib/formasEtiqueta.json)
//   templates/etiqueta_mochila.scad      bloco entre "@@FORMAS-BEGIN" e "@@FORMAS-END"
//   scripts/update_etiqueta_mochila.sql  scad_template + parâmetro "forma" + ajuste_texto.largura_por_forma
//
// Uso (clipper-lib é só necessário aqui, não em produção):
//   npm i --no-save clipper-lib && node scripts/gerar_formas.mjs
//
// Cada forma é um contorno (polígono) já calculado — uniões de círculos, estrela, etc. —
// para que o OpenSCAD e a pré-visualização do browser usem EXACTAMENTE os mesmos pontos.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ClipperLib = require('clipper-lib');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = 1000;                 // clipper trabalha com inteiros
const ESC = [0.5, 1, 2];        // gama de escala permitida às dimensões manuais (50–200 % da forma base)
const BORDA = 2.5;              // = borda_larg do .scad

// ── primitivas (devolvem caminhos clipper) ─────────────────────────────────
const P = (pts) => pts.map(([x, y]) => ({ X: Math.round(x * S), Y: Math.round(y * S) }));
const circulo = (cx, cy, r, n = 72) =>
  P(Array.from({ length: n }, (_, i) => [cx + r * Math.cos(2 * Math.PI * i / n), cy + r * Math.sin(2 * Math.PI * i / n)]));
function rrect(x, y, w, h, r, n = 16) {
  const pts = [];
  const cantos = [[x + w - r, y + r, -90], [x + w - r, y + h - r, 0], [x + r, y + h - r, 90], [x + r, y + r, 180]];
  for (const [cx, cy, a0] of cantos)
    for (let i = 0; i <= n; i++) {
      const a = (a0 + 90 * i / n) * Math.PI / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  return P(pts);
}
const poligono = (pts) => P(pts);
function uniao(caminhos) {
  const c = new ClipperLib.Clipper(), sol = new ClipperLib.Paths();
  c.AddPaths(caminhos.map((p) => p.slice()), ClipperLib.PolyType.ptSubject, true);
  c.Execute(ClipperLib.ClipType.ctUnion, sol, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return sol;
}
function offset(caminhos, delta, junta = ClipperLib.JoinType.jtMiter) {
  const co = new ClipperLib.ClipperOffset(4, 0.05 * S), sol = new ClipperLib.Paths();
  co.AddPaths(caminhos, junta, ClipperLib.EndType.etClosedPolygon);
  co.Execute(sol, delta * S);
  return sol;
}
const area = (p) => ClipperLib.Clipper.Area(p);
const paraPts = (p) => p.map(({ X, Y }) => [Math.round(X / 10) / 100, Math.round(Y / 10) / 100]); // 2 casas
const caminhoCCW = (p) => (area(p) < 0 ? p.slice().reverse() : p);

// y máximo do contorno em x (intersecção vertical)
function yTopo(pts, x) {
  let m = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    if ((x1 <= x && x2 >= x) || (x2 <= x && x1 >= x)) {
      m = Math.max(m, x1 === x2 ? Math.max(y1, y2) : y1 + (y2 - y1) * (x - x1) / (x2 - x1));
    }
  }
  return m;
}
function dentro(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// ── formas ────────────────────────────────────────────────────────────────
// Coordenadas em mm, canto inferior esquerdo em (0,0). `util` = largura (mm) disponível
// para o texto; `cx`,`cy` = centro do texto e da aba.
function estrela(R, r, cx, cy) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return poligono(pts);
}
function sol(cx, cy, rDisco, rBase, rPonta, n = 12, meio = 11) {
  const c = [circulo(cx, cy, rDisco, 96)];
  for (let k = 0; k < n; k++) {
    const a = (Math.PI / 180) * (90 + 180 / n + k * 360 / n); // raios afastados do topo → o topo fica livre para a aba
    const d = (Math.PI / 180) * meio;
    c.push(poligono([
      [cx + rBase * Math.cos(a - d), cy + rBase * Math.sin(a - d)],
      [cx + rPonta * Math.cos(a), cy + rPonta * Math.sin(a)],
      [cx + rBase * Math.cos(a + d), cy + rBase * Math.sin(a + d)],
    ]));
  }
  return c;
}
function flor(cx, cy, rCentro, dPetala, rPetala, n = 8) {
  const c = [circulo(cx, cy, rCentro, 96)];
  for (let k = 0; k < n; k++) {
    const a = Math.PI / 2 + k * 2 * Math.PI / n;
    c.push(circulo(cx + dPetala * Math.cos(a), cy + dPetala * Math.sin(a), rPetala, 64));
  }
  return c;
}

const DEF = [
  { nome: 'Retangular', cx: 42.5, cy: 25, util: 72,
    caminhos: [rrect(0, 0, 85, 50, 8)] },
  { nome: 'Redonda', cx: 32, cy: 32, util: 46,
    caminhos: [circulo(32, 32, 32, 128)], aba: { ybaseDe: 6 } },
  { nome: 'Nuvem', cx: 42.5, cy: 22, util: 62,
    caminhos: [rrect(0, 0, 85, 24, 12), circulo(22, 27, 15), circulo(42.5, 32, 18), circulo(65, 27, 15)],
    aba: { ybaseDe: 10 } },
  { nome: 'Mochila', cx: 42.5, cy: 24, util: 52,
    caminhos: [rrect(12, 12, 61, 38, 19), rrect(12, 0, 61, 30, 9), rrect(1, 3, 15, 24, 6), rrect(69, 3, 15, 24, 6)],
    aba: { ybaseDe: 4 } },
  { nome: 'Flor', cx: 31, cy: 31, util: 48,
    caminhos: flor(31, 31, 17, 20, 11), aba: { w: 14, ybaseDe: 6 } },
  { nome: 'Sol', cx: 36, cy: 36, util: 42,
    caminhos: sol(36, 36, 24, 21, 36), aba: { w: 14, ybaseDe: 8 } },
  { nome: 'Estrela', cx: 34, cy: 34, util: 34,
    caminhos: [estrela(34, 17, 34, 34)], aba: { w: 16, r: 8, ybaseDe: 4, dhy: 4 } },
  { nome: 'Livro', cx: 42.5, cy: 25, util: 66,
    caminhos: [rrect(0, 0, 46, 50, 10), rrect(39, 0, 46, 50, 10)], aba: { ybaseDe: 6 } },
  { nome: 'Lápis', cx: 52, cy: 19, util: 54,
    caminhos: [rrect(14, 0, 71, 38, 6), poligono([[0, 19], [20, 3], [20, 35]])], aba: { ybaseDe: 2 } },
];

const formas = [];
for (const d of DEF) {
  const u = uniao(d.caminhos);
  const exterior = u.filter((p) => area(p) > 0);
  if (exterior.length !== 1 || u.length !== 1) throw new Error(`${d.nome}: esperava 1 contorno sem buracos, veio ${u.length}`);
  let outer = caminhoCCW(exterior[0]);

  const pts = paraPts(outer);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const topo = yTopo(pts, d.cx);
  const a = { w: 18, r: 4, ybaseDe: 2, dhy: 6, ...(d.aba || {}) };
  const dtopo = a.r === 4 ? 6 : a.r;            // do centro do furo ao topo da aba
  // recuo da aba para dentro do corpo: o mínimo (>= ybaseDe) com que assenta em toda a gama
  // de escalas dos sliders (50–200 %), para que a aba nunca fique solta
  const assenta = (de) => !(a.r * 2 < a.w) || ESC.every((sx) => ESC.every((sy) => {
    const sp = pts.map(([x, y]) => [x * sx, y * sy]);
    return [d.cx * sx - a.w / 2 + 0.5, d.cx * sx + a.w / 2 - 0.5].every((x) => dentro(sp, x, topo * sy - de + 0.2));
  }));
  let de = a.ybaseDe;
  while (!assenta(de) && de < 30) de += 1;
  if (!assenta(de)) throw new Error(`${d.nome}: a aba não assenta no corpo`);
  const aba = { w: a.w, r: a.r, de, dhy: a.dhy, dtopo };
  if (aba.de + aba.dhy + dtopo < 2 * a.r) throw new Error(`${d.nome}: aba demasiado baixa para r=${a.r}`);

  formas.push({
    nome: d.nome, cx: d.cx, cy: d.cy, util: d.util, topo: Math.round(topo * 100) / 100,
    bw: Math.round((Math.max(...xs) - Math.min(...xs)) * 100) / 100, bh: Math.round((Math.max(...ys) - Math.min(...ys)) * 100) / 100,
    aba, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    outer: pts,
  });
}

fs.writeFileSync(path.join(ROOT, 'lib/formasEtiqueta.json'), JSON.stringify({ borda: BORDA, formas }) + '\n');

// ── bloco SCAD ──────────────────────────────────────────────────────────────
const num = (n) => String(n);
const lista = (pts) => '[' + pts.map(([x, y]) => `[${num(x)},${num(y)}]`).join(',') + ']';
const scadFormas = formas.map((f) =>
  `  ["${f.nome}", ${f.cx}, ${f.cy}, ${f.topo}, ${f.bw}, ${f.bh}, ${f.aba.w}, ${f.aba.r}, ${f.aba.de}, ${f.aba.dhy}, ${f.aba.dtopo},\n` +
  `   ${lista(f.outer)}]`).join(',\n');
const bloco = `// @@FORMAS-BEGIN (gerado por scripts/gerar_formas.mjs — não editar à mão)
// [nome, cx, cy, topo_em_cx, largura_base, altura_base, aba_w, aba_r, aba_recuo, furo_acima_topo, aba_acima_furo, contorno]
// (largura_pct/altura_pct escalam x e y; a borda é calculada no OpenSCAD com offset)
FORMAS = [
${scadFormas}
];
// @@FORMAS-END`;

const scadPath = path.join(ROOT, 'templates/etiqueta_mochila.scad');
let scad = fs.readFileSync(scadPath, 'utf8');
if (!scad.includes('@@FORMAS-BEGIN')) throw new Error('marcadores @@FORMAS-BEGIN/END em falta no template');
scad = scad.replace(/\/\/ @@FORMAS-BEGIN[\s\S]*?\/\/ @@FORMAS-END/, () => bloco);
fs.writeFileSync(scadPath, scad);

// ── SQL ───────────────────────────────────────────────────────────────────
const sqlPath = path.join(ROOT, 'scripts/update_etiqueta_mochila.sql');
let sql = fs.readFileSync(sqlPath, 'utf8');
sql = sql.replace(/(scad_template = \$scad\$\n)[\s\S]*?(\n\$scad\$)/, (_, a, b) => a + scad.replace(/\n$/, '') + b);
sql = sql.replace(/(generation_schema = \$json\$)([\s\S]*?)(\$json\$::jsonb)/, (_, a, js, c) => {
  const schema = JSON.parse(js);
  const params = schema.parameters;
  params.forma = {
    ui: { label: 'Forma', widget: 'select', options: formas.map((f) => f.nome) },
    order: 4, default: 'Retangular',
  };
  // sliders em % da forma base (50–200); o editor mostra os mm resultantes ao lado
  const medida = (label, order, chave) => ({
    ui: {
      label, widget: 'slider', step: 1,
      mm_por_forma: { param: 'forma', valores: Object.fromEntries(formas.map((f) => [f.nome, f[chave]])) },
    },
    min: 50, max: 200, unit: '%', order, default: 100,
  });
  delete params.largura_mm; delete params.altura_mm;
  params.largura_pct = medida('Largura da placa', 5, 'bw');
  params.altura_pct = medida('Altura da placa', 6, 'bh');
  params.fontSize.order = 7;
  params.fonte.order = 8;
  // mantém a ordem das chaves legível
  const ordenado = Object.fromEntries(Object.entries(params).sort((x, y) => (x[1].order ?? 0) - (y[1].order ?? 0)));
  schema.parameters = ordenado;
  // a largura útil acompanha a largura da placa: factor = largura_pct / 100
  delete schema.ajuste_texto.largura_mm_param; delete schema.ajuste_texto.largura_base_por_forma;
  schema.ajuste_texto.largura_pct_param = 'largura_pct';
  schema.ajuste_texto.largura_por_forma = Object.fromEntries(formas.map((f) => [f.nome, f.util]));
  return a + JSON.stringify(schema, null, 2) + c;
});
fs.writeFileSync(sqlPath, sql);

for (const f of formas)
  console.log(f.nome.padEnd(11), 'bbox', f.bbox.map((n) => n.toFixed(1)).join(','), 'pts', f.outer.length, 'aba', JSON.stringify(f.aba));
