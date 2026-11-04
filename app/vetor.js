/**
 * Vetorização de imagens (SVG ou PNG/JPG) para o porta-chaves de imagem a cores.
 *
 *   ficheiro → raster RGBA (resvg para SVG, Jimp para PNG/JPG)
 *            → fundo removido (transparência ou cor da borda por flood fill)
 *            → N cores (k-means DETERMINÍSTICO — a pré-visualização e o download
 *              têm de dar exatamente o mesmo resultado)
 *            → contornos vetoriais por cor (potrace) em píxeis
 *
 * O resultado fica em píxeis (y para baixo); a escala para mm, os contornos,
 * o furo e a extrusão são feitos em vetorGeom.js — partilhado com o browser.
 */
import Jimp from 'jimp';
import potrace from 'potrace';
import { Resvg } from '@resvg/resvg-js';

const LADO_MAX = 1000;        // resolução do raster de trabalho (lado maior, px)
const TURD_PX = 6;            // manchas com menos área (px²) são ignoradas pelo potrace

// ── Raster ───────────────────────────────────────────────────────────────────

function pareceSvg(buffer) {
  const ini = buffer.subarray(0, 512).toString('utf8').trimStart().toLowerCase();
  return ini.startsWith('<svg') || (ini.startsWith('<?xml') && buffer.subarray(0, 4096).toString('utf8').toLowerCase().includes('<svg'));
}

async function rasterizar(buffer) {
  const ehSvg = pareceSvg(buffer);
  if (ehSvg) {
    const svg = buffer.toString('utf8');
    const medida = new Resvg(svg);
    const horizontal = medida.width >= medida.height;
    const r = new Resvg(svg, {
      fitTo: horizontal ? { mode: 'width', value: LADO_MAX } : { mode: 'height', value: LADO_MAX },
      background: 'rgba(0,0,0,0)',
      font: { loadSystemFonts: true },
    });
    const png = r.render().asPng();
    return { img: await Jimp.read(Buffer.from(png)), ehSvg };
  }
  const img = await Jimp.read(buffer);
  const w = img.getWidth(), h = img.getHeight();
  const k = LADO_MAX / Math.max(w, h);
  // Imagens pequenas são ampliadas (contornos mais suaves no potrace); grandes reduzidas.
  if (Math.abs(k - 1) > 0.02) img.resize(Math.round(w * k), Math.round(h * k), Jimp.RESIZE_BILINEAR);
  return { img, ehSvg };
}

// ── Fundo ────────────────────────────────────────────────────────────────────

/** Máscara de primeiro plano (1 = desenho). */
function mascaraPrimeiroPlano(img, { removerFundo, tolerancia }) {
  const W = img.getWidth(), H = img.getHeight();
  const d = img.bitmap.data;
  const fg = new Uint8Array(W * H);
  let transparentes = 0;
  for (let i = 0; i < W * H; i++) {
    if (d[i * 4 + 3] >= 128) fg[i] = 1; else transparentes++;
  }
  // Imagem já com transparência a sério → é isso que define o fundo.
  if (!removerFundo || transparentes > W * H * 0.02) return fg;

  // Sem transparência: a cor mais comum na borda é o fundo; flood fill a partir da
  // borda (assim o branco DENTRO do desenho — olhos, letras — não é apagado).
  const contagem = new Map();
  const chave = (i) => ((d[i * 4] >> 4) << 8) | ((d[i * 4 + 1] >> 4) << 4) | (d[i * 4 + 2] >> 4);
  const borda = [];
  for (let x = 0; x < W; x++) borda.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) borda.push(y * W, y * W + W - 1);
  for (const i of borda) contagem.set(chave(i), (contagem.get(chave(i)) ?? 0) + 1);
  let melhor = 0, melhorN = -1;
  for (const [k, n] of contagem) if (n > melhorN) { melhor = k; melhorN = n; }
  // Cor média dos píxeis da borda com essa chave
  let r = 0, g = 0, b = 0, n = 0;
  for (const i of borda) if (chave(i) === melhor) { r += d[i * 4]; g += d[i * 4 + 1]; b += d[i * 4 + 2]; n++; }
  r /= n; g /= n; b /= n;
  const tol2 = tolerancia * tolerancia;
  const parecido = (i) => {
    const dr = d[i * 4] - r, dg = d[i * 4 + 1] - g, db = d[i * 4 + 2] - b;
    return dr * dr + dg * dg + db * db <= tol2;
  };

  const visto = new Uint8Array(W * H);
  const pilha = [];
  for (const i of borda) if (!visto[i] && fg[i] && parecido(i)) { visto[i] = 1; pilha.push(i); }
  while (pilha.length) {
    const i = pilha.pop();
    fg[i] = 0;
    const x = i % W, y = (i - x) / W;
    if (x > 0) { const j = i - 1; if (!visto[j] && fg[j] && parecido(j)) { visto[j] = 1; pilha.push(j); } }
    if (x < W - 1) { const j = i + 1; if (!visto[j] && fg[j] && parecido(j)) { visto[j] = 1; pilha.push(j); } }
    if (y > 0) { const j = i - W; if (!visto[j] && fg[j] && parecido(j)) { visto[j] = 1; pilha.push(j); } }
    if (y < H - 1) { const j = i + W; if (!visto[j] && fg[j] && parecido(j)) { visto[j] = 1; pilha.push(j); } }
  }
  return fg;
}

// ── Cores (k-means determinístico) ───────────────────────────────────────────

const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

function kmeans(img, fg, n) {
  const W = img.getWidth(), H = img.getHeight();
  const d = img.bitmap.data;
  const idx = [];
  for (let i = 0; i < W * H; i++) if (fg[i]) idx.push(i);
  if (!idx.length) return { centros: [], etiqueta: new Int8Array(W * H).fill(-1) };

  // Só píxeis "de miolo" entram no cálculo das cores: os da transição entre duas
  // cores ou com o fundo (anti-aliasing) criariam cores fantasma (ex.: rosa entre
  // vermelho e branco). Esses píxeis são depois atribuídos à cor mais próxima.
  const R = 2, LIM = 60;
  const miolo = (i) => {
    const x = i % W, y = (i - x) / W;
    if (x < R || y < R || x >= W - R || y >= H - R) return false;
    for (const j of [i - R, i + R, i - R * W, i + R * W]) {
      if (!fg[j]) return false;
      if (Math.abs(d[j * 4] - d[i * 4]) + Math.abs(d[j * 4 + 1] - d[i * 4 + 1]) + Math.abs(d[j * 4 + 2] - d[i * 4 + 2]) > LIM) return false;
    }
    return true;
  };
  let base = idx.filter(miolo);
  if (base.length < idx.length * 0.05) base = idx; // desenho só de traços finos

  // Amostra regular (não aleatória) para os centros
  const passo = Math.max(1, Math.floor(base.length / 40000));
  const amostra = [];
  for (let k = 0; k < base.length; k += passo) {
    const i = base[k];
    amostra.push([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
  }

  // Inicialização "farthest point" a partir do píxel mais escuro → sempre igual
  let primeiro = amostra[0];
  for (const p of amostra) if (lum(p) < lum(primeiro)) primeiro = p;
  const centros = [primeiro.slice()];
  const dist = amostra.map(p => (p[0] - primeiro[0]) ** 2 + (p[1] - primeiro[1]) ** 2 + (p[2] - primeiro[2]) ** 2);
  while (centros.length < n) {
    let j = 0;
    for (let k = 1; k < amostra.length; k++) if (dist[k] > dist[j]) j = k;
    if (dist[j] < 1) break; // não há mais cores distintas
    const c = amostra[j].slice();
    centros.push(c);
    for (let k = 0; k < amostra.length; k++) {
      const p = amostra[k];
      const dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
      if (dd < dist[k]) dist[k] = dd;
    }
  }

  const maisPerto = (p) => {
    let best = 0, bd = Infinity;
    for (let c = 0; c < centros.length; c++) {
      const q = centros[c];
      const dd = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
      if (dd < bd) { bd = dd; best = c; }
    }
    return best;
  };
  for (let it = 0; it < 15; it++) {
    const soma = centros.map(() => [0, 0, 0, 0]);
    for (const p of amostra) { const c = maisPerto(p); soma[c][0] += p[0]; soma[c][1] += p[1]; soma[c][2] += p[2]; soma[c][3]++; }
    let mudou = false;
    soma.forEach((s, c) => {
      if (!s[3]) return;
      const novo = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
      if (Math.abs(novo[0] - centros[c][0]) + Math.abs(novo[1] - centros[c][1]) + Math.abs(novo[2] - centros[c][2]) > 0.5) mudou = true;
      centros[c] = novo;
    });
    if (!mudou) break;
  }

  // Ordenar do mais escuro para o mais claro (cor 1 = mais escura)
  const ordem = centros.map((c, i) => i).sort((a, b) => lum(centros[a]) - lum(centros[b]));
  const ordenados = ordem.map(i => centros[i]);
  centros.splice(0, centros.length, ...ordenados);

  const etiqueta = new Int8Array(W * H).fill(-1);
  for (const i of idx) etiqueta[i] = maisPerto([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
  return { centros, etiqueta };
}

// ── Potrace → caminhos em píxeis ─────────────────────────────────────────────

/** Converte o atributo d do potrace (M, L, C absolutos) em anéis de pontos [x0,y0,x1,y1…]. */
export function caminhoParaAneis(dAttr) {
  const tokens = dAttr.match(/[MLCZmlcz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const aneis = [];
  let atual = null, cmd = '', i = 0, cx = 0, cy = 0;
  const num = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[A-Za-z]$/.test(t)) { cmd = t.toUpperCase(); i++; if (cmd === 'Z') { if (atual) aneis.push(atual); atual = null; } continue; }
    if (cmd === 'M') {
      if (atual && atual.length >= 6) aneis.push(atual);
      cx = num(); cy = num(); atual = [cx, cy]; cmd = 'L';
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
    } else { i++; }
  }
  if (atual && atual.length >= 6) aneis.push(atual);
  return aneis;
}

async function tracar(mascara, W, H) {
  const img = new Jimp(W, H, 0xffffffff);
  const d = img.bitmap.data;
  for (let i = 0; i < W * H; i++) if (mascara[i]) { d[i * 4] = 0; d[i * 4 + 1] = 0; d[i * 4 + 2] = 0; }
  const buf = await img.getBufferAsync(Jimp.MIME_PNG);
  const p = new potrace.Potrace({ turdSize: TURD_PX, optTolerance: 0.3, alphaMax: 1.0, threshold: 128, blackOnWhite: true });
  await new Promise((res, rej) => p.loadImage(buf, (e) => (e ? rej(e) : res())));
  const tag = p.getPathTag();
  const m = /\sd="([^"]*)"/.exec(tag);
  return m ? caminhoParaAneis(m[1]) : [];
}

// ── Âncoras para o furo ──────────────────────────────────────────────────────

function ancoras(fg, W, H) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (fg[y * W + x]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, bw = x1 - x0, bh = y1 - y0;

  // Ponto do desenho mais saliente na direção pedida, procurado numa faixa central
  // (30 % da largura/altura), para o furo ficar centrado e agarrado ao desenho.
  const topoEm = (x) => { for (let y = y0; y <= y1; y++) if (fg[y * W + x]) return y; return Infinity; };
  const esqEm = (y) => { for (let x = x0; x <= x1; x++) if (fg[y * W + x]) return x; return Infinity; };
  const dirEm = (y) => { for (let x = x1; x >= x0; x--) if (fg[y * W + x]) return x; return -Infinity; };

  let cima = [cx, y0];
  { let best = Infinity, bestD = Infinity;
    for (let x = Math.round(cx - bw * 0.15); x <= Math.round(cx + bw * 0.15); x++) {
      const y = topoEm(x); const dd = Math.abs(x - cx);
      if (y < best - 1 || (Math.abs(y - best) <= 1 && dd < bestD)) { best = y; bestD = dd; cima = [x, y]; }
    } }
  let esquerda = [x0, cy], direita = [x1, cy];
  { let best = Infinity, bestD = Infinity;
    for (let y = Math.round(cy - bh * 0.15); y <= Math.round(cy + bh * 0.15); y++) {
      const x = esqEm(y); const dd = Math.abs(y - cy);
      if (x < best - 1 || (Math.abs(x - best) <= 1 && dd < bestD)) { best = x; bestD = dd; esquerda = [x, y]; }
    } }
  { let best = -Infinity, bestD = Infinity;
    for (let y = Math.round(cy - bh * 0.15); y <= Math.round(cy + bh * 0.15); y++) {
      const x = dirEm(y); const dd = Math.abs(y - cy);
      if (x > best + 1 || (Math.abs(x - best) <= 1 && dd < bestD)) { best = x; bestD = dd; direita = [x, y]; }
    } }
  // Cantos: ponto que minimiza x+y (cima-esquerda) / maximiza x−y (cima-direita)
  let ce = [x0, y0], cd = [x1, y0], bce = Infinity, bcd = -Infinity;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (fg[y * W + x]) {
    if (x + y < bce) { bce = x + y; ce = [x, y]; }
    if (x - y > bcd) { bcd = x - y; cd = [x, y]; }
  }
  return { cima, esquerda, direita, 'cima-esquerda': ce, 'cima-direita': cd, bbox: [x0, y0, x1, y1] };
}

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * @param {Buffer} buffer  ficheiro carregado (SVG, PNG, JPG, WebP)
 * @param {{ numCores?: number, removerFundo?: boolean, tolerancia?: number }} opts
 */
export async function vetorizarImagem(buffer, { numCores = 3, removerFundo = true, tolerancia = 40 } = {}) {
  const { img, ehSvg } = await rasterizar(buffer);
  const W = img.getWidth(), H = img.getHeight();
  const fg = mascaraPrimeiroPlano(img, { removerFundo, tolerancia });
  let nFg = 0; for (let i = 0; i < W * H; i++) nFg += fg[i];
  if (nFg < W * H * 0.001) throw Object.assign(new Error('A imagem ficou vazia depois de remover o fundo. Experimenta desligar "Remover fundo".'), { status: 400 });

  const n = Math.max(1, Math.min(6, Math.round(numCores)));
  const { centros, etiqueta } = kmeans(img, fg, n);

  const cores = [];
  for (let c = 0; c < centros.length; c++) {
    const m = new Uint8Array(W * H);
    let cnt = 0;
    for (let i = 0; i < W * H; i++) if (etiqueta[i] === c) { m[i] = 1; cnt++; }
    if (cnt < TURD_PX * 4) continue;
    const hex = '#' + centros[c].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    cores.push({ hex, fracao: cnt / nFg, aneis: await tracar(m, W, H) });
  }
  const silhueta = await tracar(fg, W, H);

  return { versao: 1, w: W, h: H, ehSvg, cores, silhueta, ancoras: ancoras(fg, W, H) };
}
