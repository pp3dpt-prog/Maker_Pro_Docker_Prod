// Ajuste automático do texto à largura útil da peça.
//
// O OpenSCAD não mede texto, por isso o servidor calcula um factor de redução
// (0–1) por campo e injecta-o no SCAD como esc_<campo>. A pré-visualização no
// browser (frontend: lib/etiquetaMochila.ts) usa exactamente o mesmo cálculo —
// soma das larguras de avanço dos glifos, sem kerning — para que o que o
// utilizador vê seja o que é gerado. O kerning real do OpenSCAD só estreita o
// texto, por isso o factor fica do lado seguro.
//
// Só corre para designs cujo generation_schema tenha a marca:
//   "ajuste_texto": { "largura_util": 72, "campos": ["nome","linha2","verso"],
//                     "largura_por_forma": { "Redonda": 46, ... } }   // opcional, pelo param `forma`

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import opentype from 'opentype.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = process.env.FONTS_DIR || path.join(__dirname, '..', 'fonts');

// OpenSCAD: text(size = s) tem um em-square de s * 100/72 mm
// (calibrado contra o OpenSCAD 2021.01: "H" com size=10 mede 10.125 mm em DejaVu Sans).
export const EM_POR_SIZE = 100 / 72;

// nome usado no parâmetro `fonte` → ficheiro em /fonts
const FONT_FILES = {
  'Open Sans':         'OpenSans-Regular.ttf',
  'Aladin':            'Aladin-Regular.ttf',
  'Amarante':          'Amarante-Regular.ttf',
  'Anton':             'Anton-Regular.ttf',
  'Baloo 2':           'Baloo2-SemiBold.ttf',
  'Baloo2':            'Baloo2-SemiBold.ttf',
  'Benne':             'Benne-Regular.otf',
  'Chewy':             'Chewy-Regular.ttf',
  'Gloria Hallelujah': 'GloriaHallelujah.ttf',
  'Lobster':           'Lobster-Regular.ttf',
  'Luckiest Guy':      'LuckiestGuy-Regular.ttf',
  'Oswald':            'Oswald-Bold.ttf',
  'Pacifico':          'Pacifico-Regular.ttf',
  'Press Start 2P':    'PressStart2P-Regular.ttf',
  'Racing Sans One':   'RacingSansOne-Regular.ttf',
  'Sigmar One':        'SigmarOne-Regular.ttf',
};

const cache = new Map();

function carregarFonte(nome) {
  const ficheiro = FONT_FILES[nome];
  if (!ficheiro) return null;
  if (cache.has(ficheiro)) return cache.get(ficheiro);
  try {
    const buf = fs.readFileSync(path.join(FONTS_DIR, ficheiro));
    const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    cache.set(ficheiro, font);
    return font;
  } catch (e) {
    console.warn(`textFit: não foi possível carregar "${ficheiro}": ${e.message}`);
    cache.set(ficheiro, null);
    return null;
  }
}

/** Largura (mm) do texto: soma dos avanços dos glifos, sem kerning. */
export function larguraTexto(font, texto, sizeMm) {
  const k = (sizeMm * EM_POR_SIZE) / font.unitsPerEm;
  let w = 0;
  for (const c of String(texto)) w += font.charToGlyph(c).advanceWidth * k;
  return w;
}

/** Factor 0–1 a aplicar ao texto para caber em larguraUtil (mm). */
export function fatorEscala(font, texto, sizeMm, larguraUtil) {
  if (!texto) return 1;
  const w = larguraTexto(font, texto, sizeMm);
  if (!(w > 0)) return 1;
  return Math.round(Math.min(1, larguraUtil / w) * 10000) / 10000;
}

/**
 * Se o design tiver `generation_schema.ajuste_texto`, acrescenta a `params`
 * os factores esc_<campo>. Altera e devolve o próprio objecto `params`.
 * Designs sem a marca não são tocados.
 */
export function aplicarAjusteTexto(generationSchema, params) {
  const cfg = generationSchema?.ajuste_texto;
  if (!cfg || !params) return params;

  // Formas diferentes têm larguras úteis diferentes (largura_por_forma[params.forma]);
  // sem forma conhecida usa-se largura_util.
  const porForma = cfg.largura_por_forma && typeof params.forma === 'string'
    ? Number(cfg.largura_por_forma[params.forma]) : NaN;
  let larguraUtil = porForma > 0 ? porForma : Number(cfg.largura_util);
  if (!(larguraUtil > 0)) return params;
  // a largura útil acompanha a largura da placa (cfg.largura_pct_param, em %); mesmo
  // limite 50–200 % que _esc() no .scad
  const pct = cfg.largura_pct_param ? Number(params[cfg.largura_pct_param]) : NaN;
  if (pct > 0) larguraUtil *= Math.max(0.5, Math.min(2, pct / 100));

  const campos = Array.isArray(cfg.campos) ? cfg.campos : ['nome', 'linha2', 'verso'];
  const size = Number(params.fontSize) > 0 ? Number(params.fontSize) : 9;
  const font = carregarFonte(String(params.fonte ?? 'Open Sans'));

  for (const campo of campos) {
    const texto = typeof params[campo] === 'string' ? params[campo] : '';
    params[`esc_${campo}`] = font ? fatorEscala(font, texto, size, larguraUtil) : 1;
  }
  return params;
}
