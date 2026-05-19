/**
 * Gerador de STL binário para HueForge a partir de imagem de heightmap.
 * Não usa OpenSCAD — gera o mesh diretamente em JavaScript.
 *
 * Geometria:
 *  - Superfície superior: heightmap (cada pixel → altura proporcional ao cinzento)
 *  - Base inferior: plana em z=0
 *  - Paredes laterais: ligam a superfície à base
 */

/**
 * @param {object} opts
 * @param {number[][]} opts.heightmap  - matriz [rows][cols] com valores 0..1
 * @param {number}     opts.largura    - largura final em mm
 * @param {number}     opts.altura     - altura final em mm
 * @param {number}     opts.espBase    - espessura da base em mm
 * @param {number}     opts.altRelevo  - altura máxima do relevo em mm
 * @returns {Buffer}  buffer STL binário
 */
export function generateHueforgeStl({ heightmap, largura, altura, espBase, altRelevo }) {
  const rows = heightmap.length;
  const cols = heightmap[0].length;

  const scaleX = largura / cols;
  const scaleY = altura  / rows;

  // Altura de cada ponto: base + relevo
  const h = (r, c) => espBase + heightmap[r][c] * altRelevo;

  const triangles = [];

  // ── Superfície superior (heightmap) ─────────────────────────────────────
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const x0 = c * scaleX,       y0 = r * scaleY;
      const x1 = (c + 1) * scaleX, y1 = (r + 1) * scaleY;

      const p00 = [x0, y0, h(r,   c  )];
      const p10 = [x1, y0, h(r,   c+1)];
      const p01 = [x0, y1, h(r+1, c  )];
      const p11 = [x1, y1, h(r+1, c+1)];

      // Quad → 2 triângulos (sentido anti-horário visto de cima)
      triangles.push([p00, p10, p11]);
      triangles.push([p00, p11, p01]);
    }
  }

  // ── Base inferior (plana em z=0) ─────────────────────────────────────────
  const bx0 = 0, by0 = 0;
  const bx1 = largura, by1 = altura;
  // Sentido horário visto de cima (normal para baixo)
  triangles.push([[bx0,by0,0],[bx1,by1,0],[bx1,by0,0]]);
  triangles.push([[bx0,by0,0],[bx0,by1,0],[bx1,by1,0]]);

  // ── Parede frontal (r=0) ─────────────────────────────────────────────────
  for (let c = 0; c < cols - 1; c++) {
    const x0 = c * scaleX, x1 = (c + 1) * scaleX;
    const z0 = h(0, c), z1 = h(0, c + 1);
    triangles.push([[x0,0,0],[x0,0,z0],[x1,0,z1]]);
    triangles.push([[x0,0,0],[x1,0,z1],[x1,0,0 ]]);
  }

  // ── Parede traseira (r=rows-1) ───────────────────────────────────────────
  for (let c = 0; c < cols - 1; c++) {
    const x0 = c * scaleX, x1 = (c + 1) * scaleX;
    const z0 = h(rows-1, c), z1 = h(rows-1, c + 1);
    triangles.push([[x0,by1,z0],[x0,by1,0  ],[x1,by1,0  ]]);
    triangles.push([[x0,by1,z0],[x1,by1,0  ],[x1,by1,z1 ]]);
  }

  // ── Parede esquerda (c=0) ────────────────────────────────────────────────
  for (let r = 0; r < rows - 1; r++) {
    const y0 = r * scaleY, y1 = (r + 1) * scaleY;
    const z0 = h(r, 0), z1 = h(r + 1, 0);
    triangles.push([[0,y0,z0],[0,y0,0  ],[0,y1,0  ]]);
    triangles.push([[0,y0,z0],[0,y1,0  ],[0,y1,z1 ]]);
  }

  // ── Parede direita (c=cols-1) ────────────────────────────────────────────
  for (let r = 0; r < rows - 1; r++) {
    const y0 = r * scaleY, y1 = (r + 1) * scaleY;
    const z0 = h(r, cols-1), z1 = h(r + 1, cols-1);
    triangles.push([[bx1,y0,0  ],[bx1,y0,z0],[bx1,y1,z1]]);
    triangles.push([[bx1,y0,0  ],[bx1,y1,z1],[bx1,y1,0 ]]);
  }

  return buildBinaryStl(triangles);
}

/** Calcula a normal de um triângulo (produto vetorial). */
function normal([a, b, c]) {
  const u = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
  const v = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
  return [
    u[1]*v[2] - u[2]*v[1],
    u[2]*v[0] - u[0]*v[2],
    u[0]*v[1] - u[1]*v[0],
  ];
}

/** Serializa a lista de triângulos para STL binário. */
function buildBinaryStl(triangles) {
  const header = Buffer.alloc(80, 0);
  const count  = Buffer.alloc(4);
  count.writeUInt32LE(triangles.length, 0);

  const TRIANGLE_SIZE = 50; // 12 (normal) + 3×12 (vértices) + 2 (attr)
  const body = Buffer.alloc(triangles.length * TRIANGLE_SIZE);
  let offset = 0;

  for (const tri of triangles) {
    const n = normal(tri);
    body.writeFloatLE(n[0], offset);     offset += 4;
    body.writeFloatLE(n[1], offset);     offset += 4;
    body.writeFloatLE(n[2], offset);     offset += 4;
    for (const v of tri) {
      body.writeFloatLE(v[0], offset);   offset += 4;
      body.writeFloatLE(v[1], offset);   offset += 4;
      body.writeFloatLE(v[2], offset);   offset += 4;
    }
    body.writeUInt16LE(0, offset);       offset += 2;
  }

  return Buffer.concat([header, count, body]);
}
