/**
 * Bola de Natal (litofânia esfera): gola com baioneta de ¼ de volta e tampa com a vela LED.
 * A mesma conta está em Maker_Pro_Frontend_Prod/lib/tampaBola.ts (pré-visualização) —
 * se mudares aqui, muda lá também.
 *
 * Coordenadas da bola: z = 0 é o fundo da gola (assenta na base da impressora); ponto no
 * anel de raio r e longitude λ: [r·sin λ, −r·cos λ, z] (igual a generateLithophaneSphereStl).
 *
 * Gola: tubo de z = 0 a hc, por dentro com 3 ranhuras em L:
 *   - entrada vertical aberta em baixo (até ao tecto);
 *   - ranhura horizontal entre o chão (floor) e o tecto (ceil), para o lado de +λ;
 *   - um ressalto no chão logo a seguir à entrada (bumpZ): o patim só passa com a tampa
 *     empurrada até ao fim; ao largar, o peso da tampa assenta o patim atrás do ressalto e ela
 *     já não roda para trás (para tirar: empurrar, rodar para trás e puxar).
 * Tampa (imprime à parte, deitada com a aba para baixo): aba com furo ao meio (para empurrar a
 * vela / chegar ao botão), copo onde encaixa a vela e 3 patins por fora do copo.
 */

const MM = (mm, r) => mm / r;   // arco em mm → ângulo (rad) no raio r

export function tampaGeometria(diametroVela = 38) {
  const Dv = Math.max(20, Math.min(50, Number(diametroVela) || 38));
  const rci = Dv / 2 + 0.4;          // copo: raio interior (folga para a vela)
  const wp = 1.6;                    // parede do copo
  const rp = rci + wp;               // copo: raio exterior
  const lp = 1.4;                    // saliência dos patins
  const ra = rp + 0.3;               // gola: raio interior (folga)
  const dg = lp;                     // profundidade das ranhuras → fundo da ranhura = patim + 0.3
  const wc = dg + 1.8;               // parede da gola
  const rg = ra + wc;                // gola: raio exterior
  const floor = 3.2, bumpZ = 3.7, ceil = 6.6, hc = 9.0;
  const hl = 2.4;                    // altura dos patins
  const zl0Full = 3.9;               // fundo dos patins com a tampa empurrada até ao fim (> bumpZ)
  const tf = 2.4;                    // espessura da aba
  const rf = rg + 1.5;               // raio da aba
  const rh = Math.max(5, Dv / 2 - 4); // furo da aba (a vela assenta num rebordo de ~4 mm)
  const topoCopo = hc - 0.4;         // altura do copo acima da aba
  const wl = MM(7, rp);              // largura dos patins (7 mm)
  const we = MM(8, rp);              // largura da entrada (patim + 0.5 mm de cada lado)
  const bw = MM(2, ra);              // comprimento do ressalto
  const rot = we / 2 + bw + wl / 2 + MM(0.5, ra);   // quanto se roda a tampa (centro do patim fechado)
  const fim = rot + wl / 2 + MM(0.5, ra);           // fim da ranhura horizontal
  return { Dv, rci, wp, rp, lp, ra, dg, wc, rg, floor, bumpZ, ceil, hc, hl, zl0Full, tf, rf, rh, topoCopo, wl, we, bw, rot, fim, nLug: 3 };
}

const ang = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };

/** Profundidade das ranhuras da gola (0 ou dg) na longitude λ e altura z. */
export function profRanhura(g, lam, z) {
  for (let k = 0; k < g.nLug; k++) {
    const a = ang(lam - (k * 2 * Math.PI) / g.nLug);
    if (z > g.ceil + 1e-9) continue;
    if (Math.abs(a) <= g.we / 2) return g.dg;                                   // entrada
    if (a > g.we / 2 && a <= g.fim) {                                           // horizontal
      const chao = a <= g.we / 2 + g.bw ? g.bumpZ : g.floor;
      if (z >= chao - 1e-9) return g.dg;
    }
  }
  return 0;
}

/** Saliência dos patins da tampa (coordenadas da tampa: aba em z 0..tf). */
export function saliPatim(g, lam, z) {
  const z0 = g.tf + g.zl0Full, z1 = z0 + g.hl;
  if (z < z0 - 1e-9 || z > z1 + 1e-9) return 0;
  for (let k = 0; k < g.nLug; k++) {
    const a = ang(lam - (k * 2 * Math.PI) / g.nLug);
    if (Math.abs(a) <= g.wl / 2) return Math.min(g.lp, 0.5 + (z - z0));      // por baixo: 0.5 mm e depois 45°
  }
  return 0;
}

// alturas das linhas: de 0.2 em 0.2 mm, mais as arestas exactas (e 0.02 mm antes, para ficarem vivas)
function linhas(z0, z1, arestas) {
  const zs = [];
  const n = Math.ceil((z1 - z0) / 0.2);
  for (let i = 0; i <= n; i++) zs.push(z0 + ((z1 - z0) * i) / n);
  for (const e of arestas) if (e > z0 && e < z1) zs.push(e, e - 0.02, e + 0.02);
  return [...new Set(zs.map((z) => Math.round(z * 1000) / 1000))].filter((z) => z >= z0 && z <= z1).sort((a, b) => a - b);
}

/**
 * Triângulos da gola, a ligar ao anel de baixo da esfera.
 * lams: longitudes (as mesmas da esfera); topoExt(j): ponto exterior da esfera no corte (z = hc);
 * o anel interior de cima é [ra·sin λ, −ra·cos λ, hc] (a esfera tem de usar esse mesmo ponto).
 * emit(a, b, c) com normal para fora.
 */
export function golaTriangulos(g, lams, topoExt, emit) {
  const NL = lams.length;
  const Q = (r, l, z) => [r * Math.sin(l), -r * Math.cos(l), z];
  const zs = linhas(0, g.hc, [g.floor, g.bumpZ, g.ceil]);
  // perfil por longitude (percorrido no sentido em que o sólido fica à direita → triângulos invertidos)
  const perfil = (j) => {
    const l = lams[j], t = topoExt(j);
    const pts = [t, [t[0], t[1], 0]];
    for (const z of zs) pts.push(Q(z >= g.hc - 1e-9 ? g.ra : g.ra + profRanhura(g, l, z), l, z));
    return pts;
  };
  const P = lams.map((_, j) => perfil(j));
  for (let j = 0; j < NL; j++) {
    const k = (j + 1) % NL;
    for (let m = 0; m < P[j].length - 1; m++) {
      const a = P[j][m], b = P[k][m], c = P[k][m + 1], d = P[j][m + 1];
      emit(a, c, b); emit(a, d, c);
    }
  }
}

/**
 * Triângulos da tampa (sólido fechado), com a aba em z = 0 e o centro em (x0, y0).
 * rodar: rotação em λ (para a mostrar fechada na pré-visualização); emit com normal para fora.
 */
export function tampaTriangulos(g, emit, { x0 = 0, y0 = 0, z0 = 0, rodar = 0, NC = 720 } = {}) {
  const Q = (r, l, z) => [x0 + r * Math.sin(l + rodar), y0 - r * Math.cos(l + rodar), z0 + z];
  const top = g.tf + g.topoCopo;
  const zs = linhas(g.tf, top, [g.tf + g.zl0Full, g.tf + g.zl0Full + g.hl]);
  // contorno fechado (r, z) no sentido anti-horário (sólido à esquerda)
  const perfil = (l) => [
    [g.rh, 0], [g.rf, 0], [g.rf, g.tf],
    ...zs.map((z) => [g.rp + saliPatim(g, l, z), z]),
    [g.rci, top], [g.rci, g.tf], [g.rh, g.tf],
  ];
  const lams = Array.from({ length: NC }, (_, j) => -Math.PI + (j * 2 * Math.PI) / NC);
  const P = lams.map((l) => perfil(l).map(([r, z]) => Q(r, l, z)));
  const M = P[0].length;
  for (let j = 0; j < NC; j++) {
    const k = (j + 1) % NC;
    for (let m = 0; m < M; m++) {
      const n = (m + 1) % M;
      const a = P[j][m], b = P[k][m], c = P[k][n], d = P[j][n];
      emit(a, b, c); emit(a, c, d);
    }
  }
}
