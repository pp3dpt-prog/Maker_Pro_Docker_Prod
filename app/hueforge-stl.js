/**
 * Gerador de STL binário para produtos baseados em imagem.
 * Suporta: HueForge, Marcadores, Litofânia Plana e Litofânia Curva.
 */

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
  const h = (r, c) => espBase + heightmap[r][c] * altRelevo;
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

  const holeR  = (holeDiameter ?? 4) / 2;
  const holeCx = largura / 2;
  const holeCy = altura - (holeMarginTop ?? 6);

  const h = (r, c) => espBase + heightmap[rows - 1 - r][c] * altRelevo;

  // Limpa uma zona de quads à volta do furo; o furo redondo (cilindro) é depois
  // cosido a essa abertura por um "colar" de triângulos → furo redondo e malha
  // fechada, independente da resolução da grelha.
  const cellDiag = Math.hypot(scaleX, scaleY);
  const clearR   = holeR + cellDiag;
  const cleared  = (c, r) => {
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

  // ── Paredes laterais ─────────────────────────────────────────────────────
  for (let c = 0; c < cols-1; c++) {
    const x0=c*scaleX, x1=(c+1)*scaleX;
    triangles.push([[x0,0,0],[x0,0,h(0,c)],[x1,0,h(0,c+1)]], [[x0,0,0],[x1,0,h(0,c+1)],[x1,0,0]]);
    triangles.push([[x0,altura,h(rows-1,c)],[x0,altura,0],[x1,altura,0]], [[x0,altura,h(rows-1,c)],[x1,altura,0],[x1,altura,h(rows-1,c+1)]]);
  }
  for (let r = 0; r < rows-1; r++) {
    const y0=r*scaleY, y1=(r+1)*scaleY;
    triangles.push([[0,y0,h(r,0)],[0,y0,0],[0,y1,0]], [[0,y0,h(r,0)],[0,y1,0],[0,y1,h(r+1,0)]]);
    triangles.push([[largura,y0,0],[largura,y0,h(r,cols-1)],[largura,y1,h(r+1,cols-1)]], [[largura,y0,0],[largura,y1,h(r+1,cols-1)],[largura,y1,0]]);
  }

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
        tri = [inner[j % k].p, inner[(j + 1) % k].p, outer[i % m].p];
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
    triangles.push([t0, b0, b1], [t0, b1, t1]);
  }

  return buildBinaryStl(triangles);
}

// ─────────────────────────────────────────────────────────────────────────────
// Litofânia Plana — heightmap subtrativo (escuro=espesso, claro=fino)
// ─────────────────────────────────────────────────────────────────────────────

export function generateLithophaneFlatStl({ heightmap, largura, altura, espMax, espMin }) {
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
  const angleRad = (angulo * Math.PI) / 180;
  const triangles = [];

  // Coordenadas 3D para um ponto (col, row) na superfície interior/exterior
  const outerPt = (col, row) => {
    const theta = (col / cols) * angleRad;
    const z     = (row / rows) * alturaMm;
    return [raio * Math.sin(theta), raio * Math.cos(theta), z];
  };
  const innerPt = (col, row) => {
    const theta   = (col / cols) * angleRad;
    const z       = (row / rows) * alturaMm;
    const r_inner = raio - espMax + (1 - heightmap[row][col]) * (espMax - espMin);
    return [r_inner * Math.sin(theta), r_inner * Math.cos(theta), z];
  };

  // ── Superfície exterior (lisa) ────────────────────────────────────────────
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const o00=outerPt(c,r), o10=outerPt(c+1,r), o01=outerPt(c,r+1), o11=outerPt(c+1,r+1);
      triangles.push([o00,o11,o10], [o00,o01,o11]);
    }
  }

  // ── Superfície interior (heightmap invertido) ─────────────────────────────
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i00=innerPt(c,r), i10=innerPt(c+1,r), i01=innerPt(c,r+1), i11=innerPt(c+1,r+1);
      triangles.push([i00,i10,i11], [i00,i11,i01]);
    }
  }

  // ── Tampa inferior (z=0) ─────────────────────────────────────────────────
  for (let c = 0; c < cols - 1; c++) {
    triangles.push([outerPt(c,0), innerPt(c+1,0), outerPt(c+1,0)]);
    triangles.push([outerPt(c,0), innerPt(c,0),   innerPt(c+1,0)]);
  }

  // ── Tampa superior (z=alturaMm) ───────────────────────────────────────────
  for (let c = 0; c < cols - 1; c++) {
    const r = rows - 1;
    triangles.push([outerPt(c,r), outerPt(c+1,r), innerPt(c+1,r)]);
    triangles.push([outerPt(c,r), innerPt(c+1,r), innerPt(c,r)]);
  }

  // ── Laterais (θ=0 e θ=angulo) se não for cilindro completo ───────────────
  if (angulo < 360) {
    for (let r = 0; r < rows - 1; r++) {
      triangles.push([outerPt(0,r), outerPt(0,r+1), innerPt(0,r+1)]);
      triangles.push([outerPt(0,r), innerPt(0,r+1), innerPt(0,r)]);
      triangles.push([outerPt(cols-1,r+1), outerPt(cols-1,r), innerPt(cols-1,r)]);
      triangles.push([outerPt(cols-1,r+1), innerPt(cols-1,r), innerPt(cols-1,r+1)]);
    }
  }

  return buildBinaryStl(triangles);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

function _buildHeightmapStl({ rows, cols, scaleX, scaleY, h, largura, altura }) {
  const triangles = [];

  for (let r = 0; r < rows-1; r++) {
    for (let c = 0; c < cols-1; c++) {
      const x0=c*scaleX, y0=r*scaleY, x1=(c+1)*scaleX, y1=(r+1)*scaleY;
      const p00=[x0,y0,h(r,c)], p10=[x1,y0,h(r,c+1)], p01=[x0,y1,h(r+1,c)], p11=[x1,y1,h(r+1,c+1)];
      triangles.push([p00,p10,p11], [p00,p11,p01]);
    }
  }

  // Base — subdividida na mesma grelha das paredes (senão as arestas não
  // encaixam e a malha fica aberta no perímetro).
  for (let r = 0; r < rows-1; r++) {
    for (let c = 0; c < cols-1; c++) {
      const x0=c*scaleX, y0=r*scaleY, x1=(c+1)*scaleX, y1=(r+1)*scaleY;
      triangles.push([[x0,y0,0],[x1,y1,0],[x1,y0,0]], [[x0,y0,0],[x0,y1,0],[x1,y1,0]]);
    }
  }

  // Paredes
  for (let c=0;c<cols-1;c++) {
    const x0=c*scaleX, x1=(c+1)*scaleX;
    triangles.push([[x0,0,0],[x0,0,h(0,c)],[x1,0,h(0,c+1)]], [[x0,0,0],[x1,0,h(0,c+1)],[x1,0,0]]);
    triangles.push([[x0,altura,h(rows-1,c)],[x0,altura,0],[x1,altura,0]], [[x0,altura,h(rows-1,c)],[x1,altura,0],[x1,altura,h(rows-1,c+1)]]);
  }
  for (let r=0;r<rows-1;r++) {
    const y0=r*scaleY, y1=(r+1)*scaleY;
    triangles.push([[0,y0,h(r,0)],[0,y0,0],[0,y1,0]], [[0,y0,h(r,0)],[0,y1,0],[0,y1,h(r+1,0)]]);
    triangles.push([[largura,y0,0],[largura,y0,h(r,cols-1)],[largura,y1,h(r+1,cols-1)]], [[largura,y0,0],[largura,y1,h(r+1,cols-1)],[largura,y1,0]]);
  }

  return buildBinaryStl(triangles);
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
