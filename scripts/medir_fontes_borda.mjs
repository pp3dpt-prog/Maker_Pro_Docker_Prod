// Mede as fontes do servidor para templates/marcador_copo_nome_borda.scad (tabela FONTES):
//   [fonte, limiar, esticão, base] em fração do size do OpenSCAD (size * 100/72 = em).
// Uso: node scripts/medir_fontes_borda.mjs
import fs from 'fs';
import opentype from 'opentype.js';

const src = fs.readFileSync(new URL('../lib/textFit.js', import.meta.url), 'utf8');
const F = {};
for (const l of src.match(/const FONT_FILES = \{([\s\S]*?)\};/)[1].split('\n')) {
  const r = l.match(/'([^']+)':\s*'([^']+)'/);
  if (r && r[1] !== 'Baloo2') F[r[1]] = r[2];
}
const k = 100 / 72;
const base = { 'Ã': 'A', 'Á': 'A', 'À': 'A', 'Â': 'A', 'É': 'E', 'Ê': 'E', 'Í': 'I', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ú': 'U', 'Ñ': 'N' };

for (const [nome, ficheiro] of Object.entries(F)) {
  const b = fs.readFileSync(new URL(`../fonts/${ficheiro}`, import.meta.url));
  const font = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const u = font.unitsPerEm;
  const bb = (c) => font.charToGlyph(c).getBoundingBox();
  const topo = (c) => bb(c).y2 / u * k;
  const limiar = Math.max(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(topo)) + 0.01;
  let esticao = 0, topoAcento = 9;
  for (const [c, bc] of Object.entries(base)) {
    const cmds = font.charToGlyph(c).getPath(0, 0, u).commands;
    const contornos = []; let cur = [];
    for (const cm of cmds) {
      if (cm.type === 'M') { if (cur.length) contornos.push(cur); cur = []; }
      if (cm.y !== undefined) cur.push(-cm.y / u * k);
    }
    if (cur.length) contornos.push(cur);
    const bt = topo(bc);
    const acento = contornos.filter((ys) => Math.min(...ys) > bt - 0.005);
    if (!acento.length) continue;
    const fundo = Math.min(...acento.map((ys) => Math.min(...ys)));
    topoAcento = Math.min(topoAcento, Math.max(...acento.map((ys) => Math.max(...ys))));
    esticao = Math.max(esticao, Math.max(fundo, limiar) - bt + 0.06);
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghklmnorstuvwxz0123456789'.split('');
  const baseMax = Math.max(0, ...chars.map((c) => bb(c).y1 / u * k));
  const ok = topoAcento > limiar + 0.04 ? '' : '   // PROBLEMA: acentos abaixo do limiar — não usar';
  console.log(`    ["${nome}", ${+limiar.toFixed(3)}, ${+esticao.toFixed(3)}, ${+baseMax.toFixed(3)}],${ok}`);
}
