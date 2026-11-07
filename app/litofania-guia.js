/**
 * Guia TXT de impressão para litofânias (plana e curva).
 * ASCII simples (sem acentos) para abrir bem em qualquer editor/slicer.
 */
export function buildLitofaniaTxt({ curva = false, larguraMm, alturaMm, espMin, espMax, moldura = 0, raio, angulo }) {
  const fmt = (v) => Number(v).toFixed(1);
  const sep = '='.repeat(49);
  const L = [
    sep,
    `  LITOFANIA ${curva ? 'CURVA' : 'PLANA'} - Guia de Impressao`,
    sep,
    '',
  ];

  if (curva) {
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
  if (curva) {
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
  if (curva) {
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
