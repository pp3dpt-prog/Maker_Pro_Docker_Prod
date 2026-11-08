// Gera as formas dos "Enfeites de Natal" (placa a 2 cores: base + contorno e detalhes em relevo)
// e actualiza, a partir delas:
//   lib/enfeitesNatal.json             dados (copiados também para o frontend: lib/enfeitesNatal.json)
//   templates/enfeite_natal.scad       bloco entre "@@FORMAS-BEGIN" e "@@FORMAS-END"
// e, com --svg <ficheiro>, uma folha com as 12 formas compostas (para ver se ficaram bem).
//
// Uso: node scripts/gerar_enfeites.mjs [--svg folha.svg]
//
// Cada forma tem (coordenadas em mm, y para cima, para um enfeite de 80 mm — o maior lado,
// contando com a argola; o tamanho escolhido escala tudo menos a largura das linhas):
//   sil      contorno da placa (polígono anti-horário, sem buracos)
//   linhas   linhas de detalhe em relevo (polilinhas; fechadas = 1.º ponto repetido no fim)
//   pontos   pintas em relevo [x, y, r]
//   argola   centro do furo para pendurar
//   nome     zona do nome [x, y, largura, tamanho da letra, rotação°] (ou null: a forma não leva nome)
//   sem_nome índices das linhas / pontos que saem quando há nome (estão na zona do nome)
// O contorno em relevo (a linha que acompanha a borda) não está aqui: é calculado na hora,
// como offset da silhueta (OpenSCAD offset(r) / clipper jtRound na pré-visualização).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ClipperLib = require('clipper-lib');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = 1000;
const NOMINAL = 80;           // maior lado do enfeite (mm) com tamanho = 80
const R_ABA = 5, R_FURO = 2.3; // argola (mm, não escalam) — iguais ao .scad e ao frontend

// ── primitivas ─────────────────────────────────────────────────────────────
const C = (pts) => pts.map(([x, y]) => ({ X: Math.round(x * S), Y: Math.round(y * S) }));
const D = (p) => p.map(({ X, Y }) => [X / S, Y / S]);
const rad = (g) => (g * Math.PI) / 180;
const circPts = (cx, cy, r, n = 96, a0 = 0, a1 = 360) => {
  const fechado = Math.abs(a1 - a0) >= 360;
  const m = fechado ? n : Math.max(2, Math.round((n * Math.abs(a1 - a0)) / 360));
  return Array.from({ length: fechado ? m : m + 1 }, (_, i) => {
    const a = rad(a0 + ((a1 - a0) * i) / m);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
};
const elipsePts = (cx, cy, rx, ry, rot = 0, n = 72) => Array.from({ length: n }, (_, i) => {
  const t = (2 * Math.PI * i) / n, x = rx * Math.cos(t), y = ry * Math.sin(t), c = Math.cos(rad(rot)), s = Math.sin(rad(rot));
  return [cx + x * c - y * s, cy + x * s + y * c];
});
const fechar = (pts) => [...pts, pts[0]];
const circulo = (cx, cy, r) => C(circPts(cx, cy, r));
const elipse = (cx, cy, rx, ry, rot) => C(elipsePts(cx, cy, rx, ry, rot));
const poligono = (pts) => C(pts);
const rrect = (x0, y0, x1, y1, r) => {
  const pts = [];
  for (const [cx, cy, a] of [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]])
    pts.push(...circPts(cx, cy, r, 64, a, a + 90));
  return C(pts);
};
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
// traço (polilinha aberta) com pontas redondas
function traco(pts, w) {
  const co = new ClipperLib.ClipperOffset(2, 0.01 * S), sol = new ClipperLib.Paths();
  co.AddPath(C(pts), ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenRound);
  co.Execute(sol, (w / 2) * S);
  return sol;
}
function uniao(cams, normalizar = true) {
  const c = new ClipperLib.Clipper(), sol = new ClipperLib.Paths();
  // cada caminho no sentido anti-horário: com sentidos misturados a regra nonzero abria buracos nas sobreposições
  c.AddPaths(normalizar ? cams.map((p) => (ClipperLib.Clipper.Area(p) < 0 ? p.slice().reverse() : p)) : cams, ClipperLib.PolyType.ptSubject, true);
  c.Execute(ClipperLib.ClipType.ctUnion, sol, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return sol;
}
function off(cams, d) {
  const co = new ClipperLib.ClipperOffset(2, 0.01 * S), sol = new ClipperLib.Paths();
  co.AddPaths(cams, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  co.Execute(sol, d * S);
  return sol;
}
const arredondar = (cams, rFora, rDentro = rFora) => off(off(off(off(cams, -rFora), rFora), rDentro), -rDentro); // pontas e cantos
const espelhoX = (pts) => pts.map(([x, y]) => [-x, y]);
const onda = (x0, x1, y, amp, per, n = 64) => Array.from({ length: n + 1 }, (_, i) => { const x = x0 + ((x1 - x0) * i) / n; return [x, y + amp * Math.sin((2 * Math.PI * (x - x0)) / per)]; });
const zigue = (a, b, amp, n) => {   // zigue-zague de a a b
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  return Array.from({ length: n + 1 }, (_, i) => { const t = i / n, s = i % 2 ? amp : -amp; return [a[0] + dx * t + nx * s, a[1] + dy * t + ny * s]; });
};

// ── formas (desenhadas à mão; a escala é normalizada a seguir) ──────────────
const DEF = [];

// Rena (cabeça com hastes)
{
  const haste = [[-7, 47], [-11, 57], [-14, 67], [-13, 79]];
  const ramo1 = [[-11.5, 59], [-21, 63], [-26, 70]];
  const ramo2 = [[-14, 69], [-21, 75]];
  const cams = [
    hull([...circPts(0, 34, 17), ...circPts(0, 15, 11)]),
    elipse(-20, 41, 10, 5, -25), elipse(20, 41, 10, 5, 25),
    ...[haste, ramo1, ramo2].flatMap((l) => [...traco(l, 6.5), ...traco(espelhoX(l), 6.5)]),
  ];
  DEF.push({
    nome: 'Rena', sil: arredondar(uniao(cams), 0.8, 1.6),
    linhas: [fechar(elipsePts(-20, 41, 5.5, 2, -25)), fechar(elipsePts(20, 41, 5.5, 2, 25)), fechar(circPts(0, 14.5, 5.5, 48))],
    pontos: [[-7, 31, 2.2], [7, 31, 2.2]],
    argola: [0], nome_zona: [0, 41, 20, 4.8, 0], sem_nome: { linhas: [], pontos: [] },
  });
}

// Boneco de gengibre
{
  const cams = [
    circulo(0, 64, 12.5),
    ...traco([[0, 50], [0, 30]], 24),
    ...traco([[-24, 41], [-12, 46.5], [12, 46.5], [24, 41]], 12.5),
    ...traco([[-5, 30], [-14, 6]], 13), ...traco([[5, 30], [14, 6]], 13),
  ];
  const perna = (s) => { const a = [5 * s, 30], b = [14 * s, 6], t = 0.78, c = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const ux = (b[0] - a[0]) / Math.hypot(b[0] - a[0], b[1] - a[1]), uy = (b[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1]);
    return zigue([c[0] + uy * 8, c[1] - ux * 8], [c[0] - uy * 8, c[1] + ux * 8], 1.4, 6); };
  DEF.push({
    nome: 'Boneco de gengibre', sil: arredondar(uniao(cams), 0.5, 3),
    linhas: [circPts(0, 65, 6.5, 48, 205, 335), zigue([-19.5, 36], [-17.5, 52], 1.4, 6), zigue([19.5, 36], [17.5, 52], 1.4, 6), perna(-1), perna(1)],
    pontos: [[-4.5, 67, 1.8], [4.5, 67, 1.8], [0, 46, 2], [0, 38.5, 2], [0, 31, 2]],
    argola: [0], nome_zona: [0, 38.5, 20, 4.8, 0], sem_nome: { linhas: [], pontos: [2, 3, 4] },
  });
}

// Árvore de Natal
{
  const dir = [[0, 72], [15, 54], [8, 54], [23, 35], [14, 35], [31, 15], [6, 15], [6, 4]];
  const pts = [...dir, ...espelhoX(dir.slice(1)).reverse()];
  const cams = [poligono(pts), poligono(estrelaPts(0, 75, 10, 4.6))];
  DEF.push({
    nome: 'Árvore', sil: arredondar(uniao(cams), 1, 1.2),
    linhas: [
      [[-7, 59], [-2, 58.5], [4, 60], [8, 62]],
      [[-15, 41], [-6, 41.5], [5, 44], [16, 47]],
      [[-23, 21], [-10, 22.5], [6, 25.5], [24, 29]],
    ],
    pontos: [[-3, 64, 1.9], [-10, 48, 1.9], [9, 37.5, 1.9], [-2, 30, 1.9], [-18, 26, 1.9], [17, 20, 1.9]],
    argola: [0], nome_zona: [0, 24, 34, 5.2, 0], sem_nome: { linhas: [2], pontos: [3, 4, 5] },
  });
}

// Bola de Natal
{
  const cams = [circulo(0, 34, 32), rrect(-7, 64, 7, 71.5, 1.5)];
  DEF.push({
    nome: 'Bola', sil: uniao(cams),
    linhas: [onda(-34, 34, 51, 2.6, 17), onda(-34, 34, 17, 2.6, 17), [[-6, 66.5], [6, 66.5]]],
    pontos: [-21, -14, -7, 0, 7, 14, 21].map((x) => [x, 34, 2]),
    argola: [0], nome_zona: [0, 34, 42, 7.5, 0], sem_nome: { linhas: [], pontos: [0, 1, 2, 3, 4, 5, 6] },
  });
}

// Estrela
{
  DEF.push({
    nome: 'Estrela', sil: arredondar(uniao([poligono(estrelaPts(0, 36, 39, 16.5))]), 2.2, 1),
    linhas: [fechar(estrelaPts(0, 35, 17, 7.2))],
    pontos: [],
    argola: [0], nome_zona: [0, 34, 24, 5, 0], sem_nome: { linhas: [0], pontos: [] },
  });
}

// Floco de neve
{
  const cams = [circulo(0, 0, 14)];
  for (let k = 0; k < 6; k++) {
    const a = rad(90 + 60 * k), u = [Math.cos(a), Math.sin(a)], P = (d, da = 0, l = 0) => {
      const b = [u[0] * d, u[1] * d]; if (!l) return b;
      const aa = a + rad(da); return [b[0] + Math.cos(aa) * l, b[1] + Math.sin(aa) * l];
    };
    cams.push(...traco([P(0), P(34)], 7));
    cams.push(...traco([P(19), P(19, 45, 10)], 5.5), ...traco([P(19), P(19, -45, 10)], 5.5));
    cams.push(...traco([P(28), P(28, 45, 6)], 4.8), ...traco([P(28), P(28, -45, 6)], 4.8));
  }
  const sil = uniao(cams).map((p) => p.map(({ X, Y }) => ({ X, Y: Y + 38 * S })));
  DEF.push({
    nome: 'Floco de neve', sil: arredondar(sil, 0.5, 1.2),
    linhas: [], pontos: [[0, 38, 2.6]],
    argola: [0], nome_zona: [0, 38, 18, 4.2, 0], sem_nome: { linhas: [], pontos: [0] },
  });
}

// Laço
{
  const caudaE = [[-6, 35], [2, 35], [-7, 5], [-12.5, 9.5], [-19, 5]];
  const cams = [
    elipse(-15.5, 41, 15.5, 10, -18), elipse(15.5, 41, 15.5, 10, 18),
    rrect(-6.5, 33, 6.5, 48, 3.5),
    poligono(caudaE), poligono(espelhoX(caudaE).reverse()),
  ];
  DEF.push({
    nome: 'Laço', sil: arredondar(uniao(cams), 0.8, 1.6),
    linhas: [fechar(elipsePts(-16, 41.5, 8, 4.2, -18)), fechar(elipsePts(16, 41.5, 8, 4.2, 18)), [[-6.5, 29], [-11.5, 12]], [[6.5, 29], [11.5, 12]]],
    pontos: [],
    argola: [0], nome_zona: [0, 40.5, 44, 5.4, 0], sem_nome: { linhas: [0, 1], pontos: [] },
  });
}

// Sino
{
  const dir = [[0, 64], [6, 63.5], [10.5, 61], [13, 56], [14, 48], [15, 38], [17, 28], [20.5, 20], [25, 15], [27.5, 12], [27.5, 8.5], [0, 8.5]];
  const pts = [...dir, ...espelhoX(dir.slice(1, -1)).reverse()];
  const cams = [poligono(pts), circulo(0, 6, 5.5), circulo(0, 64.5, 4)];
  DEF.push({
    nome: 'Sino', sil: arredondar(uniao(cams), 1.4, 1.2),
    linhas: [[[-24, 17.5], [24, 17.5]], onda(-17, 17, 26, 1.2, 8.5)],
    pontos: [],
    argola: [0], nome_zona: [0, 40, 22, 5.2, 0], sem_nome: { linhas: [], pontos: [] },
  });
}

// Bota (meia de Natal)
{
  const cams = [
    rrect(-8, 16, 14, 60, 3),
    rrect(-11.5, 54, 17.5, 70, 3),
    hull([...circPts(6, 16, 11), ...circPts(-20, 13.5, 10)]),
  ];
  DEF.push({
    nome: 'Bota', sil: arredondar(uniao(cams), 0.8, 4),
    linhas: [[[-14, 53.5], [20, 53.5]], circPts(7.5, 15, 7.5, 48, -75, 55), circPts(-21, 13.5, 6.5, 48, 105, 255), onda(-8, 14, 38, 1.4, 7.3), onda(-8, 14, 30, 1.4, 7.3)],
    pontos: [],
    argola: [-7], nome_zona: [3, 62, 24, 5.2, 0], sem_nome: { linhas: [], pontos: [] },
  });
}

// Boneco de neve
{
  const bracoE = [[-10, 33], [-26, 43], [-30, 50]], garfoE = [[-26, 43], [-32, 41.5]];
  const cams = [
    circulo(0, 20, 19), circulo(0, 46.5, 12.5),
    rrect(-13.5, 56, 13.5, 60, 1.5), rrect(-8.5, 59, 8.5, 74, 2),
    ...[bracoE, garfoE].flatMap((l) => [...traco(l, 5), ...traco(espelhoX(l), 5)]),
  ];
  DEF.push({
    nome: 'Boneco de neve', sil: arredondar(uniao(cams), 0.5, 2),
    linhas: [circPts(0, 46, 6, 48, 215, 325), fechar([[0.5, 45.2], [8, 44], [0.5, 42.8]]), [[-10.5, 36.5], [10.5, 36.5]], [[6, 36.5], [8.5, 28]], [[-8.5, 63.5], [8.5, 63.5]]],
    pontos: [[-4, 50, 1.6], [4, 50, 1.6], [0, 27, 1.8], [0, 19.5, 1.8], [0, 12, 1.8]],
    argola: [0], nome_zona: [0, 18.5, 26, 5.4, 0], sem_nome: { linhas: [], pontos: [2, 3, 4] },
  });
}

// Bengala doce (não leva nome: é estreita e o nome ficava em cima das riscas)
{
  const cx = -6, cy = 52, r = 12;
  const caminho = [[6, 3], [6, cy], ...circPts(cx, cy, r, 64, 0, 180).slice(1), [-18, 44]];
  const riscas = [];
  for (let y = 6; y <= 44; y += 8.5) riscas.push([[-1, y], [13, y + 7]]);
  for (const a of [25, 65, 110, 150]) riscas.push([[cx + 4 * Math.cos(rad(a)), cy + 4 * Math.sin(rad(a))], [cx + 20 * Math.cos(rad(a + 18)), cy + 20 * Math.sin(rad(a + 18))]]);
  DEF.push({
    nome: 'Bengala', sil: uniao(traco(caminho, 11.5)),
    linhas: riscas, pontos: [],
    argola: [-6], nome_zona: null, sem_nome: { linhas: [], pontos: [] },
  });
}

// Luva
{
  const cams = [
    rrect(-12, 16, 16, 59, 13),
    ...traco([[-9, 29], [-19, 43]], 11),
    rrect(-15, 2, 19, 19, 3),
  ];
  const coracao = [];
  for (let i = 0; i <= 48; i++) { const t = (2 * Math.PI * i) / 48; coracao.push([2 + 0.36 * 16 * Math.sin(t) ** 3, 40 + 0.36 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]); }
  DEF.push({
    nome: 'Luva', sil: arredondar(uniao(cams), 0.8, 2.5),
    linhas: [[[-17, 18.5], [21, 18.5]], coracao, zigue([-13, 13.5], [17, 13.5], 1.3, 12)],
    pontos: [],
    argola: [2], nome_zona: [2, 10, 26, 5.2, 0], sem_nome: { linhas: [2], pontos: [] },
  });
}

// Ramer–Douglas–Peucker: tira pontos que se desviam menos de tol (mm) da linha
function simplificar(pts, tol, fechado) {
  if (pts.length < 4) return pts;
  if (fechado) { // parte o contorno em dois pelo ponto mais afastado do primeiro
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

// ── normalizar (maior lado = 80 mm com a argola, x centrado, y a partir de 0) e exportar ──
const r2 = (v) => Math.round(v * 10) / 10 || 0;   // 0.1 mm chega (e o template fica mais pequeno)
function dentro(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function distPol(pts, x, y) {
  let m = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    m = Math.min(m, Math.hypot(ax + t * dx - x, ay + t * dy - y));
  }
  return dentro(pts, x, y) ? -m : m;
}

// topo da silhueta na vertical x
function yTopo(pts, x) {
  let m = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    if ((x1 <= x && x2 >= x) || (x2 <= x && x1 >= x)) m = Math.max(m, x1 === x2 ? Math.max(y1, y2) : y1 + ((y2 - y1) * (x - x1)) / (x2 - x1));
  }
  return m;
}

const formas = DEF.map((d) => {
  // argola só com x: fica 2 mm acima do topo da placa (o furo encosta à placa e a aba sobrepõe-se a ela)
  if (d.argola.length === 1) d.argola = [d.argola[0], yTopo(D(d.sil[0]), d.argola[0]) + 2];
  if (d.sil.length !== 1) console.log(d.nome, d.sil.map((p) => [ClipperLib.Clipper.Area(p) / S / S, Math.min(...p.map(q=>q.X))/S, Math.max(...p.map(q=>q.X))/S, Math.min(...p.map(q=>q.Y))/S, Math.max(...p.map(q=>q.Y))/S]));
  if (d.sil.length !== 1) throw new Error(`${d.nome}: a silhueta tem ${d.sil.length} contornos (devia ter 1)`);
  let sil = D(d.sil[0]);
  if (ClipperLib.Clipper.Area(d.sil[0]) < 0) sil.reverse();
  const xs = [...sil.map((p) => p[0]), d.argola[0] - R_ABA, d.argola[0] + R_ABA];
  const ys = [...sil.map((p) => p[1]), d.argola[1] + R_ABA];
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const f = NOMINAL / Math.max(x1 - x0, y1 - y0), dx = -(x0 + x1) / 2, dy = -y0;
  const Tc = ([x, y]) => [(x + dx) * f, (y + dy) * f];            // sem arredondar (para simplificar)
  const R = (pts) => pts.map(([x, y]) => [r2(x), r2(y)]);
  const T = (p) => R([Tc(p)])[0];
  const silN = R(simplificar(sil.map(Tc), 0.05, true));
  const argola = T(d.argola);
  // a argola tem de tocar na placa em qualquer tamanho (de 50 % a 150 %): centro fora da placa e a menos
  // de R_ABA/1.5 do contorno (à escala nominal)
  const dist = distPol(silN, argola[0], argola[1]);
  console.log(d.nome, 'distância da argola à placa', dist.toFixed(2));
  if (dist > R_ABA / 1.5 - 0.3) console.warn('AVISO', `${d.nome}: argola a ${dist.toFixed(2)} mm da placa — afasta-se nos tamanhos grandes`);
  return {
    nome: d.nome,
    sil: silN,
    linhas: d.linhas.map((l) => {
      const q = l.map(Tc), [a, z] = [q[0], q[q.length - 1]];
      if (Math.hypot(a[0] - z[0], a[1] - z[1]) > 1e-6) return R(simplificar(q, 0.04, false));
      const c = R(simplificar(q.slice(0, -1), 0.04, true));   // fechada: simplifica como contorno e volta a fechar
      return [...c, c[0]];
    }),
    pontos: d.pontos.map(([x, y, r]) => [...T([x, y]), r2(r * f)]),
    argola,
    nome_zona: d.nome_zona ? [...T(d.nome_zona.slice(0, 2)), r2(d.nome_zona[2] * f), r2(d.nome_zona[3] * f), d.nome_zona[4]] : null,
    sem_nome: d.sem_nome,
    largura: r2((x1 - x0) * f), altura: r2((y1 - y0) * f),
  };
});

const dados = { nominal: NOMINAL, r_aba: R_ABA, r_furo: R_FURO, formas };
fs.writeFileSync(path.join(ROOT, 'lib/enfeitesNatal.json'), JSON.stringify(dados));

// bloco de dados do .scad: [nome, sil, linhas, pontos, argola, nome_zona ([] = sem nome), sem_nome_linhas, sem_nome_pontos]
const lista = (v) => JSON.stringify(v);
const bloco = [
  '// @@FORMAS-BEGIN (gerado por scripts/gerar_enfeites.mjs — não editar à mão)',
  'FORMAS = [',
  formas.map((f) => `  [${lista(f.nome)}, ${lista(f.sil)}, ${lista(f.linhas)}, ${lista(f.pontos)}, ${lista(f.argola)}, ${lista(f.nome_zona ?? [])}, ${lista(f.sem_nome.linhas)}, ${lista(f.sem_nome.pontos)}]`).join(',\n'),
  '];',
  '// @@FORMAS-END',
].join('\n');
const scadPath = path.join(ROOT, 'templates/enfeite_natal.scad');
if (fs.existsSync(scadPath)) {
  const s = fs.readFileSync(scadPath, 'utf8');
  const a = s.indexOf('// @@FORMAS-BEGIN'), b = s.indexOf('// @@FORMAS-END');
  if (a < 0 || b < 0) throw new Error('enfeite_natal.scad sem marcas @@FORMAS');
  fs.writeFileSync(scadPath, s.slice(0, a) + bloco + s.slice(b + '// @@FORMAS-END'.length));
}
for (const f of formas) console.log(`${f.nome.padEnd(20)} ${f.largura} × ${f.altura} mm, ${f.sil.length} pontos, ${f.linhas.length} linhas, ${f.pontos.length} pintas${f.nome_zona ? '' : ', sem nome'}`);

// ── folha SVG (composição igual à do .scad, para ver) ───────────────────────
const i = process.argv.indexOf('--svg');
if (i > 0) {
  const L = 2.2, M = 1.8;   // largura das linhas e margem por fora do contorno em relevo (como no .scad)
  const svgPath = (cams) => cams.map((p) => 'M' + D(p).map(([x, y]) => `${x.toFixed(2)},${(-y).toFixed(2)}`).join('L') + 'Z').join('');
  const dif = (a, b) => { const c = new ClipperLib.Clipper(), s = new ClipperLib.Paths(); c.AddPaths(a, ClipperLib.PolyType.ptSubject, true); c.AddPaths(b, ClipperLib.PolyType.ptClip, true); c.Execute(ClipperLib.ClipType.ctDifference, s, 1, 1); return s; };
  const inter = (a, b) => { const c = new ClipperLib.Clipper(), s = new ClipperLib.Paths(); c.AddPaths(a, ClipperLib.PolyType.ptSubject, true); c.AddPaths(b, ClipperLib.PolyType.ptClip, true); c.Execute(ClipperLib.ClipType.ctIntersection, s, 1, 1); return s; };
  const comNome = process.argv.includes('--nome');
  let out = '';
  formas.forEach((f, k) => {
    const ox = (k % 4) * 100 + 50, oy = Math.floor(k / 4) * 100 + 92;
    const sil = [C(f.sil)];
    const base = dif(uniao([...sil, circulo(f.argola[0], f.argola[1], R_ABA)]), [circulo(f.argola[0], f.argola[1], R_FURO)]);
    const borda = dif(off(sil, -M), off(sil, -M - L));
    const semL = comNome && f.nome_zona ? f.sem_nome.linhas : [], semP = comNome && f.nome_zona ? f.sem_nome.pontos : [];
    const det = [...f.linhas.filter((_, j) => !semL.includes(j)).flatMap((l) => traco(l, L)), ...f.pontos.filter((_, j) => !semP.includes(j)).map(([x, y, r]) => circulo(x, y, r))];
    const ouro = dif(inter(uniao([...borda, ...det], false), off(sil, -M)), [circulo(f.argola[0], f.argola[1], R_FURO + 0.8)]);
    out += `<g transform="translate(${ox},${oy})"><path d="${svgPath(base)}" fill="#6b3a1e" fill-rule="nonzero"/><path d="${svgPath(ouro)}" fill="#e0a526"/>`;
    if (comNome && f.nome_zona) { const [x, y, w, s, rot] = f.nome_zona; out += `<rect x="${x - w / 2}" y="${-y - s * 0.6}" width="${w}" height="${s * 1.2}" fill="none" stroke="#2563eb" stroke-width="0.4" transform="rotate(${-rot},${x},${-y})"/>`; }
    out += `<text x="0" y="6" font-size="5" text-anchor="middle" font-family="sans-serif">${f.nome}</text></g>`;
  });
  fs.writeFileSync(process.argv[i + 1], `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="1200" height="900"><rect width="400" height="300" fill="#f5f0e6"/>${out}</svg>`);
}

// ── SQL do produto (scripts/insert_enfeite_natal.sql): design "enfeite_natal" em rascunho ──
{
  const paleta = [
    ['#6B3A1E', 'Castanho'], ['#E0A526', 'Dourado'], ['#C0C0C0', 'Prateado'], ['#FFFFFF', 'Branco'], ['#111111', 'Preto'],
    ['#B91C1C', 'Vermelho'], ['#15803D', 'Verde'], ['#1E3A8A', 'Azul'], ['#F472B6', 'Rosa'], ['#7C3AED', 'Roxo'],
  ].map(([hex, nome]) => ({ hex, nome }));
  const fontes = ['Luckiest Guy', 'Chewy', 'Baloo 2', 'Sigmar One', 'Pacifico', 'Lobster', 'Open Sans'];
  const comZona = formas.filter((f) => f.nome_zona);
  const P = {
    enfeite: { ui: { widget: 'hidden' }, order: 0, default: 'natal' },
    forma: { ui: { label: 'Forma', widget: 'select', options: formas.map((f) => f.nome) }, order: 1, default: 'Boneco de gengibre' },
    nome: { ui: { label: 'Nome (opcional)', widget: 'text', maxLength: 16 }, order: 2, default: '' },
    fonte: { ui: { label: 'Tipo de letra', widget: 'select', options: fontes }, order: 3, default: 'Luckiest Guy' },
    tamanho: { ui: { step: 5, label: 'Tamanho (lado maior, com a argola)', widget: 'slider' }, type: 'number', unit: 'mm', min: 50, max: 120, order: 4, default: 80 },
    largura_linha: { ui: { step: 0.1, label: 'Largura das linhas', widget: 'slider' }, type: 'number', unit: 'mm', min: 1.6, max: 3.2, order: 5, default: 2.2 },
    espessura: { ui: { step: 0.2, label: 'Espessura da base', widget: 'slider' }, type: 'number', unit: 'mm', min: 2, max: 4, order: 6, default: 3 },
    impressao: { ui: { label: 'Impressora', widget: 'select', options: ['AMS (3MF multicor)', 'Sem AMS (troca de cor manual)'] }, order: 8, default: 'AMS (3MF multicor)' },
    cor_base: { ui: { label: 'Cor da base', widget: 'color', paleta }, order: 9, default: '#6B3A1E' },
    cor_relevo: { ui: { label: 'Cor do relevo (contorno, detalhes e nome)', widget: 'color', paleta }, order: 10, default: '#E0A526' },
    info_enfeite: { ui: { widget: 'info', text: '🎄 Base numa cor e o contorno, os detalhes e o nome em relevo noutra. Sem AMS: troca o filamento na camada do fim da base (vem no LEIA-ME). O nome encolhe sozinho para caber; a bengala não leva nome.' }, order: 99, default: null },
  };
  const gs = {
    engine: 'openscad', version: 1, parameters: P,
    multicor: { param_impressao: 'impressao', troca_cor_param: 'espessura', partes: [
      { modo: 'base', nome: 'Base', cor_param: 'cor_base' }, { modo: 'relevo', nome: 'Relevo', cor_param: 'cor_relevo' }] },
    ajuste_texto: { campos: ['nome'], largura_util: 30,
      largura_por_forma: Object.fromEntries(comZona.map((f) => [f.nome, f.nome_zona[2]])),
      tamanho_por_forma: Object.fromEntries(comZona.map((f) => [f.nome, f.nome_zona[3]])) },
  };
  const tpl = fs.readFileSync(scadPath, 'utf8');
  if (tpl.includes('$tpl$') || JSON.stringify(gs).includes('$gs$')) throw new Error('marca $..$ dentro do conteúdo');
  const sql = `-- Gerado por scripts/gerar_enfeites.mjs — design "Enfeite de Natal (2 cores)" (rascunho)
insert into prod_designs (id, nome, descricao, familia, estado, acesso_maker, disponivel_consumidor, capa_familia, usa_modo, scad_template, generation_schema, parametros_default)
values ('enfeite_natal', 'Enfeite de Natal (2 cores)',
  'Enfeites de Natal para pendurar, a duas cores: base recortada e contorno, detalhes e nome em relevo. 12 formas: rena, boneco de gengibre, árvore, bola, estrela, floco de neve, laço, sino, bota, boneco de neve, bengala e luva.',
  'Enfeites de Natal', 'rascunho', 'gratuito', false, true, false, $tpl$${tpl}$tpl$, $gs$${JSON.stringify(gs)}$gs$::jsonb, '{}'::jsonb)
on conflict (id) do update set scad_template = excluded.scad_template, generation_schema = excluded.generation_schema;
`;
  fs.writeFileSync(path.join(ROOT, 'scripts/insert_enfeite_natal.sql'), sql);
  fs.writeFileSync(path.join(ROOT, 'scripts/enfeite_natal_schema.json'), JSON.stringify(gs, null, 2));
}
