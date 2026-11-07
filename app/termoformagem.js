/**
 * Termoformagem / Prensagem manual — kit de molde a partir de um SVG (ou
 * imagem) carregado pelo cliente: Molde Macho (positivo) + Molde Fêmea (com
 * malha de ventilação) + Moldura retentora da folha de plástico.
 *
 * Reaproveita o motor de vetorização já usado no porta-chaves de imagem
 * (vetor.js: SVG/PNG/JPG → silhueta; vetorGeom.js: fatiasParaTriangulos —
 * fatias 2D extrudidas em triângulos, cada fatia com a sua própria região,
 * paredes verticais por fatia). O "ângulo de saída" do macho e o
 * arredondamento do topo são aproximados por muitas fatias finas com um
 * offset crescente — o mesmo princípio staircase com que qualquer slicer FDM
 * já imprime superfícies inclinadas.
 *
 * Processo (ver guiaTermo): aquece a folha presa na moldura com um soprador
 * térmico/secador, depois prensa a fêmea contra o macho. PETG/ASA (resistem
 * ao calor do soprador sem amolecer).
 */
import ClipperLib from 'clipper-lib';
import { fatiasParaTriangulos } from './vetorGeom.js';

const ESC = 1000; // Clipper em inteiros: 1 unidade = 1 µm

const C = ClipperLib;
const FILL_NZ = C.PolyFillType.pftNonZero;
const FILL_EO = C.PolyFillType.pftEvenOdd;

function executar(tipo, sujeito, recorte = [], fill = FILL_NZ) {
  const c = new C.Clipper();
  if (sujeito.length) c.AddPaths(sujeito, C.PolyType.ptSubject, true);
  if (recorte.length) c.AddPaths(recorte, C.PolyType.ptClip, true);
  const sol = new C.Paths();
  c.Execute(tipo, sol, fill, fill);
  return sol;
}
const uniao = (a, b = [], fill = FILL_NZ) => executar(C.ClipType.ctUnion, a, b, fill);
const diferenca = (a, b) => (b.length ? executar(C.ClipType.ctDifference, a, b) : a);

function offset(paths, mm) {
  if (!paths.length || Math.abs(mm) < 1e-4) return paths;
  const co = new C.ClipperOffset(2, 0.02 * ESC);
  co.AddPaths(paths, C.JoinType.jtRound, C.EndType.etClosedPolygon);
  const out = new C.Paths();
  co.Execute(out, mm * ESC);
  return out;
}

function aneisParaPaths(aneis, s, H) {
  return aneis.map(a => {
    const p = [];
    for (let i = 0; i < a.length; i += 2) p.push({ X: Math.round(a[i] * s * ESC), Y: Math.round((H - a[i + 1]) * s * ESC) });
    return p;
  });
}

function circulo(cx, cy, r, seg = 20) {
  const p = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    p.push({ X: Math.round((cx + r * Math.cos(a)) * ESC), Y: Math.round((cy + r * Math.sin(a)) * ESC) });
  }
  return p;
}

function bbox(paths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const q of paths) for (const pt of q) {
    if (pt.X < minX) minX = pt.X; if (pt.X > maxX) maxX = pt.X;
    if (pt.Y < minY) minY = pt.Y; if (pt.Y > maxY) maxY = pt.Y;
  }
  return { minX: minX / ESC, minY: minY / ESC, maxX: maxX / ESC, maxY: maxY / ESC };
}

function retangulo(minX, minY, maxX, maxY) {
  return [[
    { X: Math.round(minX * ESC), Y: Math.round(minY * ESC) },
    { X: Math.round(maxX * ESC), Y: Math.round(minY * ESC) },
    { X: Math.round(maxX * ESC), Y: Math.round(maxY * ESC) },
    { X: Math.round(minX * ESC), Y: Math.round(maxY * ESC) },
  ]];
}

// ── Parâmetros ───────────────────────────────────────────────────────────────

const num = (v, def, min, max) => {
  const n = Number(v);
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : def));
};

export function termoGeometria(p) {
  return {
    larguraMm: num(p?.largura_mm, 60, 20, 150),
    alturaMm: num(p?.altura_mm, 20, 5, 50),               // profundidade da forma (altura do macho)
    espChapaMm: num(p?.espessura_chapa_mm, 0.5, 0.2, 2),   // espessura da folha de plástico a termoformar
    contornoMm: num(p?.contorno_mm, 10, 5, 25),            // margem da base à volta do desenho
    espBaseMm: num(p?.espessura_base_mm, 4, 2, 10),        // espessura sólida da base (macho e fêmea)
    draftGraus: num(p?.draft_graus, 5, 0, 15),             // ângulo de saída do macho
    raioTopoMm: Math.min(num(p?.raio_topo_mm, 1.5, 0, 4), num(p?.altura_mm, 20, 5, 50) * 0.4),
    molduraLargMm: num(p?.moldura_largura_mm, 18, 10, 35),
    molduraEspMm: num(p?.espessura_moldura_mm, 4, 2, 8),
    furoVentMm: num(p?.furo_ventilacao_mm, 1.2, 0.8, 2),
    passoVentMm: num(p?.espaco_ventilacao_mm, 8, 5, 15),
  };
}

/** Silhueta em mm (Clipper paths), centrada na origem, a partir do resultado de vetorizarImagem. */
function silhuetaMm(vetor, larguraMm) {
  const bb = vetor.ancoras?.bbox;
  const larguraPx = bb ? Math.max(1, bb[2] - bb[0] + 1) : vetor.w;
  const s = larguraMm / larguraPx;
  const H = vetor.h;
  let silhueta = uniao(aneisParaPaths(vetor.silhueta, s, H), [], FILL_EO);
  if (!silhueta.length) throw Object.assign(new Error('Não foi possível extrair uma forma da imagem/SVG carregado.'), { status: 400 });
  const { minX, minY, maxX, maxY } = bbox(silhueta);
  const dx = (minX + maxX) / 2, dy = (minY + maxY) / 2;
  return silhueta.map(q => q.map(pt => ({ X: pt.X - Math.round(dx * ESC), Y: pt.Y - Math.round(dy * ESC) })));
}

/** Inset (mm, positivo encolhe) do contorno do macho à altura z (0 = base do macho). */
function insetNaAltura(z, g) {
  const draft = z * Math.tan((g.draftGraus * Math.PI) / 180);
  const zFiletagem = g.alturaMm - g.raioTopoMm;
  if (g.raioTopoMm <= 0 || z <= zFiletagem) return draft;
  const t = (z - zFiletagem) / g.raioTopoMm; // 0 no início do arredondamento → 1 no topo
  const extra = g.raioTopoMm * (1 - Math.cos((t * Math.PI) / 2));
  return draft + extra;
}

const NS_PREVIEW = 10, NS_FINAL = 36;

/**
 * @returns {{ machoFatias, femeaFatias, moldura2d, larguraTotal, alturaTotal, profundMolde }}
 */
function construirMolde(vetor, g, { final = true } = {}) {
  const silhueta = silhuetaMm(vetor, g.larguraMm);
  const base2d = offset(silhueta, g.contornoMm);
  const NS = final ? NS_FINAL : NS_PREVIEW;

  // ── Macho: base sólida + boss cónico/arredondado (muitas fatias finas) ──
  const machoFatias = [{ z0: 0, z1: g.espBaseMm, regiao: base2d }];
  for (let i = 0; i < NS; i++) {
    const z0 = (i / NS) * g.alturaMm, z1 = ((i + 1) / NS) * g.alturaMm;
    const inset = insetNaAltura((z0 + z1) / 2, g);
    const regiao = offset(silhueta, -inset);
    if (regiao.length) machoFatias.push({ z0: g.espBaseMm + z0, z1: g.espBaseMm + z1, regiao });
  }

  // ── Fêmea: base sólida com furos de ventilação + cavidade com folga
  //    constante (espessura da chapa) em relação à superfície do macho ──
  const ventilacao = furosVentilacao(silhueta, g);
  const femeaFatias = [
    { z0: 0, z1: g.espBaseMm, regiao: diferenca(base2d, ventilacao) },
  ];
  for (let i = 0; i < NS; i++) {
    const z0 = (i / NS) * g.alturaMm, z1 = ((i + 1) / NS) * g.alturaMm;
    const inset = insetNaAltura((z0 + z1) / 2, g);
    const cavidade = offset(silhueta, g.espChapaMm - inset);
    const regiao = diferenca(diferenca(base2d, cavidade), ventilacao);
    femeaFatias.push({ z0: g.espBaseMm + z0, z1: g.espBaseMm + z1, regiao });
  }

  // ── Moldura: aro retangular à volta da base, para prender a folha ──
  const { minX, minY, maxX, maxY } = bbox(base2d);
  const gap = 3; // folga entre a base e a moldura
  const moldura2d = diferenca(
    retangulo(minX - gap - g.molduraLargMm, minY - gap - g.molduraLargMm, maxX + gap + g.molduraLargMm, maxY + gap + g.molduraLargMm),
    retangulo(minX - gap, minY - gap, maxX + gap, maxY + gap),
  );

  return {
    machoFatias, femeaFatias, moldura2d,
    larguraTotal: maxX - minX, profundMolde: g.espBaseMm + g.alturaMm,
  };
}

/** Grelha de furos de ventilação dentro da silhueta (Clipper paths dos furos). */
function furosVentilacao(silhueta, g) {
  const { minX, minY, maxX, maxY } = bbox(silhueta);
  const margem = g.furoVentMm; // não colocar furos a rasar a parede
  const dentro = offset(silhueta, -margem - g.furoVentMm / 2);
  if (!dentro.length) return [];
  const furos = [];
  for (let x = minX; x <= maxX; x += g.passoVentMm) {
    for (let y = minY; y <= maxY; y += g.passoVentMm) {
      const pt = { X: Math.round(x * ESC), Y: Math.round(y * ESC) };
      const dentroDeAlgum = dentro.some(poly => C.Clipper.PointInPolygon(pt, poly) !== 0);
      if (dentroDeAlgum) furos.push(circulo(x, y, g.furoVentMm / 2));
    }
  }
  return furos.length ? uniao(furos) : [];
}

/** Fatia 2D → malha triangular plana (reaproveita o extrusor de vetorGeom.js). */
function malhaDeFatias(fatias) {
  return fatiasParaTriangulos(fatias);
}

export const FAMILIA_TERMO = 'termoformagem';

/**
 * Entrada única: gera as 3 peças (triângulos) a partir do resultado já
 * vetorizado (ver app/vetorPortachaves.js: obterVetor — o mesmo passo caro
 * de vetorização usado no porta-chaves de imagem, com cache) + parâmetros.
 */
export function gerarTermoformagem(vetor, params, { final = true } = {}) {
  const g = termoGeometria(params);
  const r = construirMolde(vetor, g, { final });
  return {
    g,
    macho: malhaDeFatias(r.machoFatias),
    femea: malhaDeFatias(r.femeaFatias),
    moldura: malhaDeFatias([{ z0: 0, z1: g.molduraEspMm, regiao: r.moldura2d }]),
    larguraTotal: r.larguraTotal,
    profundMolde: r.profundMolde,
  };
}

export function guiaTermoformagem(g) {
  const fmt = (v) => Number(v).toFixed(1);
  const sep = '='.repeat(49);
  const L = [sep, '  TERMOFORMAGEM / PRENSAGEM MANUAL', sep, ''];
  L.push(`  Forma           : largura ${fmt(g.larguraMm)} mm, profundidade ${fmt(g.alturaMm)} mm`);
  L.push(`  Folha de plastico: ${fmt(g.espChapaMm)} mm (folga da cavidade da femea)`);
  L.push(`  Angulo de saida  : ${fmt(g.draftGraus)} graus   Raio do topo: ${fmt(g.raioTopoMm)} mm`);
  L.push(`  Ventilacao       : furos de ${fmt(g.furoVentMm)} mm a cada ${fmt(g.passoVentMm)} mm`);
  L.push('', sep, '', '  PECAS:');
  L.push('  1) macho.stl  - molde positivo. PETG ou ASA (resiste ao calor do');
  L.push('     soprador). De pe, sem suportes.');
  L.push('  2) femea.stl  - molde negativo com furos de ventilacao. PETG/ASA,');
  L.push('     de pe, sem suportes.');
  L.push('  3) moldura.stl - aro para prender a folha de plastico. Qualquer PLA/PETG.');
  L.push('', sep, '', '  MONTAGEM E USO:');
  L.push('  * Corta a folha de plastico maior que a moldura, prende-a entre a');
  L.push('    moldura e uma base plana (ou uma segunda moldura) com grampos.');
  L.push('  * Aquece a folha com soprador termico ou secador ate amolecer');
  L.push('    (fica visivelmente mole/translucida) — NAO uses chama direta.');
  L.push('  * Prensa a femea contra o macho (com a folha quente entre as duas),');
  L.push('    com pressao firme e constante ate arrefecer (uns 20-30 segundos).');
  L.push('  * Os furos da femea deixam o ar sair — sem eles a folha fica com');
  L.push('    bolhas/zonas que nao encostam ao molde.');
  L.push('  * Recorta o excesso de plastico a volta da peca formada.');
  L.push('', '  NOTA: peca nova — confirma o encaixe/folga da femea com a tua');
  L.push('  folha real antes de produzir em serie (a folga pode precisar de');
  L.push('  ajuste conforme a chapa encolhe ligeiramente ao arrefecer).', '', sep);
  return L.join('\r\n');
}
