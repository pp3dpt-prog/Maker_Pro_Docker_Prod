/**
 * Extrai LINHAS (não regiões preenchidas) de um SVG — para a Caixa de Luz
 * — Canal de Neon, que segue o traço em vez de preencher uma silhueta.
 * Lê diretamente os elementos <path>/<line>/<polyline>/<polygon> do XML
 * do SVG — não rasteriza nem usa potrace (isso é para regiões preenchidas
 * vindas de uma imagem, ver vetor.js).
 *
 * Limitação conhecida: não aplica `transform` (translate/matrix/etc.) em
 * elementos ou grupos — um SVG com transforms por achatar vai dar
 * coordenadas erradas. A maioria dos SVGs exportados "a direito" (sem
 * grupos aninhados transformados) não tem este problema.
 */

function caminhoParaLinhas(dAttr) {
  const tokens = dAttr.match(/[MLCQZmlcqz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const linhas = [];
  let atual = null, fechado = false, cmd = '', i = 0, cx = 0, cy = 0, mx = 0, my = 0;
  const num = () => parseFloat(tokens[i++]);
  const terminar = () => { if (atual && atual.length >= 4) linhas.push({ pontos: atual, fechado }); atual = null; };
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[A-Za-z]$/.test(t)) {
      cmd = t.toUpperCase(); i++;
      if (cmd === 'Z') { fechado = true; if (atual) atual.push(mx, my); terminar(); cmd = ''; }
      continue;
    }
    if (cmd === 'M') {
      terminar();
      cx = num(); cy = num(); mx = cx; my = cy; atual = [cx, cy]; fechado = false; cmd = 'L';
    } else if (cmd === 'L') {
      cx = num(); cy = num(); atual.push(cx, cy);
    } else if (cmd === 'C') {
      const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num();
      const comp = Math.hypot(x1 - cx, y1 - cy) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x - x2, y - y2);
      const seg = Math.max(2, Math.min(16, Math.ceil(comp / 5)));
      for (let s = 1; s <= seg; s++) {
        const u = s / seg, v = 1 - u;
        atual.push(
          v * v * v * cx + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x,
          v * v * v * cy + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y,
        );
      }
      cx = x; cy = y;
    } else if (cmd === 'Q') {
      const x1 = num(), y1 = num(), x = num(), y = num();
      const comp = Math.hypot(x1 - cx, y1 - cy) + Math.hypot(x - x1, y - y1);
      const seg = Math.max(2, Math.min(16, Math.ceil(comp / 5)));
      for (let s = 1; s <= seg; s++) {
        const u = s / seg, v = 1 - u;
        atual.push(v * v * cx + 2 * v * u * x1 + u * u * x, v * v * cy + 2 * v * u * y1 + u * u * y);
      }
      cx = x; cy = y;
    } else { i++; }
  }
  terminar();
  return linhas;
}

function parsePontos(str) {
  return (str.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? []).map(Number);
}

/**
 * @returns {{ w:number, h:number, linhas:{pontos:number[], fechado:boolean}[], bbox:[number,number,number,number], avisos:string[] }}
 */
export function vetorizarLinhasSvg(svgBuffer) {
  const xml = svgBuffer.toString('utf8');
  const avisos = [];
  if (/\btransform\s*=/.test(xml)) {
    avisos.push('O SVG tem atributos "transform" — são ignorados; se as linhas saírem no sítio errado, achata os transforms no editor (Illustrator/Inkscape: "Object > Flatten Transform") antes de carregar.');
  }

  const mViewBox = /viewBox=["']\s*([-\d.eE]+)[ ,]+([-\d.eE]+)[ ,]+([-\d.eE]+)[ ,]+([-\d.eE]+)\s*["']/.exec(xml);
  const mWidth = /<svg\b[^>]*\bwidth=["']?\s*([\d.]+)/i.exec(xml);
  const mHeight = /<svg\b[^>]*\bheight=["']?\s*([\d.]+)/i.exec(xml);
  let w, h;
  if (mViewBox) { w = parseFloat(mViewBox[3]); h = parseFloat(mViewBox[4]); }
  else { w = mWidth ? parseFloat(mWidth[1]) : 1000; h = mHeight ? parseFloat(mHeight[1]) : 1000; }
  if (!(w > 0) || !(h > 0)) throw Object.assign(new Error('SVG sem viewBox/width/height válidos.'), { status: 400 });

  const linhas = [];
  const rePath = /<path\b[^>]*\bd=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = rePath.exec(xml))) linhas.push(...caminhoParaLinhas(m[1]));

  const reLine = /<line\b[^>]*\bx1=["']([-\d.]+)["'][^>]*\by1=["']([-\d.]+)["'][^>]*\bx2=["']([-\d.]+)["'][^>]*\by2=["']([-\d.]+)["'][^>]*>/gi;
  while ((m = reLine.exec(xml))) linhas.push({ pontos: [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])], fechado: false });

  const rePoly = /<poly(line|gon)\b[^>]*\bpoints=["']([^"']+)["'][^>]*>/gi;
  while ((m = rePoly.exec(xml))) {
    const pts = parsePontos(m[2]);
    if (pts.length >= 4) linhas.push({ pontos: pts, fechado: m[1].toLowerCase() === 'gon' });
  }

  if (!linhas.length) throw Object.assign(new Error('Não encontrei nenhuma linha (<path>, <line>, <polyline> ou <polygon>) no SVG.'), { status: 400 });

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const l of linhas) for (let i = 0; i < l.pontos.length; i += 2) {
    const x = l.pontos[i], y = l.pontos[i + 1];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!(maxX > minX) && !(maxY > minY)) throw Object.assign(new Error('As linhas do SVG não têm comprimento nenhum.'), { status: 400 });

  return { w, h, linhas, bbox: [minX, minY, maxX, maxY], avisos };
}
