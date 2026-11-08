/**
 * Gerador de STL binário para produtos baseados em imagem.
 * Suporta: HueForge, Marcadores, Litofânia Plana e Litofânia Curva.
 */

import { golaTriangulos, tampaTriangulos } from './tampaBola.js';

// ─────────────────────────────────────────────────────────────────────────────
// Alinhamento às camadas do slicer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ajusta espessura da base e altura do relevo para que TODAS as fronteiras de
 * cor (fim da base e fim de cada banda) caiam exatamente no topo de uma camada
 * do slicer: primeira camada = primeiraCamada, restantes = layerHeight.
 * Sem isto a troca de filamento calculada (ex.: 0.60 mm com camadas de 0.16)
 * caía a meio de uma camada e o guia não batia com o que o slicer mostra.
 * Usar os valores devolvidos TANTO no STL como no guia TXT.
 */
export function alinharCamadasHueforge({ espBase, altRelevo, numCores, layerHeight, primeiraCamada }) {
  const r4 = (v) => Math.round(v * 10000) / 10000;
  const lh = Math.max(0.04, Number(layerHeight) || 0.12);
  const fl = Math.max(0.04, Number(primeiraCamada) || lh);
  const niveis = Math.max(1, Math.max(2, numCores) - 1);

  // Base: 1.ª camada + k camadas normais (no mínimo só a 1.ª camada)
  const kBase   = Math.max(0, Math.round((Number(espBase) - fl) / lh));
  const base    = r4(fl + kBase * lh);
  // Cada banda: número inteiro de camadas (mín. 1)
  const kBanda  = Math.max(1, Math.round(Number(altRelevo) / niveis / lh));
  const bandaMm = r4(kBanda * lh);

  return {
    espBase: base,
    altRelevo: r4(bandaMm * niveis),
    bandaMm,
    camadasBanda: kBanda,
    layerHeight: lh,
    primeiraCamada: fl,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HueForge / Marcadores — heightmap aditivo (escuro=baixo, claro=alto)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gera STL de heightmap aditivo (HueForge e marcadores sem furo).
 */
export function generateHueforgeStl({ heightmap, largura, altura, espBase, altRelevo }) {
  const rows = heightmap.length;
  const cols = heightmap[0].length;
  // (cols-1)/(rows-1): a malha tem cols×rows vértices → cols-1×rows-1 quads,
  // por isso a última coluna/linha cai exatamente em largura/altura (paredes encaixam).
  const scaleX = largura / Math.max(1, cols - 1);
  const scaleY = altura  / Math.max(1, rows - 1);
  // linha 0 da imagem (topo) fica em y = altura → imagem direita vista de cima
  const h = (r, c) => espBase + heightmap[rows - 1 - r][c] * altRelevo;
  return _buildHeightmapStl({ rows, cols, scaleX, scaleY, h, largura, altura });
}

/**
 * Gera STL de marcador com furo cilíndrico no topo.
 */
export function generateBookmarkStl({ heightmap, largura, altura, espBase, altRelevo, holeDiameter, holeMarginTop }) {
  const rows = heightmap.length;
  const cols = heightmap[0].length;
  const scaleX = largura / Math.max(1, cols - 1);
  const scaleY = altura  / Math.max(1, rows - 1);

  const holeR  = Math.max(0, Number(holeDiameter ?? 4) || 0) / 2;   // 0 = sem furo
  const holeCx = largura / 2;
  const holeCy = altura - (holeMarginTop ?? 6);

  const h = (r, c) => espBase + heightmap[rows - 1 - r][c] * altRelevo;

  // Limpa uma zona de quads à volta do furo; o furo redondo (cilindro) é depois
  // cosido a essa abertura por um "colar" de triângulos → furo redondo e malha
  // fechada, independente da resolução da grelha.
  const cellDiag = Math.hypot(scaleX, scaleY);
  const clearR   = holeR + cellDiag;
  const cleared  = (c, r) => {
    if (holeR <= 0) return false;
    const cx = (c + 0.5) * scaleX, cy = (r + 0.5) * scaleY;
    return (cx - holeCx) ** 2 + (cy - holeCy) ** 2 <= clearR ** 2;
  };

  const triangles = [];

  // ── Superfície superior (sem a zona limpa do furo) ───────────────────────
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      if (cleared(c, r)) continue;
      const x0 = c * scaleX, y0 = r * scaleY;
      const x1 = (c+1)*scaleX, y1 = (r+1)*scaleY;
      const p00=[x0,y0,h(r,c)], p10=[x1,y0,h(r,c+1)];
      const p01=[x0,y1,h(r+1,c)], p11=[x1,y1,h(r+1,c+1)];
      triangles.push([p00,p10,p11], [p00,p11,p01]);
    }
  }

  // ── Base inferior (sem a zona limpa do furo) ─────────────────────────────
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      if (cleared(c, r)) continue;
      const x0=c*scaleX, y0=r*scaleY, x1=(c+1)*scaleX, y1=(r+1)*scaleY;
      triangles.push([[x0,y0,0],[x1,y1,0],[x1,y0,0]], [[x0,y0,0],[x0,y1,0],[x1,y1,0]]);
    }
  }

  // ── Paredes laterais (normais para fora: −y, +y, −x, +x) ─────────────────
  for (let c = 0; c < cols-1; c++) {
    const x0=c*scaleX, x1=(c+1)*scaleX;
    triangles.push([[x0,0,0],[x1,0,h(0,c+1)],[x0,0,h(0,c)]], [[x0,0,0],[x1,0,0],[x1,0,h(0,c+1)]]);
    triangles.push([[x0,altura,h(rows-1,c)],[x1,altura,0],[x0,altura,0]], [[x0,altura,h(rows-1,c)],[x1,altura,h(rows-1,c+1)],[x1,altura,0]]);
  }
  for (let r = 0; r < rows-1; r++) {
    const y0=r*scaleY, y1=(r+1)*scaleY;
    triangles.push([[0,y0,h(r,0)],[0,y1,0],[0,y0,0]], [[0,y0,h(r,0)],[0,y1,h(r+1,0)],[0,y1,0]]);
    triangles.push([[largura,y0,0],[largura,y1,h(r+1,cols-1)],[largura,y0,h(r,cols-1)]], [[largura,y0,0],[largura,y1,0],[largura,y1,h(r+1,cols-1)]]);
  }

  if (holeR > 0) {
    // ── Furo cilíndrico passante + colar ─────────────────────────────────────
    // Traça o laço-fronteira da abertura (arestas da grelha entre quad limpo e
    // quad mantido), em ordem ao longo da fronteira → cada par consecutivo
    // partilha uma aresta real da superfície (malha fica fechada).
    const inGrid = (c, r) => c >= 0 && c < cols - 1 && r >= 0 && r < rows - 1;
    const clearedSafe = (c, r) => inGrid(c, r) && cleared(c, r);
    const vid = (vc, vr) => vr * cols + vc;
    const adjE = new Map();
    const addEdge = (a, b) => {
      if (!adjE.has(a)) adjE.set(a, []);
      if (!adjE.has(b)) adjE.set(b, []);
      adjE.get(a).push(b); adjE.get(b).push(a);
    };
    for (let vr = 0; vr < rows; vr++) {
      for (let vc = 0; vc < cols; vc++) {
        // aresta vertical (vc,vr)-(vc,vr+1): separa células (vc-1,vr) | (vc,vr)
        if (vr < rows - 1 && clearedSafe(vc - 1, vr) !== clearedSafe(vc, vr)) {
          addEdge(vid(vc, vr), vid(vc, vr + 1));
        }
        // aresta horizontal (vc,vr)-(vc+1,vr): separa células (vc,vr-1) | (vc,vr)
        if (vc < cols - 1 && clearedSafe(vc, vr - 1) !== clearedSafe(vc, vr)) {
          addEdge(vid(vc, vr), vid(vc + 1, vr));
        }
      }
    }

    // Percorre o laço seguindo arestas-fronteira
    const rim = [];
    if (adjE.size) {
      const start = adjE.keys().next().value;
      let prev = -1, cur = start;
      do {
        const vc = cur % cols, vr = Math.floor(cur / cols);
        const x = vc * scaleX, y = vr * scaleY;
        let ang = Math.atan2(y - holeCy, x - holeCx);
        if (ang < 0) ang += 2 * Math.PI;
        rim.push({ p: [x, y, h(vr, vc)], ang, vc, vr });
        const nbrs = adjE.get(cur);
        let next = nbrs.find(n => n !== prev);
        if (next === undefined) next = nbrs[0];
        prev = cur; cur = next;
      } while (cur !== start && rim.length <= adjE.size);
    }
    if (rim.length < 3) return buildBinaryStl(triangles); // sem furo utilizável

    // Orienta CCW (shoelace) e roda para começar no menor ângulo → ascendente
    let area2 = 0;
    for (let i = 0; i < rim.length; i++) {
      const a = rim[i].p, b = rim[(i + 1) % rim.length].p;
      area2 += a[0] * b[1] - b[0] * a[1];
    }
    if (area2 < 0) rim.reverse();
    let minI = 0;
    for (let i = 1; i < rim.length; i++) if (rim[i].ang < rim[minI].ang) minI = i;
    const rimO = rim.slice(minI).concat(rim.slice(0, minI));
    rim.length = 0; rim.push(...rimO);

    // Altura do topo do furo = altura da superfície na célula do centro
    const cc = Math.min(cols - 2, Math.max(0, Math.floor(holeCx / scaleX)));
    const rc = Math.min(rows - 2, Math.max(0, Math.floor(holeCy / scaleY)));
    const zTop = h(rc, cc);

    // Pontos do cilindro (topo a zTop, fundo a 0)
    const SEGS = 48;
    const circTop = [], circBot = [];
    for (let k = 0; k < SEGS; k++) {
      const a = (k / SEGS) * 2 * Math.PI;
      const x = holeCx + holeR * Math.cos(a), y = holeCy + holeR * Math.sin(a);
      circTop.push({ p: [x, y, zTop], ang: a });
      circBot.push({ p: [x, y, 0],    ang: a });
    }

    // Cose dois laços (exterior=rim, interior=círculo) por ângulo → anel fechado.
    const stitch = (outer, inner, flip) => {
      const m = outer.length, k = inner.length;
      if (m === 0 || k === 0) return;
      const angO = i => outer[i % m].ang + 2 * Math.PI * Math.floor(i / m);
      const angI = j => inner[j % k].ang + 2 * Math.PI * Math.floor(j / k);
      let i = 0, j = 0;
      while (i < m || j < k) {
        let tri;
        if (i < m && (j >= k || angO(i + 1) <= angI(j + 1))) {
          tri = [outer[i % m].p, outer[(i + 1) % m].p, inner[j % k].p];
          i++;
        } else {
          // (inner_j → outer_i → inner_j+1: mesma orientação dos triângulos que avançam por fora)
          tri = [inner[j % k].p, outer[i % m].p, inner[(j + 1) % k].p];
          j++;
        }
        triangles.push(flip ? [tri[0], tri[2], tri[1]] : tri);
      }
    };

    // Rim ao nível da base (z=0) para o colar de baixo
    const rimBot = rim.map(v => ({ p: [v.p[0], v.p[1], 0], ang: v.ang }));

    stitch(rim,    circTop, false);  // colar no topo (rim → círculo de cima)
    stitch(rimBot, circBot, true);   // colar no fundo (rim z=0 → círculo de baixo)

    // Parede do cilindro (círculo de cima → círculo de baixo)
    for (let k = 0; k < SEGS; k++) {
      const t0 = circTop[k].p, t1 = circTop[(k + 1) % SEGS].p;
      const b0 = circBot[k].p, b1 = circBot[(k + 1) % SEGS].p;
      triangles.push([t0, b1, b0], [t0, t1, b1]);   // normais para o centro do furo
    }
  }

  return buildBinaryStl(triangles);
}

// ─────────────────────────────────────────────────────────────────────────────
// Litofânia Plana — heightmap subtrativo (escuro=espesso, claro=fino)
// ─────────────────────────────────────────────────────────────────────────────

export function generateLithophaneFlatStl({ heightmap: hmImagem, largura: largImg, altura: altImg, espMax, espMin, moldura = 0 }) {
  // Moldura: anel à volta da imagem com a espessura máxima (heightmap = 0),
  // acrescentado POR FORA — a imagem mantém largura×altura e a peça cresce
  // 2×moldura em cada direção. Dá rigidez e esconde a borda fina e frágil.
  const r0 = hmImagem.length, c0 = hmImagem[0].length;
  const cellX = largImg / Math.max(1, c0 - 1), cellY = altImg / Math.max(1, r0 - 1);
  const pX = moldura > 0 ? Math.max(1, Math.round(moldura / cellX)) : 0;
  const pY = moldura > 0 ? Math.max(1, Math.round(moldura / cellY)) : 0;
  const heightmap = (pX || pY)
    ? Array.from({ length: r0 + 2 * pY }, (_, r) => {
        const linha = new Array(c0 + 2 * pX).fill(0);
        const ri = r - pY;
        if (ri >= 0 && ri < r0) for (let c = 0; c < c0; c++) linha[c + pX] = hmImagem[ri][c];
        return linha;
      })
    : hmImagem;
  const largura = largImg + 2 * pX * cellX;
  const altura  = altImg  + 2 * pY * cellY;

  const rows = heightmap.length;
  const cols = heightmap[0].length;
  const scaleX = largura / Math.max(1, cols - 1);
  const scaleY = altura  / Math.max(1, rows - 1);
  // Invert: dark pixel = thick (high z), light pixel = thin (low z)
  const h = (r, c) => espMin + (1 - heightmap[r][c]) * (espMax - espMin);
  return _buildHeightmapStl({ rows, cols, scaleX, scaleY, h, largura, altura });
}

// ─────────────────────────────────────────────────────────────────────────────
// Litofânia Curva — projeção cilíndrica
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {number[][]} opts.heightmap
 * @param {number}     opts.alturaMm   - altura do cilindro em mm
 * @param {number}     opts.raio       - raio exterior em mm
 * @param {number}     opts.angulo     - ângulo total em graus (ex: 270 para candeeiro)
 * @param {number}     opts.espMax     - espessura máxima da parede (zonas escuras)
 * @param {number}     opts.espMin     - espessura mínima da parede (zonas claras)
 */
export function generateLithophaneCurvedStl({ heightmap, alturaMm, raio, angulo, espMax, espMin }) {
  const rows = heightmap.length;
  const cols = heightmap[0].length;
  const completo = angulo >= 360;
  const angleRad = (Math.min(angulo, 360) * Math.PI) / 180;
  // Nº de faixas na horizontal: num cilindro completo a última coluna liga à primeira
  const C = completo ? cols : cols - 1;
  const passo = angleRad / C;
  const stl = new EscritorStl(4 * (rows - 1) * C + 4 * C + (completo ? 0 : 4 * (rows - 1)));
  const triangles = { push: (...ts) => { for (const t of ts) stl.tri(t[0], t[1], t[2]); } };

  // Coordenadas 3D para um ponto (col, row) na superfície interior/exterior
  const outerPt = (col, row) => {
    const theta = col * passo;
    const z     = (row / (rows - 1)) * alturaMm;
    return [raio * Math.sin(theta), raio * Math.cos(theta), z];
  };
  const innerPt = (col, row) => {
    const theta   = col * passo;
    const z       = (row / (rows - 1)) * alturaMm;
    // topo da imagem em cima e leitura da esquerda para a direita vista de fora
    const px = heightmap[rows - 1 - row][(cols - 1) - (col % cols)];
    // escuro (px 0) → parede grossa (espMax); claro (px 1) → fina (espMin)
    const r_inner = raio - espMin - (1 - px) * (espMax - espMin);
    return [r_inner * Math.sin(theta), r_inner * Math.cos(theta), z];
  };

  // ── Superfície exterior (lisa) ────────────────────────────────────────────
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < C; c++) {
      const o00=outerPt(c,r), o10=outerPt(c+1,r), o01=outerPt(c,r+1), o11=outerPt(c+1,r+1);
      triangles.push([o00,o11,o10], [o00,o01,o11]);
    }
  }

  // ── Superfície interior (heightmap invertido) ─────────────────────────────
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < C; c++) {
      const i00=innerPt(c,r), i10=innerPt(c+1,r), i01=innerPt(c,r+1), i11=innerPt(c+1,r+1);
      triangles.push([i00,i10,i11], [i00,i11,i01]);
    }
  }

  // ── Tampa inferior (z=0, normal para baixo) ──────────────────────────────
  for (let c = 0; c < C; c++) {
    triangles.push([outerPt(c,0), outerPt(c+1,0), innerPt(c+1,0)]);
    triangles.push([outerPt(c,0), innerPt(c+1,0), innerPt(c,0)]);
  }

  // ── Tampa superior (z=alturaMm, normal para cima) ─────────────────────────
  for (let c = 0; c < C; c++) {
    const r = rows - 1;
    triangles.push([outerPt(c,r), innerPt(c+1,r), outerPt(c+1,r)]);
    triangles.push([outerPt(c,r), innerPt(c,r),   innerPt(c+1,r)]);
  }

  // ── Laterais (θ=0 e θ=angulo) se não for cilindro completo ───────────────
  if (!completo) {
    for (let r = 0; r < rows - 1; r++) {
      triangles.push([outerPt(0,r), innerPt(0,r+1), outerPt(0,r+1)]);
      triangles.push([outerPt(0,r), innerPt(0,r),   innerPt(0,r+1)]);
      triangles.push([outerPt(C,r+1), innerPt(C,r),   outerPt(C,r)]);
      triangles.push([outerPt(C,r+1), innerPt(C,r+1), innerPt(C,r)]);
    }
  }

  return stl.fim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Litofânia Esfera — bola de Natal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Esfera oca com a imagem numa faixa à volta do equador (ver esferaGeometria
 * em image-proc.js). Em baixo um corte plano com furo para a vela LED (assenta
 * na base da impressora) ou, com tampa, uma gola com baioneta de ¼ de volta e a
 * tampa com a vela ao lado, no mesmo STL (app/tampaBola.js); em cima um topo
 * maciço e uma argola para pendurar.
 * Imprime de pé e sem suportes: as zonas com grande inclinação (topo e fundo)
 * têm parede grossa; as paredes finas da imagem ficam na zona quase vertical.
 *
 * Vista de fora pela frente (−y) a imagem lê-se direita: longitude λ cresce
 * para a direita (+x), linha 0 do heightmap = topo da faixa.
 */
export function generateLithophaneSphereStl({ heightmap, geo, espMax, espMin }) {
  const { R, phiCut, phi1, phi2, A, tampa, hc = 0 } = geo;
  const rows = heightmap.length, cols = heightmap[0].length;
  const completo = A >= 2 * Math.PI - 1e-6;
  const capT = Math.max(espMax, 3);
  const deg = Math.PI / 180;

  // Grelha: longitude com o passo da imagem; latitude do corte até junto ao polo
  const dPhiImg = (phi2 - phi1) / Math.max(1, rows - 1);
  // com tampa a gola precisa de ranhuras vivas → longitudes fixas (720, meio grau)
  const NL = tampa ? 720 : Math.min(900, Math.max(48, completo ? cols : Math.round(cols * 2 * Math.PI / A)));
  const nLat = Math.max(8, Math.ceil((Math.PI / 2 - phiCut) / dPhiImg));
  const phis = Array.from({ length: nLat }, (_, i) => phiCut + i * (Math.PI / 2 - phiCut) / nLat);
  const lams = Array.from({ length: NL }, (_, j) => -Math.PI + j * 2 * Math.PI / NL);

  const amostra = (lam, phi) => {
    // posição contínua na imagem
    let u;
    if (completo) {
      u = ((lam + Math.PI) / (2 * Math.PI)) * cols;
    } else {
      if (Math.abs(lam) > A / 2) return null;
      u = ((lam + A / 2) / A) * (cols - 1);
    }
    const v = ((phi2 - phi) / (phi2 - phi1)) * (rows - 1);
    const r0 = Math.max(0, Math.min(rows - 1, Math.floor(v))), r1 = Math.min(rows - 1, r0 + 1);
    const fv = Math.max(0, Math.min(1, v - r0));
    let c0 = Math.floor(u), fu = u - c0, c1 = c0 + 1;
    if (completo) { c0 = ((c0 % cols) + cols) % cols; c1 = c1 % cols; }
    else { c0 = Math.max(0, Math.min(cols - 1, c0)); c1 = Math.min(cols - 1, c1); }
    const a = heightmap[r0][c0] * (1 - fu) + heightmap[r0][c1] * fu;
    const b = heightmap[r1][c0] * (1 - fu) + heightmap[r1][c1] * fu;
    return a * (1 - fv) + b * fv;
  };
  const esp = (lam, phi) => {
    if (phi > phi2) {
      const s = Math.min(1, (phi - phi2) / (15 * deg));
      return espMax + (capT - espMax) * s;
    }
    if (phi < phi1) return espMax;
    const f = amostra(lam, phi);
    return f === null ? espMax : espMin + (1 - f) * (espMax - espMin);
  };

  const zCut = R * Math.sin(phiCut);
  const dz = hc - zCut;                      // corte em z = 0 (ou em cima da gola, z = hc)
  const P = (rad, lam, phi) => [rad * Math.cos(phi) * Math.sin(lam), -rad * Math.cos(phi) * Math.cos(lam), rad * Math.sin(phi) + dz];

  const outer = phis.map(phi => lams.map(lam => P(R, lam, phi)));
  const inner = phis.map((phi, i) => lams.map(lam => {
    const t = esp(lam, phi);
    if (i === 0) {   // anel de baixo plano (mesmo z do exterior); com tampa liga ao topo da gola
      const rr = tampa ? tampa.ra : R * Math.cos(phiCut) - t;
      return [rr * Math.sin(lam), -rr * Math.cos(lam), hc];
    }
    return P(R - t, lam, phi);
  }));
  const poloExt = [0, 0, R + dz];
  const poloInt = [0, 0, R - capT + dz];

  // Argola (toro vertical, furo de frente para trás), meio enterrada no topo
  const tMaj = 4.5, tMin = 1.6, U = 40, V = 16;
  const cz = R - 1.6 + tMaj + tMin + dz;
  const toro = (u, v) => {
    const cu = Math.cos(u), su = Math.sin(u);
    const rr = tMaj + tMin * Math.cos(v);
    return [rr * cu, tMin * Math.sin(v), cz + rr * su];
  };

  // gola + tampa (ao lado da bola, aba para baixo): calculadas primeiro para saber quantos triângulos são
  const extra = [];
  if (tampa) {
    const emit = (a, b, c) => extra.push(a, b, c);
    golaTriangulos(tampa, lams, (j) => outer[0][j], emit);
    tampaTriangulos(tampa, emit, { x0: R + tampa.rf + 8 });
  }
  const nTri = 2 * (2 * (nLat - 1) * NL + NL) + (tampa ? 0 : 2 * NL) + 2 * U * V + extra.length / 3;
  const stl = new EscritorStl(nTri);

  for (let i = 0; i < nLat - 1; i++) {
    for (let j = 0; j < NL; j++) {
      const k = (j + 1) % NL;
      const a = outer[i][j], b = outer[i][k], c = outer[i + 1][k], d = outer[i + 1][j];
      stl.tri(a, b, c); stl.tri(a, c, d);                          // exterior (normal para fora)
      const ai = inner[i][j], bi = inner[i][k], ci = inner[i + 1][k], di = inner[i + 1][j];
      stl.tri(ai, ci, bi); stl.tri(ai, di, ci);                    // interior (normal para dentro)
    }
  }
  const L = nLat - 1;
  for (let j = 0; j < NL; j++) {
    const k = (j + 1) % NL;
    stl.tri(outer[L][j], outer[L][k], poloExt);                    // tampa exterior
    stl.tri(inner[L][j], poloInt, inner[L][k]);                    // tecto interior
    if (!tampa) {   // anel de baixo (normal −z); com tampa é a gola que fecha
      stl.tri(outer[0][j], inner[0][j], inner[0][k]);
      stl.tri(outer[0][j], inner[0][k], outer[0][k]);
    }
  }
  for (let i = 0; i < extra.length; i += 3) stl.tri(extra[i], extra[i + 1], extra[i + 2]);
  for (let a = 0; a < U; a++) {
    for (let b = 0; b < V; b++) {
      const u0 = (a / U) * 2 * Math.PI, u1 = ((a + 1) / U) * 2 * Math.PI;
      const v0 = (b / V) * 2 * Math.PI, v1 = ((b + 1) / V) * 2 * Math.PI;
      const p00 = toro(u0, v0), p10 = toro(u1, v0), p11 = toro(u1, v1), p01 = toro(u0, v1);
      stl.tri(p00, p11, p10); stl.tri(p00, p01, p11);
    }
  }
  return stl.fim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

function _buildHeightmapStl({ rows, cols, scaleX, scaleY, h, largura, altura }) {
  const R = rows - 1, C = cols - 1;
  // topo 2RC + paredes 4R+4C + base em leque (um triângulo por aresta do perímetro: 2R+2C)
  const stl = new EscritorStl(2 * R * C + 6 * (R + C));

  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const x0=c*scaleX, y0=r*scaleY, x1=(c+1)*scaleX, y1=(r+1)*scaleY;
      const p00=[x0,y0,h(r,c)], p10=[x1,y0,h(r,c+1)], p01=[x0,y1,h(r+1,c)], p11=[x1,y1,h(r+1,c+1)];
      stl.tri(p00,p10,p11); stl.tri(p00,p11,p01);
    }
  }

  // Base plana: leque a partir do centro até aos vértices do perímetro (os mesmos
  // das paredes → malha fechada). Antes era a grelha inteira, o que duplicava o
  // tamanho do STL e a memória sem acrescentar nada.
  const perim = [];
  for (let c = 0; c < C; c++) perim.push([c*scaleX, 0, 0]);
  for (let r = 0; r < R; r++) perim.push([largura, r*scaleY, 0]);
  for (let c = C; c > 0; c--) perim.push([c*scaleX, altura, 0]);
  for (let r = R; r > 0; r--) perim.push([0, r*scaleY, 0]);
  const centro = [largura / 2, altura / 2, 0];
  for (let i = 0; i < perim.length; i++) stl.tri(centro, perim[(i + 1) % perim.length], perim[i]);   // normal −z

  // Paredes (normais para fora: −y, +y, −x, +x)
  for (let c=0;c<C;c++) {
    const x0=c*scaleX, x1=(c+1)*scaleX;
    stl.tri([x0,0,0],[x1,0,h(0,c+1)],[x0,0,h(0,c)]); stl.tri([x0,0,0],[x1,0,0],[x1,0,h(0,c+1)]);
    stl.tri([x0,altura,h(R,c)],[x1,altura,0],[x0,altura,0]); stl.tri([x0,altura,h(R,c)],[x1,altura,h(R,c+1)],[x1,altura,0]);
  }
  for (let r=0;r<R;r++) {
    const y0=r*scaleY, y1=(r+1)*scaleY;
    stl.tri([0,y0,h(r,0)],[0,y1,0],[0,y0,0]); stl.tri([0,y0,h(r,0)],[0,y1,h(r+1,0)],[0,y1,0]);
    stl.tri([largura,y0,0],[largura,y1,h(r+1,C)],[largura,y0,h(r,C)]); stl.tri([largura,y0,0],[largura,y1,0],[largura,y1,h(r+1,C)]);
  }

  return stl.fim();
}

/**
 * Escreve triângulos diretamente num STL binário pré-alocado (50 bytes cada),
 * sem guardar a lista de triângulos em memória — uma litofânia de 600×600 px
 * passava dos 400 MB com arrays de arrays e rebentava o servidor.
 */
class EscritorStl {
  constructor(max) {
    this.buf = Buffer.alloc(84 + 50 * max);
    this.n = 0; this.o = 84; this.max = max;
  }
  tri(a, b, c) {
    if (this.n >= this.max) throw new Error('EscritorStl: capacidade excedida');
    const ux=b[0]-a[0], uy=b[1]-a[1], uz=b[2]-a[2], vx=c[0]-a[0], vy=c[1]-a[1], vz=c[2]-a[2];
    let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx/=l; ny/=l; nz/=l;
    const B = this.buf; let o = this.o;
    B.writeFloatLE(nx,o); B.writeFloatLE(ny,o+4); B.writeFloatLE(nz,o+8);
    B.writeFloatLE(a[0],o+12); B.writeFloatLE(a[1],o+16); B.writeFloatLE(a[2],o+20);
    B.writeFloatLE(b[0],o+24); B.writeFloatLE(b[1],o+28); B.writeFloatLE(b[2],o+32);
    B.writeFloatLE(c[0],o+36); B.writeFloatLE(c[1],o+40); B.writeFloatLE(c[2],o+44);
    this.o = o + 50; this.n++;
  }
  fim() {
    this.buf.writeUInt32LE(this.n, 80);
    return this.n === this.max ? this.buf : this.buf.subarray(0, 84 + 50 * this.n);
  }
}

function normal([a, b, c]) {
  const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];
  const v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
  return [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
}

function buildBinaryStl(triangles) {
  const header = Buffer.alloc(80, 0);
  const count  = Buffer.alloc(4);
  count.writeUInt32LE(triangles.length, 0);
  const body   = Buffer.alloc(triangles.length * 50);
  let offset   = 0;
  for (const tri of triangles) {
    const n = normal(tri);
    for (const f of [...n, ...tri[0], ...tri[1], ...tri[2]]) { body.writeFloatLE(f, offset); offset += 4; }
    body.writeUInt16LE(0, offset); offset += 2;
  }
  return Buffer.concat([header, count, body]);
}
