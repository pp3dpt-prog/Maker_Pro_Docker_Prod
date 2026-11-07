/**
 * Litofânia Caixa de Luz — candeeiro de secretária: o painel de litofânia
 * plana (gerado por generateLithophaneFlatStl, igual ao produto "Litofânia
 * Plana") fica de pé, encaixado numa ranhura na base, com luz própria por
 * baixo (em vez de precisar de luz externa, como a versão plana simples).
 *
 * Mesma lógica de luz das outras iluminárias/litofânias (base: app/iluminarias.js,
 * app/litofaniaCubo.js) — disco LED Kit-001 da Bambu, casquilho E14 ou vela LED,
 * encaixe por baixo da peça.
 *
 * Duas peças:
 *  - painel.stl : a litofânia em si (ver hueforge-stl.js). PLA branco/natural.
 *  - base.stl   : bloco com o encaixe da luz + ranhura onde o painel entra.
 *
 * A ranhura agarra o painel pela MOLDURA (espessura constante = esp_max) —
 * por isso a moldura tem de ter pelo menos MOLDURA_MIN_MM (o schema já impõe
 * esse mínimo). A zona da imagem, mais fina, nunca entra na ranhura.
 */

export const CAIXA_LUZ_LUZES = {
  'LED Kit 001 (Bambu)': { pocketD: 60.2, pocketH: 10, holeD: 12,   grooveW: 10, grooveH: 5, floor: 7 },
  'Casquilho E14 (M10)': { pocketD: 0,    pocketH: 0,  holeD: 10.5, grooveW: 8,  grooveH: 5, floor: 8 },
  'Vela LED':            { pocketD: 39.5, pocketH: 8,  holeD: 0,    grooveW: 0,  grooveH: 0, floor: 3 },
};
const LUZ_DEFAULT = 'LED Kit 001 (Bambu)';

export const MOLDURA_MIN_MM = 3;   // a ranhura agarra a moldura — tem de existir
const FOLGA = 0.4;                 // folga do encaixe do painel na ranhura, por lado
const SLOT_H = 12;                 // profundidade (vertical) da ranhura
const PAREDE_SLOT = 4;             // parede à volta da ranhura, cada lado
const PROFUNDIDADE_MIN = 60;       // profundidade mínima da base (estabilidade)

const num = (v, def, min, max) => {
  const n = Number(v);
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : def));
};

export function caixaLuzGeometria(p) {
  const larguraMm = num(p?.largura_mm, 120, 60, 200);
  const alturaMm  = num(p?.altura_mm, 150, 80, 220);
  const molduraMm = Math.max(MOLDURA_MIN_MM, num(p?.moldura_mm, 5, MOLDURA_MIN_MM, 12));
  const espMax = num(p?.esp_max, 3, 2, 5);
  const espMin = Math.min(espMax - 0.3, num(p?.esp_min, 0.6, 0.3, 1.5));
  const luzNome = CAIXA_LUZ_LUZES[p?.luz] ? p.luz : LUZ_DEFAULT;
  const luz = CAIXA_LUZ_LUZES[luzNome];
  const hb = luz.floor + luz.pocketH;             // altura do bloco até à ranhura

  const painelL = larguraMm + 2 * molduraMm;      // largura total do painel (com moldura)
  const painelT = espMax;                          // espessura do painel na moldura (constante)

  const standW = painelL + 2 * (PAREDE_SLOT + FOLGA);
  // A ranhura (painel) e o encaixe da luz ficam À MESMA profundidade (holeY),
  // perto da frente — para a luz apontar direto para trás do painel, não
  // para um ponto vazio mais atrás. O resto da profundidade da base
  // (standD) é só massa/apoio atrás, para o conjunto não tombar para a
  // frente com o peso do painel.
  const slotT = painelT + 2 * FOLGA;
  const holeY = PAREDE_SLOT + FOLGA + Math.max(slotT, luz.pocketD) / 2;
  const standD = Math.max(PROFUNDIDADE_MIN, holeY + luz.pocketD / 2 + 10, painelL * 0.42);
  const standH = hb + SLOT_H;

  return {
    larguraMm, alturaMm, molduraMm, espMax, espMin, luzNome, luz, hb,
    painelL, painelT,
    standW, standD, standH, holeY,
  };
}

const f2 = (v) => Number(v).toFixed(3);

/** OpenSCAD da base: bloco com encaixe da luz por baixo + ranhura para o painel. */
export function caixaLuzBaseScad(geo) {
  const { luz, hb, painelL, painelT, standW, standD, standH, holeY } = geo;
  const slotW = painelL + 2 * FOLGA;
  const slotT = painelT + 2 * FOLGA;
  // Ranhura e encaixe da luz à mesma profundidade (holeY) — a luz fica
  // mesmo por baixo/atrás de onde o painel encosta, não a meio da base.
  return `// pp3d — Litofânia Caixa de Luz: base (${geo.luzNome})
$fn = 128;
module base() {
  difference() {
    cube([${f2(standW)}, ${f2(standD)}, ${f2(standH)}]);
${luz.pocketD > 0 ? `    // encaixe da luz, por cima, atrás da ranhura do painel
    translate([${f2(standW / 2)}, ${f2(holeY)}, ${f2(hb - luz.pocketH)}])
      cylinder(d = ${f2(luz.pocketD)}, h = ${f2(luz.pocketH + 1)});` : ''}
${luz.holeD > 0 ? `    // passagem do cabo até ao fundo
    translate([${f2(standW / 2)}, ${f2(holeY)}, -1])
      cylinder(d = ${f2(luz.holeD)}, h = ${f2(hb + 2)}, $fn = 64);
    // canal do cabo até à face de trás
    translate([${f2(standW / 2 - luz.grooveW / 2)}, ${f2(holeY)}, -1])
      cube([${f2(luz.grooveW)}, ${f2(standD - holeY + 1)}, ${f2(luz.grooveH + 1)}]);` : ''}
    // ranhura onde o painel encaixa (agarra a moldura, espessura constante)
    translate([${f2(standW / 2 - slotW / 2)}, ${f2(holeY - slotT / 2)}, ${f2(hb - 0.5)}])
      cube([${f2(slotW)}, ${f2(slotT)}, ${f2(standH - hb + 1)}]);
  }
}
base();
`;
}

export function guiaCaixaLuz(geo) {
  const fmt = (v) => Number(v).toFixed(1);
  const sep = '='.repeat(49);
  const L = [sep, '  LITOFANIA - CAIXA DE LUZ', sep, ''];
  L.push(`  Painel          : ${fmt(geo.painelL)} x ${fmt(geo.alturaMm + 2 * geo.molduraMm)} mm (imagem ${fmt(geo.larguraMm)} x ${fmt(geo.alturaMm)} mm)`);
  L.push(`  Moldura         : ${fmt(geo.molduraMm)} mm   Espessura: ${fmt(geo.espMin)} - ${fmt(geo.espMax)} mm`);
  L.push(`  Base            : ${fmt(geo.standW)} x ${fmt(geo.standD)} x ${fmt(geo.standH)} mm`);
  L.push(`  Luz             : ${geo.luzNome}`, '', sep, '', '  PECAS:');
  L.push('  1) painel_litofania.stl - PLA BRANCO ou "natural" (translucido),');
  L.push('     de pe (na vertical, a face lisa para a frente), SEM suportes.');
  L.push('     2-3 paredes, sem enchimento extra na zona da imagem.');
  L.push('  2) base_caixa_luz.stl - encaixe da luz + ranhura do painel. Imprime');
  L.push('     como sai, sem suportes.');
  L.push('', sep, '', '  MONTAGEM:');
  if (geo.luzNome.startsWith('LED Kit')) {
    L.push('  * Disco LED (Bambu Lab LED Lamp Kit-001 ou compativel, 59 mm):');
    L.push('    cabo pelo furo do centro e pelo canal por baixo da base; cola o');
    L.push('    disco no encaixe com a fita do kit, luz para cima.');
  } else if (geo.luzNome.startsWith('Casquilho')) {
    L.push('  * Casquilho E14 com tubo M10: aperta ao furo do centro com a porca');
    L.push('    por baixo; cabo pelo canal. Usa SEMPRE lampada LED.');
  } else {
    L.push('  * Vela LED (tea light, ~38 mm) no encaixe do centro.');
  }
  L.push('  * Desliza o painel pela ranhura de cima da base (a moldura entra,');
  L.push('    a zona da imagem fica por cima, fora da base).');
  L.push('', '  NOTA: peca nova — confirma o encaixe e a estabilidade (a peca');
  L.push('  pode tombar com painéis altos/estreitos) antes de produzir em serie.');
  L.push('  Se tombar: cola o painel na ranhura ou lastra a base.', '', sep);
  return L.join('\r\n');
}
