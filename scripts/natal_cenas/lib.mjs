// Ferramentas para desenhar as silhuetas das cenas com caminhos SVG (curvas de Bézier) e Clipper.
// Usado por scripts/gerar_natal_deco.mjs (cenas Renas, Presépio e Trenó). Para ver as cenas sem
// gerar nada: node scripts/natal_cenas/ver.mjs folha.svg
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
export const ClipperLib = require('clipper-lib');
export const S = 1000;
const C = (pts) => pts.map(([x, y]) => ({ X: Math.round(x * S), Y: Math.round(y * S) }));
export const D = (p) => p.map(({ X, Y }) => [X / S, Y / S]);
const norm = (cams) => cams.map((p) => (ClipperLib.Clipper.Area(p) < 0 ? p.slice().reverse() : p));
function bool(tipo, a, b = []) {
  const c = new ClipperLib.Clipper();
  c.AddPaths(a, ClipperLib.PolyType.ptSubject, true);
  if (b.length) c.AddPaths(b, ClipperLib.PolyType.ptClip, true);
  const sol = new ClipperLib.Paths();
  c.Execute(tipo, sol, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return sol;
}
export const uniao = (cams) => bool(ClipperLib.ClipType.ctUnion, norm(cams));
export const dif = (a, b) => bool(ClipperLib.ClipType.ctDifference, uniao(a), norm(b));
export function off(cams, d) {
  const co = new ClipperLib.ClipperOffset(2, 0.01 * S), sol = new ClipperLib.Paths();
  co.AddPaths(cams, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  co.Execute(sol, d * S);
  return sol;
}
export const arredondar = (cams, rFora, rDentro = rFora) => off(off(off(off(cams, -rFora), rFora), rDentro), -rDentro);

// caminho SVG (absoluto: M L H V C S Q T Z) → lista de pontos; y do SVG para baixo → aqui y para cima
export function caminhoPts(d, passo = 0.4) {
  const tok = d.match(/[MLHVCSQTZmlhvcsqtz]|-?\d*\.?\d+(?:e-?\d+)?/g);
  let i = 0, cmd = '', x = 0, y = 0, cx = 0, cy = 0, x0 = 0, y0 = 0;
  const subs = []; let cur = [];
  const n = () => parseFloat(tok[i++]);
  const bez = (pts) => {
    // comprimento aproximado → nº de passos
    let L = 0; for (let k = 1; k < pts.length; k++) L += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    const m = Math.max(4, Math.ceil(L / passo));
    for (let s = 1; s <= m; s++) {
      const t = s / m; let q = pts.map((p) => p.slice());
      while (q.length > 1) q = q.slice(1).map((p, k) => [q[k][0] + (p[0] - q[k][0]) * t, q[k][1] + (p[1] - q[k][1]) * t]);
      cur.push(q[0]);
    }
  };
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
    switch (cmd) {
      case 'M': if (cur.length) subs.push(cur); x = n(); y = n(); x0 = x; y0 = y; cur = [[x, y]]; cmd = 'L'; cx = x; cy = y; break;
      case 'L': x = n(); y = n(); cur.push([x, y]); cx = x; cy = y; break;
      case 'H': x = n(); cur.push([x, y]); cx = x; cy = y; break;
      case 'V': y = n(); cur.push([x, y]); cx = x; cy = y; break;
      case 'C': { const a = [n(), n()], b = [n(), n()], e = [n(), n()]; bez([[x, y], a, b, e]); cx = b[0]; cy = b[1]; [x, y] = e; break; }
      case 'S': { const a = [2 * x - cx, 2 * y - cy], b = [n(), n()], e = [n(), n()]; bez([[x, y], a, b, e]); cx = b[0]; cy = b[1]; [x, y] = e; break; }
      case 'Q': { const a = [n(), n()], e = [n(), n()]; bez([[x, y], a, e]); cx = a[0]; cy = a[1]; [x, y] = e; break; }
      case 'Z': case 'z': if (cur.length) subs.push(cur); cur = []; x = x0; y = y0; break;
      default: i++;
    }
  }
  if (cur.length) subs.push(cur);
  return subs.map((p) => p.map(([a, b]) => [a, -b]));
}
/** forma fechada a partir de um caminho SVG (cada subcaminho é um contorno; união) */
export const forma = (d, dx = 0, dy = 0, f = 1, esp = false) =>
  uniao(caminhoPts(d).map((p) => C(p.map(([x, y]) => [(esp ? -x : x) * f + dx, y * f + dy]))));
/** traço (linha aberta, pontas redondas) ao longo de um caminho SVG, com largura w */
export function traco(d, w, dx = 0, dy = 0, f = 1, esp = false) {
  const out = [];
  for (const p of caminhoPts(d)) {
    const co = new ClipperLib.ClipperOffset(2, 0.01 * S), sol = new ClipperLib.Paths();
    co.AddPath(C(p.map(([x, y]) => [(esp ? -x : x) * f + dx, y * f + dy])), ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenRound);
    co.Execute(sol, (w / 2) * f * S);
    out.push(...sol);
  }
  return uniao(out);
}
/** traço afilado: largura de w0 a w1 ao longo do caminho (para hastes, caudas, cajados) */
export function tracoAfilado(d, w0, w1, dx = 0, dy = 0, f = 1, esp = false) {
  const out = [];
  for (const p0 of caminhoPts(d, 0.3)) {
    const p = p0.map(([x, y]) => [(esp ? -x : x) * f + dx, y * f + dy]);
    let L = 0; const acc = [0]; for (let k = 1; k < p.length; k++) { L += Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]); acc.push(L); }
    const circ = (x, y, r) => C(Array.from({ length: 20 }, (_, j) => [x + r * Math.cos(j * Math.PI / 10), y + r * Math.sin(j * Math.PI / 10)]));
    const hull = (pts) => { const q = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = []; for (const r of q) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], r) <= 0) lo.pop(); lo.push(r); } for (const r of q.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], r) <= 0) up.pop(); up.push(r); } return [...lo.slice(0, -1), ...up.slice(0, -1)]; };
    for (let k = 1; k < p.length; k++) {
      const r0 = (w0 + (w1 - w0) * acc[k - 1] / L) * f / 2, r1 = (w0 + (w1 - w0) * acc[k] / L) * f / 2;
      const pts = [];
      for (let j = 0; j < 16; j++) { const a = j * Math.PI / 8; pts.push([p[k - 1][0] + r0 * Math.cos(a), p[k - 1][1] + r0 * Math.sin(a)], [p[k][0] + r1 * Math.cos(a), p[k][1] + r1 * Math.sin(a)]); }
      out.push(C(hull(pts)));
    }
  }
  return uniao(out);
}
export const elipse = (cx, cy, rx, ry, rot = 0, n = 60) => [C(Array.from({ length: n }, (_, i) => {
  const t = (2 * Math.PI * i) / n, x = rx * Math.cos(t), y = ry * Math.sin(t), c = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180);
  return [cx + x * c - y * s, cy + x * s + y * c];
}))];
export const circulo = (cx, cy, r) => elipse(cx, cy, r, r);
export const rect = (x0, y0, x1, y1) => [C([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])];
export const poligono = (pts) => [C(pts)];
export const estrelaPts = (cx, cy, R, r, n = 5, a0 = 90) =>
  Array.from({ length: 2 * n }, (_, i) => { const a = (a0 + (i * 180) / n) * Math.PI / 180, rr = i % 2 ? r : R; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; });
export const mover = (cams, dx, dy, f = 1, esp = false) => cams.map((p) => p.map(({ X, Y }) => ({ X: Math.round((esp ? -X : X) * f + dx * S), Y: Math.round(Y * f + dy * S) })));
export const caixa = (cams) => {
  const xs = cams.flatMap((p) => p.map((q) => q.X / S)), ys = cams.flatMap((p) => p.map((q) => q.Y / S));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
// folha SVG para ver
import fs from 'fs';
export function ver(cenas, ficheiro, larguraPx = 1400) {
  const nomes = Object.keys(cenas), cols = Math.min(2, nomes.length), rows = Math.ceil(nomes.length / cols), W = 200, H = 150;
  let out = '';
  nomes.forEach((n, k) => {
    const cams = cenas[n]; const [x0, y0, x1, y1] = caixa(cams); const f = Math.min(180 / (x1 - x0), 120 / (y1 - y0));
    const ox = (k % cols) * W + 10 - x0 * f, oy = Math.floor(k / cols) * H + 135 + y0 * f;
    const d = cams.map((p) => 'M' + D(p).map(([x, y]) => `${(ox + x * f).toFixed(2)},${(oy - y * f).toFixed(2)}`).join('L') + 'Z').join('');
    out += `<path d="${d}" fill="#3b2412" fill-rule="nonzero"/><text x="${(k % cols) * W + 100}" y="${Math.floor(k / cols) * H + 147}" font-size="7" text-anchor="middle">${n}</text>`;
  });
  fs.writeFileSync(ficheiro, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols * W} ${rows * H}" width="${larguraPx}" height="${larguraPx * rows * H / (cols * W)}"><rect width="100%" height="100%" fill="#f6efe0"/>${out}</svg>`);
}

/** tira os buracos pequenos (< minArea mm²) — fendas entre peças que se tocam */
export function semBuracos(cams, minArea) {
  return cams.filter((p) => !(ClipperLib.Clipper.Area(p) < 0 && Math.abs(ClipperLib.Clipper.Area(p)) / (S * S) < minArea));
}
