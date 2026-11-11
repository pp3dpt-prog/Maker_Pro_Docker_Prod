// Gera as formas 2D dos modelos de Natal da família "Decoração" e actualiza, a partir delas:
//   lib/natalDeco.json                          (copiado também para o frontend: lib/natalDeco.json)
//   templates/decoracao/partes/_natal_formas.scad
// e, com --svg <ficheiro>, uma folha com todas as formas (para ver se ficaram bem).
//
// Uso: node scripts/gerar_natal_deco.mjs [--svg folha.svg]
//
// Coordenadas em mm à escala nominal, y para cima. Cada forma é uma lista de contornos
// (exteriores no sentido anti-horário, buracos no horário — no OpenSCAD basta a regra par-ímpar).
//   haste   haste de rena (uma; a outra é o espelho), base em (0,0), cresce para +x e +y
//   orelha  orelha de rena, base em (0,0), aponta para +x
//   asa     asa de anjo (a direita; a esquerda é o espelho), raiz em (0,0)
//   estrela estrela de 5 pontas centrada em (0,0), raio 10
//   cenas   silhuetas assentes em y = 0 (inclui a faixa de chão de y = -3 a 0), centradas em x,
//           com 100 mm de largura
//   molduras  { fora, dentro } — contorno exterior e interior da moldura (anel de 4 mm), base em y = 0

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ClipperLib = require('clipper-lib');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = 1000;

// ── primitivas ─────────────────────────────────────────────────────────────
const C = (pts) => pts.map(([x, y]) => ({ X: Math.round(x * S), Y: Math.round(y * S) }));
const D = (p) => p.map(({ X, Y }) => [X / S, Y / S]);
const rad = (g) => (g * Math.PI) / 180;
const circPts = (cx, cy, r, n = 72, a0 = 0, a1 = 360) => {
  const fechado = Math.abs(a1 - a0) >= 360;
  const m = fechado ? n : Math.max(2, Math.round((n * Math.abs(a1 - a0)) / 360));
  return Array.from({ length: fechado ? m : m + 1 }, (_, i) => {
    const a = rad(a0 + ((a1 - a0) * i) / m);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
};
const elipsePts = (cx, cy, rx, ry, rot = 0, n = 60) => Array.from({ length: n }, (_, i) => {
  const t = (2 * Math.PI * i) / n, x = rx * Math.cos(t), y = ry * Math.sin(t), c = Math.cos(rad(rot)), s = Math.sin(rad(rot));
  return [cx + x * c - y * s, cy + x * s + y * c];
});
const circulo = (cx, cy, r) => C(circPts(cx, cy, r));
const elipse = (cx, cy, rx, ry, rot) => C(elipsePts(cx, cy, rx, ry, rot));
const poligono = (pts) => C(pts);
const rect = (x0, y0, x1, y1) => C([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
const estrelaPts = (cx, cy, R, r, n = 5, a0 = 90) =>
  Array.from({ length: 2 * n }, (_, i) => { const a = rad(a0 + (i * 180) / n), rr = i % 2 ? r : R; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; });
function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return C([...lo.slice(0, -1), ...up.slice(0, -1)]);
}
const hullC = (...cs) => hull(cs.flatMap(([x, y, r]) => circPts(x, y, r, 48)));
function traco(pts, w) {
  const co = new ClipperLib.ClipperOffset(2, 0.01 * S), sol = new ClipperLib.Paths();
  co.AddPath(C(pts), ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenRound);
  co.Execute(sol, (w / 2) * S);
  return sol;
}
const norm = (cams) => cams.map((p) => (ClipperLib.Clipper.Area(p) < 0 ? p.slice().reverse() : p));
function bool(tipo, a, b = []) {
  const c = new ClipperLib.Clipper(), sol = new ClipperLib.Paths();
  c.AddPaths(a, ClipperLib.PolyType.ptSubject, true);
  if (b.length) c.AddPaths(b, ClipperLib.PolyType.ptClip, true);
  c.Execute(tipo, sol, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return sol;
}
const uniao = (cams) => bool(ClipperLib.ClipType.ctUnion, norm(cams));
const dif = (a, b) => bool(ClipperLib.ClipType.ctDifference, a, norm(b));
const inter = (a, b) => bool(ClipperLib.ClipType.ctIntersection, a, b);
function off(cams, d) {
  const co = new ClipperLib.ClipperOffset(2, 0.01 * S), sol = new ClipperLib.Paths();
  co.AddPaths(cams, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  co.Execute(sol, d * S);
  return sol;
}
const arredondar = (cams, rFora, rDentro = rFora) => off(off(off(off(cams, -rFora), rFora), rDentro), -rDentro);
const espelhoX = (pts) => pts.map(([x, y]) => [-x, y]);
const mover = (cams, dx, dy, f = 1, esp = false) => cams.map((p) => p.map(({ X, Y }) => ({ X: Math.round((esp ? -X : X) * f + dx * S), Y: Math.round(Y * f + dy * S) })));
const caixa = (cams) => {
  const xs = cams.flatMap((p) => p.map((q) => q.X / S)), ys = cams.flatMap((p) => p.map((q) => q.Y / S));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

// ── peças das figuras ──────────────────────────────────────────────────────

// haste de rena: tronco que sai para fora e para cima, com 3 pontas viradas para cima
// (todas as arestas de baixo a mais de 40° da horizontal, para imprimir sem suportes)
const HASTE = arredondar(uniao([
  ...traco([[0, 0], [5, 9], [11, 18], [15, 28], [16, 36]], 5),
  ...traco([[6, 10], [3, 20], [3, 25]], 3.6),
  ...traco([[11, 18], [19, 24], [23, 31]], 3.6),
  ...traco([[14.5, 27], [10.5, 34], [10, 38]], 3.2),
]), 0.4, 1.2);

// orelha: folha virada para +x
const ORELHA = uniao([poligono([...elipsePts(7, 0, 7, 2.8, 0, 40)])]);

// asa de anjo (direita): penas em leque a partir da raiz (0,0); todas apontam a mais de 40° da
// horizontal para a asa (impressa na vertical) não ter bordos de baixo deitados
const ASA = (() => {
  const penas = [[88, 36, 7.5], [72, 40, 8], [57, 37, 8], [44, 30, 7.5]];
  const els = penas.map(([a, l, w]) => elipse(Math.cos(rad(a)) * l * 0.5, Math.sin(rad(a)) * l * 0.5, l * 0.5, w * 0.5, a));
  const miolo = hull([...circPts(0, 0, 4, 32), ...penas.map(([a, l]) => [Math.cos(rad(a)) * l * 0.55, Math.sin(rad(a)) * l * 0.55])]);
  return arredondar(uniao([...els, miolo]), 0.2, 1.5);
})();

const ESTRELA = uniao([poligono(estrelaPts(0, 0, 10, 4.4))]);

// ── silhuetas das cenas (largura livre; normalizadas a 100 mm no fim) ───────
// rena de perfil virada para a direita, cascos em y = 0
function renaPerfil() {
  return arredondar(uniao([
    elipse(0, 30, 19, 9, 0),
    elipse(13, 31, 9, 9.5, 0),
    ...traco([[15, 34], [23, 49]], 8),
    elipse(27, 51.5, 6.5, 4.4, -18),
    elipse(33, 48.5, 4.6, 2.8, -25),
    elipse(21.5, 55, 3.6, 1.4, 35),
    ...traco([[16, 26], [17.5, 13], [17, 0.8]], 3.4),
    ...traco([[10, 25], [11, 13], [12.5, 0.8]], 3.4),
    ...traco([[-13, 27], [-16, 14], [-14, 0.8]], 3.8),
    ...traco([[-8, 25], [-10.5, 13], [-8.5, 0.8]], 3.6),
    elipse(-19.5, 35, 3.4, 1.8, 35),
    ...traco([[25, 55], [22, 63], [17, 70], [12, 73.5]], 2.4),
    ...traco([[21.7, 63.5], [25.5, 71]], 2),
    ...traco([[17, 70], [19, 77]], 2),
    ...traco([[28, 54.5], [30.5, 62.5], [29, 70]], 2.2),
    ...traco([[30.4, 62], [35, 67]], 1.9),
  ]), 0.3, 0.9);
}
function pinheiro(cx, h, w = h * 0.62) {
  const pts = [];
  const n = 4, tr = h * 0.12, y0 = tr;
  for (let i = 0; i < n; i++) {
    const yb = y0 + ((h - y0) * i * 0.8) / n, yt = yb + (h - y0) * (0.42 - i * 0.03) + (i === n - 1 ? (h - y0) * 0.3 : 0);
    const ww = (w / 2) * (1 - i / (n + 0.6));
    pts.push(poligono([[cx - ww, yb], [cx + ww, yb], [cx, Math.min(h, yt)]]));
  }
  pts.push(rect(cx - h * 0.05, -0.5, cx + h * 0.05, y0 + 1));
  return uniao(pts);
}
const CHAO = (x0, x1) => rect(x0, -3, x1, 0.6);

const CENAS = {};
// Renas, Presépio e Trenó: desenhados com curvas em scripts/natal_cenas/ (as versões antigas, com
// elipses e traços, ficam abaixo mas são substituídas no fim)
import { CENAS as CENAS_CURVAS } from './natal_cenas/cenas.mjs';

CENAS['Renas'] = (() => {
  const r = renaPerfil();
  return uniao([
    ...mover(r, -14, 0, 1),
    ...mover(r, 26, 0, 0.62, true),
    ...pinheiro(-42, 46), ...pinheiro(46, 34),
    CHAO(-55, 58),
  ]);
})();

CENAS['Pinheiros'] = uniao([
  ...pinheiro(0, 70), ...pinheiro(-28, 50), ...pinheiro(28, 54), ...pinheiro(-48, 32), ...pinheiro(47, 30),
  ...mover(ESTRELA, 0, 71, 0.55),   // a tocar na ponta da árvore do meio
  CHAO(-60, 60),
]);

CENAS['Presépio'] = (() => {
  const maria = [hullC([-30, 4, 7], [-17, 3, 3.5], [-22, 20, 6.5], [-17, 27, 4.5]), circulo(-15.5, 31, 5.6),
    hullC([-17.5, 33, 6.5], [-22, 24, 5])];
  const jose = [hullC([28, 4, 6.5], [19, 3, 3.5], [25, 30, 6.5], [21, 34, 5]), circulo(21.5, 42, 5.6),
    hullC([22, 44, 6.4], [26, 36, 5]), ...traco([[33, 0.5], [33, 48]], 2.2),
    ...traco([[33, 48], [33.5, 52], [31, 54], [28.6, 52]], 2.2), ...traco([[24, 33], [33, 35]], 3.2)];
  const mangedoura = [...traco([[-7, 0.5], [4, 11]], 2.4), ...traco([[7, 0.5], [-4, 11]], 2.4),
    poligono([[-10, 9], [10, 9], [8, 14.5], [-8, 14.5]]), elipse(-1, 15.5, 6.5, 3.2, 0), circulo(5.5, 17.2, 2.8)];
  const estrela = [poligono(estrelaPts(0, 64, 8, 3.2, 5)), ...traco([[0, 62], [0, 17]], 1.8)];
  const teto = [...traco([[-42, 40], [0, 56], [42, 40]], 3), ...traco([[-38, 0.5], [-38, 42]], 3), ...traco([[38, 0.5], [38, 42]], 3)];
  return arredondar(uniao([...maria, ...jose, ...mangedoura, ...estrela, ...teto, CHAO(-46, 46)]), 0.3, 0.8);
})();

CENAS['Trenó'] = (() => {
  const r = renaPerfil();
  const treno = [
    ...traco([[-36, 1.2], [-2, 1.2], [4, 3], [7, 8], [5, 12], [1.5, 10]], 2.4),
    ...traco([[-30, 1], [-30, 7]], 2.2), ...traco([[-10, 1], [-10, 7]], 2.2),
    poligono([[-36, 6], [-2, 6], [3, 13], [1, 19], [-4, 15], [-30, 15], [-36, 22], [-39, 19]]),
  ];
  const pai = [hullC([-20, 16, 7], [-16, 24, 6]), circulo(-15, 32.5, 4.5), poligono([[-20, 34], [-10.5, 35], [-19, 44]]),
    circulo(-20, 44, 2), elipse(-30, 24, 6.5, 8, -10)];
  const redeas = [...traco([[-11, 26], [8, 30], [26, 29], [42, 24]], 1.6)];   // até ao peito da rena (ligadas)
  return arredondar(uniao([...treno, ...pai, ...redeas, ...mover(r, 34, 0, 0.72), CHAO(-46, 66)]), 0.3, 0.8);
})();

CENAS['Casinhas'] = (() => {
  const casa = (cx, w, h, hr, chamine = false) => {
    const corpo = uniao([rect(cx - w / 2, 0, cx + w / 2, h), poligono([[cx - w / 2 - 3, h], [cx + w / 2 + 3, h], [cx, h + hr]]),
      ...(chamine ? [rect(cx + w * 0.18, h + hr * 0.3, cx + w * 0.34, h + hr * 0.95)] : [])]);
    const jan = [rect(cx - w * 0.32, h * 0.45, cx - w * 0.08, h * 0.75), rect(cx + w * 0.08, h * 0.45, cx + w * 0.32, h * 0.75),
      rect(cx - w * 0.11, 0.6 + 1.6, cx + w * 0.11, h * 0.36)];
    return { corpo, jan };
  };
  const cs = [casa(-30, 26, 26, 16, true), casa(2, 32, 36, 20), casa(34, 22, 22, 13, true)];
  return dif(uniao([...cs.flatMap((c) => c.corpo), ...pinheiro(-52, 28), ...pinheiro(53, 32), CHAO(-60, 60)]), cs.flatMap((c) => c.jan));
})();

// ── molduras (anel de 4 mm) ────────────────────────────────────────────────
const ANEL = 4;
const MOLDURAS = {};
{
  const circ = [circulo(0, 50, 50)];
  const est = arredondar([poligono(estrelaPts(0, 46, 60, 33))], 0, 3);
  const arco = uniao([rect(-38, 0, 38, 58), circulo(0, 58, 38)]);
  for (const [nome, fora] of [['Círculo', circ], ['Estrela', est], ['Arco', arco]]) {
    const [, y0] = caixa(fora);
    const f = mover(fora, 0, -y0);
    MOLDURAS[nome] = { fora: f, dentro: off(f, -ANEL) };
  }
}

// ── árvore plana com nomes (largura nominal 100 mm, tronco assente em y = 0) ──
// 4 ramos sobrepostos; o nome de cada ramo fica na faixa à vista (a de baixo, antes do ramo
// seguinte). ARVORE_ZONAS: [cx, cy, largura útil, tamanho da letra] por ramo, de baixo para cima.
const ARVORE_RAMOS = [0, 1, 2, 3].map((i) => {
  const hw = 50 - 9.5 * i, yb = 11 + 24 * i, alt = i === 3 ? 40 : 36, ht = i === 3 ? 0 : hw * 0.3;
  return { hw, yb, alt, ht };
});
const ARVORE = (() => {
  const partes = [rect(-8, 0, 8, 14)];
  for (const { hw, yb, alt, ht } of ARVORE_RAMOS)
    partes.push(poligono(ht > 0 ? [[-hw, yb], [hw, yb], [ht, yb + alt], [-ht, yb + alt]] : [[-hw, yb], [hw, yb], [0, yb + alt]]));
  const r3 = ARVORE_RAMOS[3];
  partes.push(poligono(estrelaPts(0, r3.yb + r3.alt + 6, 11, 4.8)));
  return arredondar(uniao(partes), 0.6, 1.6);
})();
const ARVORE_ZONAS = ARVORE_RAMOS.map(({ hw, yb, alt, ht }, i) => {
  const tam = 10.5 - 0.5 * i, cy = yb + 11;
  const meia = hw - ((hw - ht) * (cy + tam * 0.55 - yb)) / alt;
  return [0, cy, Math.round((2 * meia - 8) * 10) / 10, tam];
});

for (const [nome, cams] of Object.entries(CENAS_CURVAS)) CENAS[nome] = cams;

// ── normalizar e exportar ──────────────────────────────────────────────────
function simplificar(pts, tol, fechado) {
  if (pts.length < 4) return pts;
  if (fechado) {
    let m = 0, d = -1;
    pts.forEach((p, i) => { const q = Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]); if (q > d) { d = q; m = i; } });
    const a = simplificar(pts.slice(0, m + 1), tol, false), b = simplificar([...pts.slice(m), pts[0]], tol, false);
    return [...a.slice(0, -1), ...b.slice(0, -1)];
  }
  const [x1, y1] = pts[0], [x2, y2] = pts[pts.length - 1], L = Math.hypot(x2 - x1, y2 - y1) || 1e-9;
  let m = 0, d = -1;
  for (let i = 1; i < pts.length - 1; i++) {
    const q = Math.abs((x2 - x1) * (y1 - pts[i][1]) - (x1 - pts[i][0]) * (y2 - y1)) / L;
    if (q > d) { d = q; m = i; }
  }
  if (d <= tol) return [pts[0], pts[pts.length - 1]];
  return [...simplificar(pts.slice(0, m + 1), tol, false).slice(0, -1), ...simplificar(pts.slice(m), tol, false)];
}
const r1 = (v) => Math.round(v * 10) / 10 || 0;
const exportar = (cams, f = 1, dx = 0, dy = 0) => cams
  .map((p) => simplificar(D(p).map(([x, y]) => [(x + dx) * f, (y + dy) * f]), 0.06, true).map(([x, y]) => [r1(x), r1(y)]))
  .filter((p) => p.length >= 3);

const cenas = {};
for (const [nome, cams] of Object.entries(CENAS)) {
  const [x0, , x1] = caixa(cams), f = 100 / (x1 - x0), dx = -(x0 + x1) / 2;
  const c = exportar(cams, f, dx, 0);
  const [, , , y1] = caixa(C(c.flat()).length ? [C(c.flat())] : cams);
  cenas[nome] = { contornos: c, largura: 100, altura: r1(y1) };
}
const molduras = {};
for (const [nome, { fora, dentro }] of Object.entries(MOLDURAS)) {
  const [x0, y0, x1, y1] = caixa(fora);
  molduras[nome] = { fora: exportar(fora)[0], dentro: exportar(dentro)[0], largura: r1(x1 - x0), altura: r1(y1 - y0) };
}
const dados = {
  haste: exportar(HASTE), orelha: exportar(ORELHA), asa: exportar(ASA), estrela: exportar(ESTRELA),
  cenas, molduras, anel: ANEL,
  arvore: exportar(ARVORE), arvore_zonas: ARVORE_ZONAS,
};
fs.writeFileSync(path.join(ROOT, 'lib/natalDeco.json'), JSON.stringify(dados));

// .scad: listas de contornos (polygon com paths, regra par-ímpar)
const L = (v) => JSON.stringify(v);
const scad = [
  '// Formas 2D dos modelos de Natal (gerado por scripts/gerar_natal_deco.mjs — não editar à mão)',
  `NATAL_HASTE = ${L(dados.haste)};`,
  `NATAL_ORELHA = ${L(dados.orelha)};`,
  `NATAL_ASA = ${L(dados.asa)};`,
  `NATAL_ESTRELA = ${L(dados.estrela)};`,
  `NATAL_CENAS = [${Object.entries(cenas).map(([n, c]) => `[${L(n)}, ${L(c.contornos)}, ${c.altura}]`).join(',\n  ')}];`,
  `NATAL_ARVORE = ${L(dados.arvore)};`,
  `NATAL_ARVORE_ZONAS = ${L(dados.arvore_zonas)};`,
  `NATAL_MOLDURAS = [${Object.entries(molduras).map(([n, m]) => `[${L(n)}, ${L(m.fora)}, ${L(m.dentro)}, ${m.largura}, ${m.altura}]`).join(',\n  ')}];`,
  '',
].join('\n');
fs.writeFileSync(path.join(ROOT, 'templates/decoracao/partes/_natal_formas.scad'), scad);
console.log('scad', (scad.length / 1024).toFixed(1), 'KB');
for (const [n, c] of Object.entries(cenas)) console.log(n.padEnd(10), c.largura, '×', c.altura, 'mm,', c.contornos.length, 'contornos,', c.contornos.reduce((s, p) => s + p.length, 0), 'pontos');

// ── folha SVG ──
const i = process.argv.indexOf('--svg');
if (i > 0) {
  const pth = (cs) => cs.map((p) => 'M' + p.map(([x, y]) => `${x.toFixed(2)},${(-y).toFixed(2)}`).join('L') + 'Z').join('');
  let out = '', k = 0;
  const pos = () => { const ox = (k % 4) * 130 + 65, oy = Math.floor(k / 4) * 130 + 115; k++; return [ox, oy]; };
  for (const [n, c] of Object.entries(cenas)) {
    const [ox, oy] = pos();
    out += `<g transform="translate(${ox},${oy})"><path d="${pth(c.contornos)}" fill="#7a4a24" fill-rule="evenodd"/><text y="12" font-size="6" text-anchor="middle">${n}</text></g>`;
  }
  for (const [n, m] of Object.entries(molduras)) {
    const [ox, oy] = pos();
    out += `<g transform="translate(${ox},${oy})"><path d="${pth([m.fora, m.dentro])}" fill="#c9a227" fill-rule="evenodd"/><text y="12" font-size="6" text-anchor="middle">${n}</text></g>`;
  }
  for (const [n, c] of [['arvore', dados.arvore], ['haste', dados.haste], ['orelha', dados.orelha], ['asa', dados.asa], ['estrela', dados.estrela]]) {
    const [ox, oy] = pos();
    out += `<g transform="translate(${ox},${oy - 30}) scale(2)"><path d="${pth(c)}" fill="#555" fill-rule="evenodd"/></g><text x="${ox}" y="${oy + 12}" font-size="6" text-anchor="middle">${n}</text>`;
  }
  const rows = Math.ceil(k / 4);
  fs.writeFileSync(process.argv[i + 1], `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 ${rows * 130}" width="1040" height="${rows * 260}"><rect width="520" height="${rows * 130}" fill="#f5f0e6"/>${out}</svg>`);
}
