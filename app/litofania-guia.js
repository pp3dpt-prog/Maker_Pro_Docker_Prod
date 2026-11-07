/**
 * Guia TXT de impressão para litofânias (plana e curva).
 * ASCII simples (sem acentos) para abrir bem em qualquer editor/slicer.
 */
export function buildLitofaniaTxt({ cubo = false, geoCubo = null, curva = false, esfera = false, larguraMm, alturaMm, espMin, espMax, moldura = 0, raio, angulo, diametro, furoLed }) {
  const fmt = (v) => Number(v).toFixed(1);
  const sep = '='.repeat(49);
  if (cubo && geoCubo) return guiaCubo(geoCubo, fmt, sep);
  const L = [
    sep,
    `  LITOFANIA ${esfera ? 'ESFERA (BOLA DE NATAL)' : curva ? 'CURVA' : 'PLANA'} - Guia de Impressao`,
    sep,
    '',
  ];

  if (esfera) {
    L.push(`  Diametro        : ${fmt(diametro)} mm`);
    L.push(`  Furo para LED   : ${fmt(furoLed)} mm (em baixo)`);
    L.push(`  Imagem          : ${angulo >= 360 ? 'a toda a volta' : `${angulo} graus a frente`}`);
  } else if (curva) {
    const arco = (Number(raio) * Number(angulo) * Math.PI) / 180;
    L.push(`  Raio exterior   : ${fmt(raio)} mm   (diametro ${fmt(2 * raio)} mm)`);
    L.push(`  Angulo          : ${angulo} graus  (arco de ${fmt(arco)} mm)`);
    L.push(`  Altura          : ${fmt(alturaMm)} mm`);
  } else {
    const m = Number(moldura) || 0;
    L.push(`  Imagem          : ${fmt(larguraMm)} x ${fmt(alturaMm)} mm`);
    if (m > 0) L.push(`  Com moldura     : ${fmt(larguraMm + 2 * m)} x ${fmt(alturaMm + 2 * m)} mm  (moldura de ${fmt(m)} mm)`);
  }
  L.push(`  Espessura       : ${fmt(espMin)} mm (zonas claras) a ${fmt(espMax)} mm (escuras)`);
  L.push('');
  L.push(sep);
  L.push('');
  L.push('  DEFINICOES ACONSELHADAS:');
  L.push('  * Filamento BRANCO (PLA branco normal). Cores ou "natural"');
  L.push('    transparente mudam muito o contraste.');
  L.push('  * Enchimento (infill) 100%.');
  L.push('  * Altura de camada 0.12 mm (0.08 mm para o maximo de detalhe).');
  L.push('  * Velocidade baixa nas paredes exteriores (~40 mm/s).');
  L.push('  * Ventilacao normal; sem suportes.');
  if (esfera) {
    L.push('  * Imprime como sai do ficheiro: furo para baixo, argola para cima.');
    L.push('    SEM suportes (o topo e o fundo sao grossos para imprimir sem eles).');
    L.push('  * Brim de 5 mm ajuda o anel de baixo a nao descolar.');
    L.push('  * Arrefecimento a 100% nas camadas de cima (fecho do topo).');
  } else if (curva) {
    L.push('  * Imprime de pe (como sai do ficheiro), com brim de 5 mm');
    L.push('    para nao descolar da base.');
  } else {
    L.push('  * Melhor qualidade: imprimir DE PE (rodar 90 graus no slicer,');
    L.push('    lado mais comprido assente na base) com brim de 5-8 mm.');
    L.push('    Deitada tambem funciona, mas o detalhe fino perde-se mais.');
  }
  L.push('');
  L.push(sep);
  L.push('');
  L.push('  COMO VER:');
  if (esfera) {
    L.push(`  * Vela LED (tea light) com menos de ${fmt(furoLed)} mm, metida pelo furo de baixo.`);
    L.push('    Fita ou fio pela argola para pendurar na arvore.');
  } else if (curva) {
    L.push('  * Luz por DENTRO (LED quente, de preferencia sem aquecer).');
    L.push('    A imagem le-se pelo lado de fora (liso).');
  } else {
    L.push('  * Luz por TRAS. A imagem le-se pelo lado LISO, com o relevo');
    L.push('    virado para a luz.');
  }
  L.push('  * Sem luz a peca parece quase branca - e normal.');
  L.push('');
  L.push(sep);
  return L.join('\r\n');
}

function guiaCubo(g, fmt, sep) {
  const luz = g.luzNome;
  const L = [
    sep,
    '  LITOFANIA CUBO (CANDEEIRO) - Guia de Impressao',
    sep,
    '',
    `  Cubo            : ${fmt(g.L)} x ${fmt(g.L)} mm, paredes com ${fmt(g.H)} mm de altura`,
    `  Altura montado  : ~${fmt(g.hb + g.H + 3)} mm (base + paredes + tampa)`,
    `  Imagem por face : ${fmt(g.imgW)} x ${fmt(g.imgH)} mm`,
    `  Espessura       : ${fmt(g.espMin)} mm (claro) a ${fmt(g.espMax)} mm (escuro)`,
    `  Luz             : ${luz}`,
    '',
    sep,
    '',
    '  PECAS (3 ficheiros):',
    '  1) cubo_paredes_litofania.stl - as 4 fotos. Filamento BRANCO.',
    '     Imprime DE PE, como sai do ficheiro. Sem suportes.',
    '     Infill 100%, camada 0.12 mm, paredes exteriores lentas (~40 mm/s).',
    '     Brim de 5 mm (a peca e alta e fina).',
    '  2) cubo_base.stl  - encaixe da luz. Cor a gosto (escura evita',
    '     que a luz passe pela base). Imprime como sai, sem suportes.',
    '  3) cubo_tampa.stl - imprime com o rebordo para CIMA; ao montar',
    '     vira-se ao contrario. Mesma cor da base.',
    '',
    sep,
    '',
    '  MONTAGEM:',
  ];
  if (luz.startsWith('LED Kit')) {
    L.push('  * Disco LED (Bambu Lab LED Lamp Kit-001 ou compativel, 59 mm):');
    L.push('    passa o cabo pelo furo do centro e pelo canal por baixo da base,');
    L.push('    e cola o disco no encaixe com a fita de dupla face do kit,');
    L.push('    com a luz virada para cima.');
  } else if (luz.startsWith('Casquilho')) {
    L.push('  * Casquilho E14 com tubo roscado M10: aperta-o ao furo do centro');
    L.push('    com a porca por baixo; o cabo sai pelo canal por baixo da base.');
    L.push('  * Usa SEMPRE lampada LED (aquece pouco). Nunca incandescente.');
  } else {
    L.push('  * Vela LED (tea light, ~38 mm) no encaixe do centro da base.');
  }
  L.push('  * Encaixa as paredes no rebordo da base e poe a tampa por cima.');
  L.push('    Se ficar folgado, uma gota de cola resolve.');
  L.push('');
  L.push('  * A imagem le-se pelo lado de fora (liso). Sem luz parece');
  L.push('    quase branca - e normal.');
  L.push('');
  L.push(sep);
  return L.join('\r\n');
}
