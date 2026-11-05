/**
 * Escrita de STL binário e de 3MF multi-peça (para impressoras com AMS).
 *
 * O 3MF tem um objeto "porta-chaves" feito de componentes (uma malha por cor),
 * já montados no sítio. Bambu Studio / OrcaSlicer / PrusaSlicer importam isto
 * como um objeto com várias partes, a que se atribui um filamento cada.
 * Cada malha leva também a cor detetada (basematerials) e, para Bambu/Orca,
 * o filamento sugerido em Metadata/model_settings.config.
 */
import archiver from 'archiver';
import { PassThrough } from 'stream';

export function stlBinario(tri, nome = 'pp3d') {
  const n = tri.length / 9;
  const buf = Buffer.alloc(84 + n * 50);
  buf.write(nome.slice(0, 79), 0, 'ascii');
  buf.writeUInt32LE(n, 80);
  let o = 84;
  for (let i = 0; i < tri.length; i += 9) {
    const ux = tri[i + 3] - tri[i], uy = tri[i + 4] - tri[i + 1], uz = tri[i + 5] - tri[i + 2];
    const vx = tri[i + 6] - tri[i], vy = tri[i + 7] - tri[i + 1], vz = tri[i + 8] - tri[i + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    buf.writeFloatLE(nx / l, o); buf.writeFloatLE(ny / l, o + 4); buf.writeFloatLE(nz / l, o + 8);
    for (let k = 0; k < 9; k++) buf.writeFloatLE(tri[i + k], o + 12 + k * 4);
    buf.writeUInt16LE(0, o + 48);
    o += 50;
  }
  return buf;
}

/**
 * STL (ASCII, como o OpenSCAD 2021 exporta, ou binário) → triângulos soltos
 * [x1,y1,z1, x2,y2,z2, x3,y3,z3, ...], o formato que stlBinario/tresMf recebem.
 */
export function lerStl(buf) {
  const tri = [];
  const inicio = buf.subarray(0, 512).toString('latin1');
  // Um STL binário pode começar por "solid" no cabeçalho: confirmar pelo tamanho.
  const nBin = buf.length >= 84 ? buf.readUInt32LE(80) : -1;
  const ehBinario = !/^\s*solid/.test(inicio) || (nBin >= 0 && 84 + nBin * 50 === buf.length && !inicio.includes('facet'));
  if (ehBinario) {
    for (let i = 0, o = 84; i < nBin; i++, o += 50) {
      for (let k = 0; k < 9; k++) tri.push(buf.readFloatLE(o + 12 + k * 4));
    }
    return tri;
  }
  const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g;
  const txt = buf.toString('latin1');
  let m;
  while ((m = re.exec(txt))) tri.push(+m[1], +m[2], +m[3]);
  return tri;
}

/** Triângulos soltos → vértices únicos + índices (3MF exige malha indexada). */
function indexar(tri) {
  const mapa = new Map();
  const vertices = [];
  const indices = [];
  for (let i = 0; i < tri.length; i += 3) {
    const x = +tri[i].toFixed(4), y = +tri[i + 1].toFixed(4), z = +tri[i + 2].toFixed(4);
    const k = `${x},${y},${z}`;
    let id = mapa.get(k);
    if (id === undefined) { id = vertices.length / 3; vertices.push(x, y, z); mapa.set(k, id); }
    indices.push(id);
  }
  return { vertices, indices };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/**
 * @param {{nome:string, cor:string, tri:number[]}[]} partes
 * @returns {Promise<Buffer>}
 */
export async function tresMf(partes, nomeObjeto = 'porta-chaves') {
  const malhas = [];
  partes.forEach((p, i) => {
    const { vertices, indices } = indexar(p.tri);
    let v = '', t = '';
    for (let k = 0; k < vertices.length; k += 3) v += `<vertex x="${vertices[k]}" y="${vertices[k + 1]}" z="${vertices[k + 2]}"/>`;
    for (let k = 0; k < indices.length; k += 3) {
      const a = indices[k], b = indices[k + 1], c = indices[k + 2];
      if (a === b || b === c || a === c) continue; // triângulo degenerado após arredondar
      t += `<triangle v1="${a}" v2="${b}" v3="${c}"/>`;
    }
    malhas.push(`<object id="${i + 2}" name="${esc(p.nome)}" type="model" pid="1" pindex="${i}"><mesh><vertices>${v}</vertices><triangles>${t}</triangles></mesh></object>`);
  });
  const idObjeto = partes.length + 2;
  const componentes = partes.map((_, i) => `<component objectid="${i + 2}"/>`).join('');
  const materiais = partes.map(p => `<base name="${esc(p.nome)}" displaycolor="${p.cor.toUpperCase()}FF"/>`).join('');

  const modelo = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="pt-PT" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${esc(nomeObjeto)}</metadata>
<metadata name="Application">pp3d.pt</metadata>
<resources>
<basematerials id="1">${materiais}</basematerials>
${malhas.join('\n')}
<object id="${idObjeto}" name="${esc(nomeObjeto)}" type="model"><components>${componentes}</components></object>
</resources>
<build><item objectid="${idObjeto}" transform="1 0 0 0 1 0 0 0 1 128 128 0"/></build>
</model>`;

  // Bambu Studio / OrcaSlicer: nome e filamento sugerido de cada parte (1 = base, 2.. = cores).
  const config = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="${idObjeto}">
    <metadata key="name" value="${esc(nomeObjeto)}"/>
    <metadata key="extruder" value="1"/>
${partes.map((p, i) => `    <part id="${i + 2}" subtype="normal_part">
      <metadata key="name" value="${esc(p.nome)}"/>
      <metadata key="extruder" value="${Math.min(i + 1, 16)}"/>
    </part>`).join('\n')}
  </object>
</config>`;

  const tipos = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
<Default Extension="config" ContentType="text/xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

  const arc = archiver('zip', { zlib: { level: 9 } });
  const saida = new PassThrough();
  const pedacos = [];
  saida.on('data', (d) => pedacos.push(d));
  const fim = new Promise((res, rej) => { saida.on('end', res); arc.on('error', rej); });
  arc.pipe(saida);
  arc.append(tipos, { name: '[Content_Types].xml' });
  arc.append(rels, { name: '_rels/.rels' });
  arc.append(modelo, { name: '3D/3dmodel.model' });
  arc.append(config, { name: 'Metadata/model_settings.config' });
  await arc.finalize();
  await fim;
  return Buffer.concat(pedacos);
}
