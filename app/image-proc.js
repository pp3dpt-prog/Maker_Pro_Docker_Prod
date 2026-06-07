/**
 * Enquadramento de imagem para geração de heightmaps.
 *
 * Replica o enquadramento da pré-visualização do editor (object-fit, zoom,
 * posição) para que o STL corresponda ao que o utilizador vê — em vez de usar
 * sempre a imagem crua esticada. O ajuste de tom (contraste/brilho), o modo de
 * cor e a quantização continuam a ser feitos por quem chama, sobre a imagem já
 * enquadrada que esta função devolve.
 */

import Jimp from 'jimp';

/**
 * Devolve uma cópia da imagem enquadrada numa moldura com o rácio da peça,
 * aplicando modo de ajuste, zoom e posição (equivalente ao preview do editor).
 * Mantém RGB (não converte para cinzento) e usa fundo preto nas zonas vazias
 * (modo "Ajustar"/zoom out) → base lisa.
 *
 * @param {import('jimp')} img  imagem Jimp já carregada (não é mutada)
 * @param {object} opts
 * @param {number}  opts.targetLong   lado mais comprido da grelha, em px
 * @param {number}  opts.aspect       rácio alvo largura/altura da peça
 * @param {string}  [opts.fit]        'Preencher' (cover) | 'Ajustar' (contain) | 'Esticar' (fill)
 * @param {number}  [opts.zoom]       zoom em % (100 = sem zoom)
 * @param {number}  [opts.posX]       posição horizontal -50..50
 * @param {number}  [opts.posY]       posição vertical -50..50
 * @returns {Promise<import('jimp')>}
 */
export async function frameImage(img, {
  targetLong,
  aspect,
  fit = 'Esticar',   // default = comportamento antigo (esticar p/ a peça)
  zoom = 100,
  posX = 0,
  posY = 0,
}) {
  // Dimensões da grelha alvo a partir do rácio da peça (lado maior = targetLong)
  let targetW, targetH;
  if (aspect >= 1) { targetW = targetLong; targetH = Math.max(1, Math.round(targetLong / aspect)); }
  else             { targetH = targetLong; targetW = Math.max(1, Math.round(targetLong * aspect)); }

  const srcW = img.getWidth(), srcH = img.getHeight();
  const z = Math.max(0.05, Number(zoom) / 100);
  const srcRatio = srcW / srcH;
  const tgtRatio = targetW / targetH;

  // Tamanho da imagem dentro da moldura conforme o modo de ajuste
  let drawW, drawH;
  if (fit === 'Esticar') {            // fill — estica para preencher
    drawW = targetW; drawH = targetH;
  } else if (fit === 'Ajustar') {     // contain — cabe inteira
    if (srcRatio > tgtRatio) { drawW = targetW; drawH = targetW / srcRatio; }
    else                     { drawH = targetH; drawW = targetH * srcRatio; }
  } else {                            // Preencher / cover (default do editor) — preenche e corta
    if (srcRatio > tgtRatio) { drawH = targetH; drawW = targetH * srcRatio; }
    else                     { drawW = targetW; drawH = targetW / srcRatio; }
  }
  drawW = Math.max(1, Math.round(drawW * z));
  drawH = Math.max(1, Math.round(drawH * z));

  const canvas = new Jimp(targetW, targetH, 0x000000ff);
  const resized = img.clone().resize(drawW, drawH);

  // object-position em percentagem: alinha o ponto P% da imagem com o P% da moldura
  const offX = Math.round((targetW - drawW) * ((50 + Number(posX)) / 100));
  const offY = Math.round((targetH - drawH) * ((50 + Number(posY)) / 100));
  canvas.composite(resized, offX, offY);

  return canvas;
}

/**
 * Rácio largura/altura alvo (W/H) consoante a família do produto.
 * Mantém as células da grelha quadradas (sem distorção da imagem).
 */
export function aspectForFamily(familia, p) {
  const f = String(familia || '').toLowerCase();
  if (f === 'portachaves') {
    const lw = Number(p.largura ?? p.largura_mm ?? 55);
    const lh = Number(p.altura  ?? p.altura_mm  ?? 35);
    return lw / lh;
  }
  if (f === 'litofania-curva') {
    const raio   = Number(p.raio   ?? 50);
    const angulo = Number(p.angulo ?? 270);
    const altura = Number(p.altura_mm ?? 150);
    return (raio * (angulo * Math.PI / 180)) / altura;
  }
  // hueforge, marcadores, litofania
  const lw = Number(p.largura_mm ?? 100);
  const lh = Number(p.altura_mm  ?? 100);
  return lw / lh;
}
