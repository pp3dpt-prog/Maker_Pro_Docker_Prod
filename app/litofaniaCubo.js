/**
 * Litofânia Cubo — candeeiro de 4 faces (como os cubos de litofânia do
 * MakerWorld/Printables): três peças que encaixam umas nas outras.
 *
 *  - paredes.stl : as 4 faces de litofânia numa só peça (tubo quadrado),
 *                  impressa DE PÉ — a melhor orientação para litofânias e sem
 *                  suportes. Gerada em JS (malha fechada, um só invólucro).
 *  - base.stl    : encaixe para a luz + canal para o cabo por baixo + rebordo
 *                  onde as paredes encaixam. OpenSCAD (formas simples).
 *  - tampa.stl   : tampa com rebordo de encaixe. OpenSCAD.
 *
 * Luzes suportadas (as que os makers usam nestes candeeiros):
 *  - 'LED Kit 001 (Bambu)': disco LED Ø59 × 18 mm, USB 5 V (Bambu Lab
 *    LED Lamp Kit-001 / MH001 e compatíveis) — traz fita de dupla face.
 *  - 'Casquilho E14 (M10)': casquilho E14 com tubo roscado M10×1 (furo 10.5).
 *  - 'Vela LED': vela LED tipo "tea light" (Ø ≈ 38 mm), sem fios.
 *
 * Faces vistas de fora: 0 frente (−y), 1 direita (+x), 2 trás (+y),
 * 3 esquerda (−x). Em todas, o lado liso fica para fora (é por onde a imagem
 * se lê) e o relevo para dentro, virado para a luz.
 */

import Jimp from 'jimp';
import { heightmapLitofania } from './image-proc.js';

export const CUBO_LUZES = {
  'LED Kit 001 (Bambu)': { pocketD: 60.2, pocketH: 10, holeD: 12,   grooveW: 10, grooveH: 5, floor: 7 },
  'Casquilho E14 (M10)': { pocketD: 0,    pocketH: 0,  holeD: 10.5, grooveW: 8,  grooveH: 5, floor: 8 },
  'Vela LED':            { pocketD: 39.5, pocketH: 8,  holeD: 0,    grooveW: 0,  grooveH: 0, floor: 3 },
};
const LUZ_DEFAULT = 'LED Kit 001 (Bambu)';

const LIP_BASE = 5;     // altura do rebordo da base (entra dentro das paredes)
const LIP_TAMPA = 3;    // altura do rebordo da tampa
const LIP_T = 2;        // espessura dos rebordos
const FOLGA = 0.3;      // folga do encaixe, por lado

export function cuboGeometria(p) {
  const espMin = Math.max(0.3, Number(p.esp_min ?? 0.6));
  const espMax = Math.max(espMin + 0.5, Number(p.esp_max ?? 3.0));
  const L  = Math.max(80, Math.min(160, Number(p.lado_mm ?? 100)));
  const H  = Math.max(60, Math.min(220, Number(p.altura_mm ?? 100)));
  // A moldura tem de ser mais larga do que a espessura máxima (cantos)
  const m  = Math.max(espMax + 1, Math.min(20, Number(p.moldura_mm ?? 6)));
  const mB = m + LIP_BASE;        // em baixo a moldura também tapa o rebordo da base
  const mT = m + LIP_TAMPA;
  const luzNome = CUBO_LUZES[p.luz] ? p.luz : LUZ_DEFAULT;
  const luz = CUBO_LUZES[luzNome];
  const hb = luz.floor + luz.pocketH;   // altura da base
  return {
    L, H, m, mB, mT, espMin, espMax, luzNome, luz, hb,
    imgW: L - 2 * m,
    imgH: H - mB - mT,
  };
}

/** Rácio largura/altura da imagem de cada face. */
export function cuboAspect(p) {
  const g = cuboGeometria(p);
  return g.imgW / g.imgH;
}

/**
 * Paredes: tubo quadrado L×L×H, faces lisas por fora, relevo por dentro.
 * heightmaps[k]: matriz de frações 0..1 (1 = mais fino/claro), linha 0 = topo
 * da imagem; espessura = espMin + (1−f)·(espMax−espMin). Fora da imagem
 * (moldura) a espessura é espMax.
 * passo: resolução da grelha interior em mm.
 */
export function generateCubeWallsStl({ heightmaps, geo, passo = 0.4 }) {
  const { L, H, m, mT, espMin, espMax, imgW, imgH } = geo;
  const N  = Math.max(8, Math.round(L / passo));          // colunas por face
  const NR = Math.max(8, Math.round(H / passo));          // linhas
  const a  = L / 2 - espMax;                               // canto interior

  const faces = [
    { C: [-L / 2, -L / 2], u: [1, 0],  n: [0, 1]  },       // 0 frente (−y)
    { C: [ L / 2, -L / 2], u: [0, 1],  n: [-1, 0] },       // 1 direita (+x)
    { C: [ L / 2,  L / 2], u: [-1, 0], n: [0, -1] },       // 2 trás (+y)
    { C: [-L / 2,  L / 2], u: [0, -1], n: [1, 0]  },       // 3 esquerda (−x)
  ];

  // Na zona da imagem o ponto interior fica exatamente atrás do exterior; só
  // na moldura (espessura constante) é comprimido até ao canto interior, para
  // as faces vizinhas se juntarem num só invólucro.
  const mapX = (x) => {
    const lim = L / 2 - m;
    if (Math.abs(x) <= lim) return x;
    return Math.sign(x) * (lim + (Math.abs(x) - lim) * ((m - espMax) / m));
  };

  const amostra = (hm, s, z) => {
    // s: posição ao longo da face (0..L); z: altura (0..H)
    const sx = s - m, sz = (H - mT) - z;                    // origem no canto sup. esq. da imagem
    if (sx < 0 || sx > imgW || sz < 0 || sz > imgH || !hm) return null;
    const rows = hm.length, cols = hm[0].length;
    const u = (sx / imgW) * (cols - 1), v = (sz / imgH) * (rows - 1);
    const c0 = Math.min(cols - 1, Math.floor(u)), r0 = Math.min(rows - 1, Math.floor(v));
    const c1 = Math.min(cols - 1, c0 + 1), r1 = Math.min(rows - 1, r0 + 1);
    const fu = u - c0, fv = v - r0;
    const top = hm[r0][c0] * (1 - fu) + hm[r0][c1] * fu;
    const bot = hm[r1][c0] * (1 - fu) + hm[r1][c1] * fu;
    return top * (1 - fv) + bot * fv;
  };

  // Pontos interiores: coluna global g = k·N + j (0..4N−1), linha i (0..NR)
  const total = 4 * N;
  const inner = new Array((NR + 1) * total);
  for (let k = 0; k < 4; k++) {
    const { C, u, n } = faces[k];
    for (let j = 0; j < N; j++) {
      const s = (j / N) * L;
      const xi = L / 2 + mapX(s - L / 2);
      for (let i = 0; i <= NR; i++) {
        const z = (i / NR) * H;
        const f = amostra(heightmaps[k], s, z);
        const t = f === null ? espMax : espMin + (1 - f) * (espMax - espMin);
        inner[i * total + k * N + j] = [C[0] + u[0] * xi + n[0] * t, C[1] + u[1] * xi + n[1] * t, z];
      }
    }
  }
  const I = (i, g) => inner[i * total + (g % total)];
  // Cantos exteriores
  const cant = (k, z) => [faces[k % 4].C[0], faces[k % 4].C[1], z];

  const nTri = 2 * NR * total /* interior */ + 8 /* exterior */ + 2 * (total + 4) /* tampas */;
  const stl = new EscritorStlCubo(nTri);

  // Interior (normal para dentro)
  for (let i = 0; i < NR; i++) {
    for (let g = 0; g < total; g++) {
      const p00 = I(i, g), p01 = I(i, g + 1), p11 = I(i + 1, g + 1), p10 = I(i + 1, g);
      stl.tri(p00, p11, p01); stl.tri(p00, p10, p11);
    }
  }
  // Exterior: um retângulo por face (é plano)
  for (let k = 0; k < 4; k++) {
    const A0 = cant(k, 0), B0 = cant(k + 1, 0), B1 = cant(k + 1, H), A1 = cant(k, H);
    stl.tri(A0, B0, B1); stl.tri(A0, B1, A1);
  }
  // Topo (normal +z) e fundo (normal −z): leque a partir do canto exterior
  for (let k = 0; k < 4; k++) {
    const Ao = cant(k, H), Bo = cant(k + 1, H), Ab = cant(k, 0), Bb = cant(k + 1, 0);
    for (let j = 0; j < N; j++) {
      const g = k * N + j;
      stl.tri(Ao, I(NR, g + 1), I(NR, g));
      stl.tri(Ab, I(0, g), I(0, g + 1));
    }
    stl.tri(Ao, Bo, I(NR, (k + 1) * N));
    stl.tri(Ab, I(0, (k + 1) * N), Bb);
  }
  return stl.fim();
}

export const CUBO_IMAGENS = ['image_path', 'image_path_2', 'image_path_3', 'image_path_4'];

/**
 * Gera as paredes a partir dos parâmetros: descarrega até 4 imagens (uma por
 * face; faces sem imagem repetem a 1.ª) e devolve { stl, geo }.
 * baixarImagem(path) → Buffer. final=false gera mais leve (pré-visualização).
 */
export async function gerarParedesCubo({ params, baixarImagem, final = true }) {
  const geo = cuboGeometria(params);
  const caminhos = CUBO_IMAGENS.map(k => params[k]).map(v => (typeof v === 'string' && v.startsWith('uploads/')) ? v : null);
  if (!caminhos[0]) { const e = new Error('Carrega pelo menos a 1.ª foto.'); e.status = 400; throw e; }
  const pxMm = final ? 2.5 : 1;                       // 0.4 mm/px chega para FDM com bico 0.4
  const targetLong = Math.round(Math.min(final ? 400 : 120, Math.max(geo.imgW, geo.imgH) * pxMm));
  const opts = {
    targetLong, aspect: geo.imgW / geo.imgH,
    fit: params.img_ajuste ?? 'Preencher',
    zoom: Number(params.img_zoom ?? 100), posX: Number(params.img_pos_x ?? 0), posY: Number(params.img_pos_y ?? 0),
    espMin: geo.espMin, espMax: geo.espMax,
  };
  const cache = new Map();
  const heightmaps = [];
  for (const c of caminhos) {
    const caminho = c ?? caminhos[0];
    if (!cache.has(caminho)) {
      const raw = await Jimp.read(await baixarImagem(caminho));
      cache.set(caminho, await heightmapLitofania(raw, opts));
    }
    heightmaps.push(cache.get(caminho));
  }
  const stl = generateCubeWallsStl({ heightmaps, geo, passo: final ? 0.4 : 1.0 });
  return { stl, geo };
}

/** OpenSCAD da base (origem no canto; paredes assentam em z = hb). */
export function cuboBaseScad(geo) {
  const { L, espMax, hb, luz } = geo;
  const lipOut = L - 2 * (espMax + FOLGA);
  const o = espMax + FOLGA;
  return `// pp3d — Litofânia Cubo: base (${geo.luzNome})
$fn = 128;
L = ${L}; hb = ${hb};
difference() {
  union() {
    cube([L, L, hb]);
    // rebordo onde as paredes encaixam
    translate([${o}, ${o}, hb]) difference() {
      cube([${lipOut}, ${lipOut}, ${LIP_BASE}]);
      translate([${LIP_T}, ${LIP_T}, -1]) cube([${lipOut - 2 * LIP_T}, ${lipOut - 2 * LIP_T}, ${LIP_BASE + 2}]);
    }
  }
${luz.pocketD > 0 ? `  // encaixe da luz
  translate([L/2, L/2, hb - ${luz.pocketH}]) cylinder(d = ${luz.pocketD}, h = ${luz.pocketH + 1});` : ''}
${luz.holeD > 0 ? `  // passagem do cabo
  translate([L/2, L/2, -1]) cylinder(d = ${luz.holeD}, h = hb + 2, $fn = 64);
  // canal do cabo por baixo, até ao meio da face de trás
  translate([L/2 - ${luz.grooveW / 2}, L/2, -1]) cube([${luz.grooveW}, L/2 + 1, ${luz.grooveH + 1}]);` : ''}
}
`;
}

/** OpenSCAD da tampa (imprimir assim, rebordo para cima; vira-se ao montar). */
export function cuboTampaScad(geo) {
  const { L, espMax } = geo;
  const lipOut = L - 2 * (espMax + FOLGA);
  const o = espMax + FOLGA;
  return `// pp3d — Litofânia Cubo: tampa
L = ${L};
cube([L, L, 3]);
translate([${o}, ${o}, 3]) difference() {
  cube([${lipOut}, ${lipOut}, ${LIP_TAMPA}]);
  translate([${LIP_T}, ${LIP_T}, -1]) cube([${lipOut - 2 * LIP_T}, ${lipOut - 2 * LIP_T}, ${LIP_TAMPA + 2}]);
}
`;
}

// STL binário pré-alocado (igual ao EscritorStl de hueforge-stl.js)
class EscritorStlCubo {
  constructor(max) { this.buf = Buffer.alloc(84 + 50 * max); this.n = 0; this.o = 84; this.max = max; }
  tri(a, b, c) {
    if (this.n >= this.max) throw new Error('EscritorStlCubo: capacidade excedida');
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const B = this.buf; const o = this.o;
    B.writeFloatLE(nx, o); B.writeFloatLE(ny, o + 4); B.writeFloatLE(nz, o + 8);
    B.writeFloatLE(a[0], o + 12); B.writeFloatLE(a[1], o + 16); B.writeFloatLE(a[2], o + 20);
    B.writeFloatLE(b[0], o + 24); B.writeFloatLE(b[1], o + 28); B.writeFloatLE(b[2], o + 32);
    B.writeFloatLE(c[0], o + 36); B.writeFloatLE(c[1], o + 40); B.writeFloatLE(c[2], o + 44);
    this.o = o + 50; this.n++;
  }
  fim() { this.buf.writeUInt32LE(this.n, 80); return this.n === this.max ? this.buf : this.buf.subarray(0, 84 + 50 * this.n); }
}
