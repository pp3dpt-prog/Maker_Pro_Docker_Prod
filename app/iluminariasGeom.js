/**
 * Iluminárias — geometria partilhada (backend: STL; frontend: pré-visualização).
 * ESTE FICHEIRO É IGUAL NOS DOIS REPOSITÓRIOS:
 *   Docker:   app/iluminariasGeom.js
 *   Frontend: lib/iluminariasGeom.js
 * Alterar um → copiar para o outro.
 *
 * Dois geradores (generation_schema.gerador):
 *  - 'iluminaria-torcida'  : abajur torcido (polígono / nervurado / pétalas),
 *                            perfil reto, com bojo ou cónico.
 *  - 'iluminaria-perfurada': prisma de N faces com furos (losangos, favos,
 *                            gotas) que projetam a luz.
 * Ambos assentam numa base com encaixe para a luz (LED Kit-001 da Bambu,
 * casquilho E14 ou vela LED) e imprimem DE PÉ sem suportes: a torção é
 * limitada a 45° de inclinação e os furos têm o topo a ≥ 45°.
 *
 * Unidades mm, z para cima, centro em (0,0). Os triângulos saem num array
 * plano [x,y,z, x,y,z, x,y,z, ...] com normais para fora (regra da mão direita).
 */
import earcut from 'earcut';

export const LUZES = {
  'LED Kit 001 (Bambu)': { pocketD: 60.2, pocketH: 10, holeD: 12,   grooveW: 10, grooveH: 5, floor: 7 },
  'Casquilho E14 (M10)': { pocketD: 0,    pocketH: 0,  holeD: 10.5, grooveW: 8,  grooveH: 5, floor: 8 },
  'Vela LED':            { pocketD: 39.5, pocketH: 8,  holeD: 0,    grooveW: 0,  grooveH: 0, floor: 3 },
};
const LUZ_DEFAULT = 'LED Kit 001 (Bambu)';
export const LIP_H = 5;       // altura do rebordo da base que entra na peça
export const LIP_T = 2;       // espessura do rebordo
export const FOLGA = 0.3;     // folga do encaixe (por lado)

const num = (v, def, min, max) => {
  const n = Number(v);
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : def));
};
const luzDe = (p) => {
  const nome = LUZES[p?.luz] ? p.luz : LUZ_DEFAULT;
  const luz = LUZES[nome];
  return { luzNome: nome, luz, hb: luz.floor + luz.pocketH };
};

// ═════════════════════════════════════════════════════════════════════════════
// Abajur torcido
// ═════════════════════════════════════════════════════════════════════════════

export function torcidaConfig(p) {
  const formato = ['Polígono', 'Nervurado', 'Pétalas'].includes(p?.formato) ? p.formato : 'Polígono';
  const lados = Math.round(num(p?.lados, formato === 'Polígono' ? 6 : 12, formato === 'Polígono' ? 3 : 4, 36));
  const D = num(p?.diametro_mm, 120, 70, 220);
  const H = num(p?.altura_mm, 160, 60, 260);
  const t = num(p?.parede_mm, 1.6, 0.8, 4);
  const perfil = ['Reto', 'Bojo', 'Cónico'].includes(p?.perfil) ? p.perfil : 'Reto';
  const R = D / 2;
  // Escala máxima do perfil (bojo alarga a meio)
  const sMax = perfil === 'Bojo' ? 1.15 : 1;
  // Inclinação tangencial ≤ 45° (com margem): R·sMax·Δφ/H ≤ 0.9
  const torcaoMax = (0.9 * H / (R * sMax)) * 180 / Math.PI;
  const torcao = Math.max(-torcaoMax, Math.min(torcaoMax, num(p?.torcao_graus, 90, -360, 360)));
  return { tipo: 'iluminaria-torcida', formato, lados, D, R, H, t, perfil, torcao, torcaoMax, ...luzDe(p) };
}

/** Raio exterior (sem escala/torção) no ângulo θ. */
function torcidaRaio(c, th) {
  const n = c.lados;
  if (c.formato === 'Polígono') {
    const seg = (2 * Math.PI) / n;
    const a = ((th % seg) + seg) % seg - seg / 2;
    return (c.R * Math.cos(Math.PI / n)) / Math.cos(a);
  }
  if (c.formato === 'Nervurado') return c.R * (1 - 0.07 * (1 - Math.cos(n * th)) / 2);
  return c.R * (1 - 0.12 * (1 - Math.abs(Math.cos((n * th) / 2))));      // Pétalas
}
/** Raio interior (parede de espessura t, perpendicular nas faces planas). */
function torcidaRaioInt(c, th, s) {
  const n = c.lados;
  if (c.formato === 'Polígono') {
    const seg = (2 * Math.PI) / n;
    const a = ((th % seg) + seg) % seg - seg / 2;
    return (c.R * s * Math.cos(Math.PI / n) - c.t) / Math.cos(a);
  }
  return torcidaRaio(c, th) * s - c.t;
}
function torcidaEscala(c, z) {
  if (c.perfil === 'Bojo') return 1 + 0.15 * Math.sin((Math.PI * z) / c.H);
  if (c.perfil === 'Cónico') return 1 - 0.3 * (z / c.H);
  return 1;
}

/**
 * Colarinho em baixo: anel interior circular onde entra o rebordo da base.
 * rc = raio do furo do colarinho; o rebordo da base tem raio rc − FOLGA.
 */
export function torcidaColarinho(c) {
  let minInt = Infinity;
  for (let i = 0; i < 720; i++) minInt = Math.min(minInt, torcidaRaioInt(c, (i / 720) * 2 * Math.PI, 1));
  return { rc: minInt - 1.5, hc: 6 };
}

/** Contorno exterior em z = 0 (para a base), lista de [x, y]. */
export function torcidaContornoBase(c, n = 360) {
  return Array.from({ length: n }, (_, i) => {
    const th = (i / n) * 2 * Math.PI;
    const r = torcidaRaio(c, th);
    return [r * Math.cos(th), r * Math.sin(th)];
  });
}

export function torcidaMalha(c, { resolucao = 1 } = {}) {
  const { H } = c;
  const { rc, hc } = torcidaColarinho(c);
  const NT = Math.max(48, Math.round(720 * resolucao));
  const passoZ = 1 / resolucao;
  // linhas: 0 → hc (anel), depois hc → H
  const zs = [0];
  const nCol = Math.max(1, Math.round(hc / passoZ));
  for (let i = 1; i <= nCol; i++) zs.push((i / nCol) * hc);
  const iCol = zs.length - 1;                   // índice da linha z = hc (lado do colarinho)
  const nCorpo = Math.max(2, Math.round((H - hc) / passoZ));
  for (let i = 0; i <= nCorpo; i++) zs.push(hc + (i / nCorpo) * (H - hc));   // repete z = hc (lado do corpo)
  const NZ = zs.length;
  const phi = (z) => ((c.torcao * Math.PI) / 180) * (z / H);

  const ext = new Array(NZ * NT), int = new Array(NZ * NT);
  for (let i = 0; i < NZ; i++) {
    const z = zs[i], s = torcidaEscala(c, z), f = phi(z);
    const colar = i <= iCol;
    for (let j = 0; j < NT; j++) {
      const th = (j / NT) * 2 * Math.PI;
      const re = torcidaRaio(c, th - f) * s;
      const ri = colar ? rc : torcidaRaioInt(c, th - f, s);
      ext[i * NT + j] = [re * Math.cos(th), re * Math.sin(th), z];
      int[i * NT + j] = [ri * Math.cos(th), ri * Math.sin(th), z];
    }
  }
  const out = [];
  const tri = (a, b, d) => { out.push(a[0], a[1], a[2], b[0], b[1], b[2], d[0], d[1], d[2]); };
  for (let i = 0; i < NZ - 1; i++) {
    for (let j = 0; j < NT; j++) {
      const k = (j + 1) % NT;
      // exterior (as duas linhas z = hc coincidem no exterior → saltar o quad degenerado)
      if (i !== iCol) {
        const a = ext[i * NT + j], b = ext[i * NT + k], cc = ext[(i + 1) * NT + k], d = ext[(i + 1) * NT + j];
        tri(a, b, cc); tri(a, cc, d);
      }
      // interior (no salto do colarinho este quad é o degrau horizontal)
      const a = int[i * NT + j], b = int[i * NT + k], cc = int[(i + 1) * NT + k], d = int[(i + 1) * NT + j];
      tri(a, cc, b); tri(a, d, cc);
    }
  }
  // fundo (z = 0, normal −z) e topo (z = H, normal +z)
  const L = NZ - 1;
  for (let j = 0; j < NT; j++) {
    const k = (j + 1) % NT;
    tri(ext[j], int[j], int[k]); tri(ext[j], int[k], ext[k]);
    tri(ext[L * NT + j], ext[L * NT + k], int[L * NT + k]); tri(ext[L * NT + j], int[L * NT + k], int[L * NT + j]);
  }
  // O exterior salta o quad em i = iCol, mas as linhas iCol e iCol+1 do
  // exterior são os mesmos pontos → reutilizar a mesma linha mantém a malha fechada.
  return { tris: out, rc, hc };
}

// ═════════════════════════════════════════════════════════════════════════════
// Candeeiro perfurado
// ═════════════════════════════════════════════════════════════════════════════

const FORMATOS_PERF = { 'Quadrado': 4, 'Hexágono': 6, 'Octógono': 8, 'Dodecágono': 12 };

export function perfuradaConfig(p) {
  const formato = FORMATOS_PERF[p?.formato] ? p.formato : 'Hexágono';
  const N = FORMATOS_PERF[formato];
  const D = num(p?.diametro_mm, 130, 80, 240);
  const H = num(p?.altura_mm, 170, 80, 280);
  const t = num(p?.parede_mm, 2.4, 1.6, 4);
  const padrao = ['Losangos', 'Favos', 'Gotas'].includes(p?.padrao) ? p.padrao : 'Losangos';
  const furo = num(p?.tamanho_furo_mm, 10, 5, 25);
  const espaco = num(p?.espaco_mm, 3.5, 2, 10);
  const Rc = D / 2;
  const W = 2 * Rc * Math.sin(Math.PI / N);                  // largura de cada face
  const ap = Rc * Math.cos(Math.PI / N);                     // apótema exterior
  const cut = t * Math.tan(Math.PI / N);                     // recuo do canto interior
  const margemLado = cut + Math.max(espaco, 2.5);
  const margemBaixo = LIP_H + Math.max(espaco, 4);
  const margemCima = Math.max(espaco, 6);
  return { tipo: 'iluminaria-perfurada', formato, N, D, Rc, H, t, padrao, furo, espaco, W, ap, cut, margemLado, margemBaixo, margemCima, ...luzDe(p) };
}

/** Contorno de um furo (sentido horário em (s, z)), centrado em (cs, cz). */
function contornoFuro(c, cs, cz) {
  const f = c.furo;
  if (c.padrao === 'Losangos') {
    const w = f * 0.75, h = f * 1.25;                          // lados a ~59° → sem suportes
    return [[cs, cz + h / 2], [cs + w / 2, cz], [cs, cz - h / 2], [cs - w / 2, cz]];
  }
  if (c.padrao === 'Favos') {
    const r = f / 2;                                           // hexágono de bico para cima
    return Array.from({ length: 6 }, (_, i) => {
      const a = Math.PI / 2 - (i * Math.PI) / 3;
      return [cs + r * Math.cos(a), cz + r * Math.sin(a)];
    });
  }
  // Gotas: círculo com bico a 45° em cima (sem suportes). Do bico, arco de
  // 45° a −225° (= 135°) em sentido horário.
  const r = f / 2.6, pts = [[cs, cz + r * Math.SQRT2]];
  for (let i = 0; i <= 18; i++) {
    const a = Math.PI / 4 - (i / 18) * (Math.PI * 1.5);
    pts.push([cs + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  return pts;
}

/** Garante sentido horário em (s, z) — as paredes dos furos dependem disso. */
function horario(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; a += x0 * y1 - x1 * y0; }
  return a > 0 ? pts.slice().reverse() : pts;
}

/** Furos de uma face (coordenadas locais s ∈ [0,W], z ∈ [0,H]). */
export function perfuradaFuros(c) {
  const larg = c.W - 2 * c.margemLado, alt = c.H - c.margemBaixo - c.margemCima;
  const altF = c.padrao === 'Losangos' ? c.furo * 1.25 : c.padrao === 'Favos' ? c.furo : c.furo * 0.95;
  const largF = c.padrao === 'Losangos' ? c.furo * 0.75 : c.padrao === 'Favos' ? c.furo * 0.866 : c.furo * 0.77;
  const passoS = largF + c.espaco;
  const escalonado = c.padrao !== 'Gotas';
  // Em padrão escalonado as linhas aproximam-se (encaixam umas nas outras)
  const passoZ = escalonado ? (altF / 2 + c.espaco * 0.9) : altF + c.espaco;
  const nS = Math.max(1, Math.floor((larg - largF) / passoS) + 1);
  const nZ = Math.max(1, Math.floor((alt - altF) / passoZ) + 1);
  const s0 = c.margemLado + (larg - ((nS - 1) * passoS + largF)) / 2 + largF / 2;
  const z0 = c.margemBaixo + (alt - ((nZ - 1) * passoZ + altF)) / 2 + altF / 2;
  const furos = [];
  for (let iz = 0; iz < nZ; iz++) {
    const desloc = escalonado && iz % 2 === 1;
    const n = desloc ? nS - 1 : nS;
    for (let is = 0; is < n; is++) {
      furos.push(horario(contornoFuro(c, s0 + is * passoS + (desloc ? passoS / 2 : 0), z0 + iz * passoZ)));
    }
  }
  return furos;
}

export function perfuradaMalha(c) {
  const { N, W, H, t, ap, cut, Rc } = c;
  const furos = perfuradaFuros(c);
  const out = [];
  const tri = (a, b, d) => { out.push(a[0], a[1], a[2], b[0], b[1], b[2], d[0], d[1], d[2]); };

  // Triangulação 2D da face (retângulo [s0,s1]×[0,H] menos furos), feita uma vez
  const triangular = (s0, s1) => {
    const coords = [s0, 0, s1, 0, s1, H, s0, H];               // anti-horário
    const holes = [];
    for (const f of furos) { holes.push(coords.length / 2); for (const [s, z] of f) coords.push(s, z); }
    return { coords, idx: earcut(coords, holes, 2) };
  };
  const faceExt = triangular(0, W);
  const faceInt = triangular(cut, W - cut);

  for (let k = 0; k < N; k++) {
    // Face k: do canto k ao canto k+1 (anti-horário visto de cima)
    const a0 = (2 * Math.PI * k) / N, a1 = (2 * Math.PI * (k + 1)) / N;
    const P0 = [Rc * Math.cos(a0), Rc * Math.sin(a0)], P1 = [Rc * Math.cos(a1), Rc * Math.sin(a1)];
    const u = [(P1[0] - P0[0]) / W, (P1[1] - P0[1]) / W];      // ao longo da face
    const am = (a0 + a1) / 2, nIn = [-Math.cos(am), -Math.sin(am)];   // normal para dentro
    const E = (s, z) => [P0[0] + u[0] * s, P0[1] + u[1] * s, z];
    const I = (s, z) => [P0[0] + u[0] * s + nIn[0] * t, P0[1] + u[1] * s + nIn[1] * t, z];

    // A orientação dos triângulos do earcut não é garantida → orientar à mão.
    // Exterior: anti-horário em (s, z) → normal para fora (u × z aponta para fora).
    // Interior: horário → normal para dentro.
    const emitir = (face, map, antiHorario) => {
      for (let i = 0; i < face.idx.length; i += 3) {
        const q = [face.idx[i], face.idx[i + 1], face.idx[i + 2]];
        const p2 = q.map(j => [face.coords[2 * j], face.coords[2 * j + 1]]);
        const area = (p2[1][0] - p2[0][0]) * (p2[2][1] - p2[0][1]) - (p2[2][0] - p2[0][0]) * (p2[1][1] - p2[0][1]);
        const v = p2.map(([ss, zz]) => map(ss, zz));
        if ((area > 0) === antiHorario) tri(v[0], v[1], v[2]); else tri(v[0], v[2], v[1]);
      }
    };
    emitir(faceExt, E, true);
    emitir(faceInt, I, false);
    // Paredes dos furos (contornos em sentido horário)
    for (const f of furos) {
      for (let i = 0; i < f.length; i++) {
        const [s0, z0] = f[i], [s1, z1] = f[(i + 1) % f.length];
        const e0 = E(s0, z0), e1 = E(s1, z1), i0 = I(s0, z0), i1 = I(s1, z1);
        tri(e1, e0, i0); tri(e1, i0, i1);
      }
    }
    // Topo (normal +z) e fundo (normal −z) da face, entre o canto exterior e o interior
    const eA0 = E(0, 0), eB0 = E(W, 0), iA0 = I(cut, 0), iB0 = I(W - cut, 0);
    const eA1 = E(0, H), eB1 = E(W, H), iA1 = I(cut, H), iB1 = I(W - cut, H);
    tri(eA1, eB1, iB1); tri(eA1, iB1, iA1);
    tri(eB0, eA0, iA0); tri(eB0, iA0, iB0);
  }
  return { tris: out, furos, apInt: ap - t };
}

/** Polígono interior em z = 0 (para o rebordo da base), lista de [x, y]. */
export function perfuradaPoligonoInt(c) {
  const rInt = (c.ap - c.t) / Math.cos(Math.PI / c.N);
  return Array.from({ length: c.N }, (_, k) => {
    const a = (2 * Math.PI * k) / c.N;
    return [rInt * Math.cos(a), rInt * Math.sin(a)];
  });
}
export function perfuradaPoligonoExt(c) {
  return Array.from({ length: c.N }, (_, k) => {
    const a = (2 * Math.PI * k) / c.N;
    return [c.Rc * Math.cos(a), c.Rc * Math.sin(a)];
  });
}

/**
 * Configuração final: se o diâmetro for pequeno demais para a luz caber
 * dentro do rebordo da base, alarga-se a peça (em passos de 5 mm).
 */
export function iluminariaConfig(gerador, p) {
  const perf = gerador === 'iluminaria-perfurada';
  let q = { ...p };
  for (let it = 0; it < 40; it++) {
    const c = perf ? perfuradaConfig(q) : torcidaConfig(q);
    const precisa = c.luz.pocketD / 2 + 1;                      // raio livre necessário dentro do rebordo
    const livre = perf
      ? (c.ap - c.t) - FOLGA - LIP_T                            // apótema interior do rebordo
      : torcidaColarinho(c).rc - FOLGA - LIP_T;
    if (livre >= precisa || c.luz.pocketD === 0) return { ...c, diametroPedido: Number(p?.diametro_mm) || c.D };
    q = { ...q, diametro_mm: c.D + 5 };
  }
  return perf ? perfuradaConfig(q) : torcidaConfig(q);
}

/** Entrada única: config + malha da peça principal para um gerador. */
export function iluminaria(gerador, p, opts = {}) {
  const c = iluminariaConfig(gerador, p);
  if (c.tipo === 'iluminaria-perfurada') {
    return { c, ...perfuradaMalha(c), baseExt: perfuradaPoligonoExt(c), rebordo: { tipo: 'poligono', pts: perfuradaPoligonoInt(c) } };
  }
  const m = torcidaMalha(c, opts);
  return { c, ...m, baseExt: torcidaContornoBase(c), rebordo: { tipo: 'circulo', r: m.rc } };
}
