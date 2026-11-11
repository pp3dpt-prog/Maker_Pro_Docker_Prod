import { forma, traco, tracoAfilado, uniao, dif, arredondar, mover, circulo, elipse, rect, poligono, estrelaPts } from './lib.mjs';

// ── rena de pé, virada para a direita, cascos em y = 0 (caminho SVG: y para baixo, chão em 100) ──
const RENA_CORPO = `M 15 46 C 17 44 22 43.5 26 44 C 34 45.5 46 46.5 56 43 C 60 41.5 62.8 37 64.6 31 C 66 26.5 67.4 23.8 69.6 22.4
 L 63.2 20.6 C 65.6 18.6 69 18.2 72.2 19.4 C 77 19 81 21 85 24 C 87.5 25.2 89.5 26.5 89.4 28.5 C 89.3 30.5 87 31.2 85 31
 C 81 31.5 77 31.5 74.5 30.5 C 72.6 32.2 71.8 34.4 72.6 37 C 71.2 37.4 70.6 38.6 71.4 40.6 C 70 41 69.6 43 70.4 45.4
 C 70.6 49 70.8 52 69.8 55 C 69 57.5 68 59.5 67.5 61.5
 C 67.5 68 68.2 74 67.3 79 C 66.8 85 67 91 67.6 97 L 68.5 99.6 L 64.6 99.6 L 64.8 97 C 64.4 91 64.3 85 64.2 80 C 64 74 63 69 62 66
 C 61.5 72 60.5 79 59.5 84 C 59 89 59.6 94 60.4 97.5 L 61 99.6 L 57.2 99.6 L 57.6 97 C 56.6 92 56.4 87 56.9 82 C 57.4 76 57.8 71 57.2 66
 C 50 68.4 40 68.4 33 65.5 C 32 70 33.6 74 32.4 78.5 C 31.4 81 29.4 82 29.6 86 C 29.8 90 30.4 94 31.2 97.4 L 31.8 99.6 L 28 99.6 L 28.2 97.2
 C 27.2 93 26.6 89 26.6 85.4 C 26.4 82 25.4 79 24.6 75.5
 C 23.8 79 21.8 81.5 21.6 85.6 C 21.6 89.5 22.6 93.5 23.6 97.4 L 24.2 99.6 L 20.4 99.6 L 20.6 97.4
 C 19.4 93.4 18.6 89 18.6 85 C 18.6 82 17.6 80 17.2 76 C 16.6 70 16.8 64 17 60 C 16.8 55 16 51 15 49 C 13 49 12.5 47 15 46 Z`;
// hastes: varas que sobem para trás e se curvam para a frente no fim, com pontas para a frente
const RENA_HASTES = [
  // haste do lado de cá
  ['M 73 20.5 C 71.5 14 67.5 9 63.5 4 C 61 0.5 61.5 -4 64.5 -7.5', 2.6, 1.0],
  ['M 70 13.6 C 72.6 11.4 74.6 9 76 5.4', 1.7, 0.8], ['M 66 7.6 C 68.4 5 69.8 2.6 70.6 -1', 1.6, 0.8],
  ['M 62.6 -0.6 C 64.6 -2.4 66 -4.2 67 -6.6', 1.3, 0.7],
  ['M 72.4 17.6 C 75 17 77.4 16.6 79.6 15', 1.8, 0.9], ['M 77.4 16.4 C 78.6 17.6 80 18.2 81.6 18.2', 1.2, 0.7],
  // haste do lado de lá (mais atrás)
  ['M 71.2 20.8 C 68 15.6 62.6 12 57.4 8.6 C 54 6.4 52.6 3 53.6 -0.8', 2.4, 0.9],
  ['M 63.4 12.6 C 62.6 9 62.4 6.4 63 3', 1.5, 0.7], ['M 58 9.2 C 56.4 6.2 55.8 4 56 1', 1.3, 0.7],
];
export function rena(dx = 0, f = 1, esp = false) {
  // chão em y = 0; a rena tem ~107 de altura nominal (com as hastes) × f
  let partes = [...forma(RENA_CORPO, 0, 100)];
  for (const [d, w0, w1] of RENA_HASTES) partes.push(...tracoAfilado(d, w0, w1, 0, 100));
  let r = arredondar(uniao(partes), 0.25, 0.6);
  return mover(r, 0, 0, f, esp).map((p) => p.map(({ X, Y }) => ({ X: X + Math.round(dx * 1000), Y })));
}

// desloca/escala uma forma já em mm (chão em y = 0)
const pos = (cams, dx, dy = 0, f = 1, esp = false) => mover(cams, dx, dy, f, esp);
// caminho em coordenadas "y para cima" → string SVG (y para baixo)
const P = (x, y) => `${x.toFixed(2)} ${(-y).toFixed(2)}`;

// ── pinheiro com camadas de ramos caídos (base do tronco em y = 0) ──
export function pinheiro(cx, h, w = h * 0.6) {
  const n = h > 40 ? 5 : 4, tr = h * 0.1, partes = [];
  for (let i = 0; i < n; i++) {
    const u0 = i / n, yb = tr + (h - tr) * 0.82 * u0, yt = Math.min(h, yb + (h - tr) * (0.36 - 0.02 * i) + (i === n - 1 ? (h - tr) * 0.12 : 0));
    const ww = (w / 2) * (1 - 0.78 * u0), hh = yt - yb;
    // lados côncavos até às pontas, que caem um pouco; por baixo um arco suave para cima
    const d = `M ${P(cx, yt)} C ${P(cx + ww * 0.2, yt - hh * 0.4)} ${P(cx + ww * 0.55, yb + hh * 0.22)} ${P(cx + ww, yb - hh * 0.05)}
      C ${P(cx + ww * 0.7, yb + hh * 0.1)} ${P(cx + ww * 0.3, yb + hh * 0.16)} ${P(cx, yb + hh * 0.1)}
      C ${P(cx - ww * 0.3, yb + hh * 0.16)} ${P(cx - ww * 0.7, yb + hh * 0.1)} ${P(cx - ww, yb - hh * 0.05)}
      C ${P(cx - ww * 0.55, yb + hh * 0.22)} ${P(cx - ww * 0.2, yt - hh * 0.4)} ${P(cx, yt)} Z`;
    partes.push(...forma(d));
  }
  partes.push(...rect(cx - Math.max(1.2, h * 0.045), -0.5, cx + Math.max(1.2, h * 0.045), tr + 2));
  return uniao(partes);
}

// chão com neve: faixa de baixo (y −3 a 0) com montinhos suaves
export function chao(x0, x1, monte = []) {
  const partes = [...rect(x0, -3, x1, 0.6)];
  for (const [cx, w, h] of monte) partes.push(...forma(`M ${P(cx - w, 0)} C ${P(cx - w * 0.5, h)} ${P(cx + w * 0.5, h)} ${P(cx + w, 0)} Z`));
  return uniao(partes);
}

// ── Maria ajoelhada, de perfil, virada para a direita (base em y = 0, ~45 de altura) ──
const MARIA = `M 2 100 C 1 92 3 84 6 77 C 8 71 9 66 9.5 62 C 9.8 58.5 11.5 55.6 14.5 55 C 17.5 54.4 20 56 20.6 59
  C 21 61 20.6 62.5 20 63.5 C 21.6 64.4 22.4 65.6 22 66.6 C 21.6 67.6 20.6 68 20.2 68.4 C 20.6 69.5 21 70.5 22 71.5
  L 27.8 66.6 C 28.8 67.4 28.4 69.4 26.8 70.6 C 24.2 72.8 22.8 74 22.6 75.8 C 23.2 79.5 24.8 83.5 27 88 C 28.8 92 30.2 96 30.6 100 Z`;
// ── José de pé, virado para a direita, com capuz e cajado (~60 de altura) ──
const JOSE = `M 3 100 C 3 90 4 80 5 72 C 5.8 66 6 60 7.5 55 C 8.5 51 9 47.5 11 45 C 12.5 42 16 41 18.5 42.5
  C 20.2 43.5 20.6 45.5 20.2 47 C 21.4 48 21.6 49 21 49.6 C 21.2 51 20.8 52.6 19.6 53.4 C 20.5 55 21.5 57 21.8 59
  L 25.6 58.8 C 26.8 59.4 26.9 61 25.9 62 C 24 63 22.6 64 22.4 66 C 22.6 75 23.5 86 24.6 100 Z`;
const CAJADO = `M 26.2 100 L 26.4 50 C 26.5 45 28.6 42.4 31 42.8 C 33.4 43.2 33.6 46.2 31.8 47.4`;
export function maria(dx, f = 1, esp = false) { return pos(arredondar(forma(MARIA, 0, 100), 0.2, 0.5), dx, 0, f, esp); }
export function jose(dx, f = 1, esp = false) {
  return pos(arredondar(uniao([...forma(JOSE, 0, 100), ...traco(CAJADO, 1.8, 0, 100)]), 0.2, 0.5), dx, 0, f, esp);
}
// manjedoura com o Menino (centrada em x = 0)
export function manjedoura(f = 1) {
  const partes = [
    ...traco(`M ${P(-8, 0.3)} L ${P(5, 11)}`, 2.2), ...traco(`M ${P(8, 0.3)} L ${P(-5, 11)}`, 2.2),
    ...forma(`M ${P(-11, 10.5)} L ${P(11, 10.5)} L ${P(9, 15.5)} L ${P(-9, 15.5)} Z`),
    // palha a sair por cima
    ...forma(`M ${P(-10, 15)} L ${P(-11.5, 17)} L ${P(-8, 16)} L ${P(-6, 17.6)} L ${P(6, 17.6)} L ${P(8, 16)} L ${P(11.5, 17)} L ${P(10, 15)} Z`),
    // o Menino enfaixado + cabeça
    ...elipse(-1.5, 18.6, 6.8, 2.8, 4), ...circulo(6, 20.4, 2.9),
  ];
  return pos(arredondar(uniao(partes), 0.2, 0.4), 0, 0, f);
}
// ovelha deitada (virada para a direita), ~14 de largura
export function ovelha(dx, f = 1, esp = false) {
  const lã = [];
  for (const [x, y, r] of [[2, 3.2, 3], [5.5, 5, 3.4], [9, 5, 3.2], [12, 3.6, 3], [7, 2.6, 3.4]]) lã.push(...circulo(x, y, r));
  const cabeca = [...elipse(15.2, 6.2, 2.6, 1.9, -25), ...elipse(13.8, 7.4, 1.5, 0.7, 40)];
  return pos(arredondar(uniao([...lã, ...cabeca, ...rect(-0.5, 0, 15, 1.2)]), 0.2, 0.4), dx, 0, f, esp);
}
// estrela de Belém: 4 raios compridos + 4 curtos, o de baixo comprido para tocar no telhado
export function estrelaBelem(cx, cy, R) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (90 + i * 22.5) * Math.PI / 180;
    const r = i % 2 ? R * 0.16 : (i % 4 === 0 ? (i === 8 ? R * 1.9 : R) : R * 0.55);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return poligono(pts);
}
// estábulo: telhado de duas águas com beiral, dois postes e uma trave
export function estabulo(w, h, hr) {
  const e = 2.4;
  const partes = [
    ...forma(`M ${P(-w / 2 - 4, h - 1.5)} L ${P(0, h + hr)} L ${P(w / 2 + 4, h - 1.5)} L ${P(w / 2 + 2.6, h - 3.6)} L ${P(0, h + hr - 3.4)} L ${P(-w / 2 - 2.6, h - 3.6)} Z`),
    ...rect(-w / 2 - 1.2, 0, -w / 2 + 1.2, h - 1.5), ...rect(w / 2 - 1.2, 0, w / 2 + 1.2, h - 1.5),
    ...traco(`M ${P(-w / 2, h - 7)} L ${P(-w / 2 + 9, h - 2.2)}`, 1.6), ...traco(`M ${P(w / 2, h - 7)} L ${P(w / 2 - 9, h - 2.2)}`, 1.6),
  ];
  return uniao(partes);
}

// ── Pai Natal sentado no trenó (virado para a direita), trenó com patins enrolados ──
export function treno(dx, f = 1) {
  const partes = [
    // patim com a ponta enrolada à frente
    ...traco(`M ${P(-4, 1.2)} L ${P(38, 1.2)} C ${P(44, 1.2)} ${P(47.5, 4.5)} ${P(46.5, 9)} C ${P(45.6, 12.6)} ${P(41.2, 12.4)} ${P(41.4, 9.4)} C ${P(41.6, 7.4)} ${P(43.8, 7.2)} ${P(44.2, 8.6)}`, 1.9),
    ...traco(`M ${P(6, 1.2)} L ${P(7.5, 9)}`, 1.8), ...traco(`M ${P(30, 1.2)} L ${P(29, 9)}`, 1.8),
    // caixa do trenó: costas altas enroladas atrás, frente baixa enrolada
    ...forma(`M ${P(-1, 8)} C ${P(-3.5, 14)} ${P(-3.8, 22)} ${P(-0.5, 27)} C ${P(1.6, 30)} ${P(5.4, 29.6)} ${P(5.2, 26.6)} C ${P(5, 24.4)} ${P(2.6, 24.2)} ${P(2.4, 25.8)}
      C ${P(2.2, 21)} ${P(3.6, 17.5)} ${P(8, 16.5)} L ${P(32, 16.5)} C ${P(35.5, 16.5)} ${P(37.5, 18.5)} ${P(38.6, 20.6)} C ${P(39.6, 22.6)} ${P(42.4, 22)} ${P(41.8, 19.6)}
      C ${P(41, 15.5)} ${P(37.5, 9.5)} ${P(32, 8)} Z`),
    // Pai Natal: corpo, cabeça, barba, gorro com pompom, braço às rédeas
    ...forma(`M ${P(9, 16)} C ${P(8, 22)} ${P(9, 28)} ${P(12, 31.5)} C ${P(14.5, 34)} ${P(19.5, 34)} ${P(21.5, 31)} C ${P(23.5, 27.5)} ${P(24.5, 21)} ${P(24, 16)} Z`),
    ...circulo(17.5, 36.4, 3.6), ...forma(`M ${P(15.6, 35.2)} C ${P(18.5, 31.2)} ${P(22.5, 31.5)} ${P(21.6, 36)} Z`),
    ...forma(`M ${P(13.6, 37.6)} C ${P(14, 42)} ${P(17, 44.5)} ${P(21, 45.4)} C ${P(18.6, 43.6)} ${P(19.8, 41)} ${P(21.4, 38.2)} Z`),
    ...circulo(21.6, 45.2, 1.6),
    ...traco(`M ${P(21, 28.5)} C ${P(25, 27.5)} ${P(27.5, 26.6)} ${P(30, 25.6)}`, 3.2),
    // duas prendas com laço, entre as costas do trenó e o Pai Natal
    ...rect(4.2, 15, 9.6, 21.6), ...traco(`M ${P(6.9, 21.4)} C ${P(5.4, 24)} ${P(4, 22.6)} ${P(6.9, 21.6)} C ${P(9.8, 22.6)} ${P(8.4, 24)} ${P(6.9, 21.4)}`, 0.9),
  ];
  return pos(arredondar(uniao(partes), 0.2, 0.5), dx, 0, f);
}
