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
  const scaleX = largura / cols;
  const scaleY = altura  / rows;
  const h = (r, c) => espBase + heightmap[r][c] * altRelevo;
  return _buildHeightmapStl({ rows, cols, scaleX, scaleY, h, largura, altura });
}

/**
 * Gera STL de marcador com furo cilíndrico no topo.
 */
export function generateBookmarkStl({ heightmap, largura, altura, espBase, altRelevo, holeDiameter, holeMarginTop }) {
  const rows = heightmap.length;
  const cols = heightmap[0].length;
  const scaleX = largura / cols;
  const scaleY = altura  / rows;

  const holeR  = (holeDiameter ?? 4) / 2;
  const holeCx = largura / 2;
  const holeCy = altura - (holeMarginTop ?? 6);

  const inHole = (x, y) => (x - holeCx) ** 2 + (y - holeCy) ** 2 <= holeR ** 2;
  const quadInHole = (c, r) => inHole((c + 0.5) * scaleX, (r + 0.5) * scaleY);

  const h = (r, c) => espBase + heightmap[rows - 1 - r][c] * altRelevo;
  const espTotal = espBase + altRelevo;

  const triangles = [];

  // ── Superfície superior (sem área do furo) ───────────────────────────────
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      if (quadInHole(c, r)) continue;
      const x0 = c * scaleX, y0 = r * scaleY;
      const x1 = (c+1)*scaleX, y1 = (r+1)*scaleY;
      const p00=[x0,y0,h(r,c)], p10=[x1,y0,h(r,c+1)];
      const p01=[x0,y1,h(r+1,c)], p11=[x1,y1,h(r+1,c+1)];
      triangles.push([p00,p10,p11], [p00,p11,p01]);
    }
  }

  // ── Base inferior (sem área do furo) ─────────────────────────────────────
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      if (quadInHole(c, r)) continue;
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

  // ── Parede cilíndrica do furo ─────────────────────────────────────────────
  const SEGS = 32;
  for (let i = 0; i < SEGS; i++) {
    const a0 = (i / SEGS) * 2 * Math.PI;
    const a1 = ((i+1) / SEGS) * 2 * Math.PI;
    const x0 = holeCx + holeR * Math.cos(a0), y0c = holeCy + holeR * Math.sin(a0);
    const x1 = holeCx + holeR * Math.cos(a1), y1c = holeCy + holeR * Math.sin(a1);
    // Parede interior do furo (normal para o interior)
    triangles.push([[x0,y0c,0],[x0,y0c,espTotal],[x1,y1c,espTotal]]);
    triangles.push([[x0,y0c,0],[x1,y1c,espTotal],[x1,y1c,0]]);
    // Topo do furo (normal para cima)
    triangles.push([[holeCx,holeCy,espTotal],[x0,y0c,espTotal],[x1,y1c,espTotal]]);
    // Fundo do furo (normal para baixo)
    triangles.push([[holeCx,holeCy,0],[x1,y1c,0],[x0,y0c,0]]);
  }

  return buildBinaryStl(triangles);
}

// ─────────────────────────────────────────────────────────────────────────────
// Litofânia Plana — heightmap subtrativo (escuro=espesso, claro=fino)
// ─────────────────────────────────────────────────────────────────────────────

export function generateLithophaneFlatStl({ heightmap, largura, altura, espMax, espMin }) {
  const rows = heightmap.length;
  const cols = heightmap[0].length;
  const scaleX = largura / cols;
  const scaleY = altura  / rows;
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

  // Base
  triangles.push([[0,0,0],[largura,altura,0],[largura,0,0]], [[0,0,0],[0,altura,0],[largura,altura,0]]);

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
