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
 * Píxeis-alvo do lado maior da grelha de heightmap, calculados a partir do
 * tamanho REAL da peça (mm) em vez de um número fixo — assim uma peça pequena
 * não fica com ficheiro gigante desnecessário, e uma peça grande não fica sem
 * detalhe. pxPerMm=5 (0.2mm/px) já está perto do limite útil de uma FDM com
 * bocal de 0.4mm — passar muito disso não fica mais nítido na peça impressa,
 * só faz o STL crescer. maxGridPx protege contra ficheiros descontrolados em
 * peças grandes.
 */
export function targetLongPxForFamily(familia, p, { pxPerMm = 5, maxGridPx = 600, minGridPx = 60 } = {}) {
  const f = String(familia || '').toLowerCase();
  let longoMm;
  if (f === 'litofania-curva') {
    const raio   = Number(p.raio   ?? 50);
    const angulo = Number(p.angulo ?? 270);
    const altura = Number(p.altura_mm ?? 150);
    const arco   = raio * (angulo * Math.PI / 180);
    longoMm = Math.max(arco, altura);
  } else if (f === 'portachaves') {
    longoMm = Math.max(Number(p.largura ?? p.largura_mm ?? 55), Number(p.altura ?? p.altura_mm ?? 35));
  } else {
    longoMm = Math.max(Number(p.largura_mm ?? 100), Number(p.altura_mm ?? 100));
  }
  return Math.min(maxGridPx, Math.max(minGridPx, Math.round(longoMm * pxPerMm)));
}

/**
 * Altura contínua (0..1) para uma luminância, usando o modelo ótico real de
 * transmissão por translucidez (Beer-Lambert) em vez de bandas planas.
 *
 * Como o HueForge/Kromacut "a sério": em vez da altura saltar entre n níveis
 * fixos (patamares planos = "degraus" visíveis na peça), a altura varia de
 * forma contínua DENTRO de cada banda de cor, seguindo a curva de transmissão
 * `opacidade(t) = 1 - 10^(-t/TD)` — perto do limite da banda a cor de cima
 * já domina quase por completo; no início da banda a cor de baixo ainda
 * transparece. TD (transmission distance) é a distância a que um filamento
 * deixa de ser translúcido — quanto menor, mais depressa a transição acontece.
 *
 * @param {number} luminancia255   0 (mais escuro) .. 255 (mais claro)
 * @param {number} numCores        nº de filamentos/níveis (>=2)
 * @param {number} [tdFraction]    TD como fração da altura de uma banda.
 *                                 Default 0.9 ≈ TD real de PLA comum (~0.5-0.8mm)
 *                                 para a banda default (2mm/4 cores ≈ 0.67mm).
 *                                 SEM calibração real do filamento — é uma
 *                                 aproximação razoável, não um valor medido.
 *                                 Ajustar depois de um teste de impressão real.
 * @returns {number} altura normalizada 0..1
 */
export function heightFracBeerLambert(luminancia255, numCores, tdFraction = 0.9) {
  const n = Math.max(2, numCores);
  const bandHeight = 1 / (n - 1);
  const pos   = Math.min(n - 1, Math.max(0, (luminancia255 / 255) * (n - 1)));
  const band  = Math.min(n - 2, Math.floor(pos));
  const frac  = pos - band; // 0..1 posição dentro da banda

  const td = tdFraction * bandHeight;
  const maxOpacity    = 1 - Math.pow(10, -bandHeight / td);
  const targetOpacity = Math.min(0.999, frac * maxOpacity);
  const t = -td * Math.log10(1 - targetOpacity); // espessura dentro da banda

  return band * bandHeight + Math.min(bandHeight, t);
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
