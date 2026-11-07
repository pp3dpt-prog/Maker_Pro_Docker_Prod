/**
 * Iluminárias — parte só do backend: STL binário, base (OpenSCAD) e guia TXT.
 * A geometria está em iluminariasGeom.js (partilhada com o frontend).
 */
import { iluminaria, LIP_H, LIP_T, FOLGA } from './iluminariasGeom.js';

export const GERADORES_ILUMINARIA = ['iluminaria-torcida', 'iluminaria-perfurada'];

/** Array plano de triângulos → STL binário (normais calculadas). */
export function trisParaStl(tris) {
  const n = tris.length / 9;
  const buf = Buffer.alloc(84 + 50 * n);
  buf.writeUInt32LE(n, 80);
  let o = 84;
  for (let i = 0; i < n; i++) {
    const b = i * 9;
    const ux = tris[b + 3] - tris[b], uy = tris[b + 4] - tris[b + 1], uz = tris[b + 5] - tris[b + 2];
    const vx = tris[b + 6] - tris[b], vy = tris[b + 7] - tris[b + 1], vz = tris[b + 8] - tris[b + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    buf.writeFloatLE(nx / l, o); buf.writeFloatLE(ny / l, o + 4); buf.writeFloatLE(nz / l, o + 8);
    for (let k = 0; k < 9; k++) buf.writeFloatLE(tris[b + k], o + 12 + 4 * k);
    o += 50;
  }
  return buf;
}

const f2 = (v) => Number(v).toFixed(3);
const poly = (pts) => `[${pts.map(([x, y]) => `[${f2(x)},${f2(y)}]`).join(',')}]`;

/** OpenSCAD da base: forma da peça, encaixe da luz, cabo e rebordo. */
export function baseScad(r) {
  const { c, baseExt, rebordo } = r;
  const { luz, hb } = c;
  const lip = rebordo.tipo === 'circulo'
    ? `difference() { circle(r = ${f2(rebordo.r - FOLGA)}); circle(r = ${f2(rebordo.r - FOLGA - LIP_T)}); }`
    : `difference() { offset(delta = -${FOLGA}) polygon(${poly(rebordo.pts)}); offset(delta = -${FOLGA + LIP_T}) polygon(${poly(rebordo.pts)}); }`;
  return `// pp3d — Iluminária: base (${c.luzNome})
$fn = 128;
hb = ${hb};
difference() {
  union() {
    linear_extrude(hb) polygon(${poly(baseExt)});
    translate([0, 0, hb]) linear_extrude(${LIP_H}) ${lip}
  }
${luz.pocketD > 0 ? `  translate([0, 0, hb - ${luz.pocketH}]) cylinder(d = ${luz.pocketD}, h = ${luz.pocketH + 1});` : ''}
${luz.holeD > 0 ? `  translate([0, 0, -1]) cylinder(d = ${luz.holeD}, h = hb + 2, $fn = 64);
  translate([-${luz.grooveW / 2}, 0, -1]) cube([${luz.grooveW}, 400, ${luz.grooveH + 1}]);` : ''}
}
`;
}

/** Peça principal + base SCAD + guia, para um gerador e parâmetros. */
export function gerarIluminaria(gerador, params, { final = true } = {}) {
  const r = iluminaria(gerador, params, { resolucao: final ? 1 : 0.4 });
  return { r, stl: trisParaStl(r.tris), scad: baseScad(r), txt: guiaIluminaria(r) };
}

export function guiaIluminaria(r) {
  const { c } = r;
  const fmt = (v) => Number(v).toFixed(1);
  const sep = '='.repeat(49);
  const torcida = c.tipo === 'iluminaria-torcida';
  const L = [sep, `  ILUMINARIA - ${torcida ? 'ABAJUR TORCIDO' : 'CANDEEIRO PERFURADO'}`, sep, ''];
  if (torcida) {
    L.push(`  Formato         : ${c.formato}${c.formato === 'Polígono' ? ` de ${c.lados} lados` : ` (${c.lados})`}, perfil ${c.perfil}`);
    L.push(`  Diametro        : ${fmt(c.D)} mm   Altura: ${fmt(c.H)} mm   Parede: ${fmt(c.t)} mm`);
    L.push(`  Torcao          : ${fmt(c.torcao)} graus (maximo sem suportes: ${fmt(c.torcaoMax)})`);
  } else {
    L.push(`  Formato         : ${c.formato} (${c.N} faces)   Padrao: ${c.padrao}`);
    L.push(`  Diametro        : ${fmt(c.D)} mm   Altura: ${fmt(c.H)} mm   Parede: ${fmt(c.t)} mm`);
    L.push(`  Furos           : ${fmt(c.furo)} mm, ${r.furos.length} por face`);
  }
  if (c.diametroPedido && Math.abs(c.diametroPedido - c.D) > 0.01) {
    L.push(`  NOTA: diametro aumentado de ${fmt(c.diametroPedido)} para ${fmt(c.D)} mm para a luz caber.`);
  }
  L.push(`  Luz             : ${c.luzNome}`, '', sep, '', '  PECAS:');
  if (torcida) {
    L.push('  1) iluminaria.stl - abajur. PLA BRANCO ou "natural" (translucido)');
    L.push('     para a luz passar pela parede. De pe, como sai do ficheiro,');
    L.push('     SEM suportes. 2-3 paredes (perimetros), sem enchimento extra.');
    L.push('     Dica: no modo "vase" (spiral) NAO funciona - o fundo e aberto.');
  } else {
    L.push('  1) iluminaria.stl - candeeiro. Cor a gosto: escura projeta o');
    L.push('     padrao na parede; branca brilha toda. De pe, SEM suportes');
    L.push('     (os furos tem o topo inclinado a 45 graus ou mais).');
    L.push('     Paredes: perimetros suficientes para encher a espessura.');
  }
  L.push('  2) base.stl - encaixe da luz. Imprime como sai, sem suportes.');
  L.push('', sep, '', '  MONTAGEM:');
  if (c.luzNome.startsWith('LED Kit')) {
    L.push('  * Disco LED (Bambu Lab LED Lamp Kit-001 ou compativel, 59 mm):');
    L.push('    cabo pelo furo do centro e pelo canal por baixo da base; cola o');
    L.push('    disco no encaixe com a fita do kit, luz para cima.');
  } else if (c.luzNome.startsWith('Casquilho')) {
    L.push('  * Casquilho E14 com tubo M10: aperta ao furo do centro com a porca');
    L.push('    por baixo; cabo pelo canal. Usa SEMPRE lampada LED.');
  } else {
    L.push('  * Vela LED (tea light, ~38 mm) no encaixe do centro.');
  }
  L.push('  * Encaixa a peca no rebordo da base.', '', sep);
  return L.join('\r\n');
}
