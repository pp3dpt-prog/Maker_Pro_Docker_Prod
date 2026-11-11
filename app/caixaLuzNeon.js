/**
 * Caixa de Luz — Canal de Neon (generation_schema.gerador = "caixa-luz-neon"):
 * segue uma LINHA (um nome/traço contínuo, ou qualquer SVG desenhado a
 * linhas — ver vetorLinhas.js) e constrói um canal simples em U ao longo
 * dela, para encaixar uma fita de neon LED flexível (ex. 4x10mm, com
 * curvatura lateral — dobra no plano do desenho, não ao virar de lado).
 *
 * Ao contrário da Caixa de Luz — Logótipo (caixaLuzLogo.js), que PREENCHE
 * uma silhueta, aqui a "silhueta" é a própria linha espessada: uma peça
 * só (canal.stl), sem frente nem separação de cores — a luz vem
 * diretamente da fita de neon, visível pela abertura do canal.
 */
import ClipperLib from 'clipper-lib';
import { planoDivisao, fatiasNoBloco } from './divisaoBlocos.js';
import { fatiasParaTriangulos } from './vetorGeom.js';

const ESC = 1000;
const C = ClipperLib;
const FILL_NZ = C.PolyFillType.pftNonZero;

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

/**
 * Espessa `linhas` (abertas ou fechadas) em `delta` mm para cada lado do
 * traço — usa o ClipperOffset em modo LINHA (etOpenRound/etClosedLine),
 * não polígono preenchido, porque a entrada é um traço, não uma região.
 */
function offsetLinhas(linhas, delta) {
  if (!linhas.length || delta <= 0) return [];
  const abertas = linhas.filter(l => !l.fechado).map(l => l.path);
  const fechadas = linhas.filter(l => l.fechado).map(l => l.path);
  const co = new C.ClipperOffset(2, 0.02 * ESC);
  if (abertas.length) co.AddPaths(abertas, C.JoinType.jtRound, C.EndType.etOpenRound);
  if (fechadas.length) co.AddPaths(fechadas, C.JoinType.jtRound, C.EndType.etClosedLine);
  const out = new C.Paths();
  co.Execute(out, delta * ESC);
  return uniao(out);
}

const num = (v, def, min, max) => {
  const n = Number(v);
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : def));
};

export function normalizarParametrosNeon(p = {}) {
  return {
    largura: num(p.largura, 200, 30, 900),
    largura_canal_mm: num(p.largura_canal_mm, 5, 3, 8),
    profundidade_canal_mm: num(p.profundidade_canal_mm, 9, 8, 10),
    parede_mm: num(p.parede_mm, 2, 1.2, 4),
    espessura_fundo_mm: num(p.espessura_fundo_mm, 2, 1.2, 4),
    mesa_x_mm: num(p.mesa_x_mm, 256, 100, 1000),
    mesa_y_mm: num(p.mesa_y_mm, 256, 100, 1000),
  };
}

/** Linhas do vetor (em píxeis) → paths do Clipper (em mm, escalados e centrados no bbox). */
function linhasParaEsc(vetor, s) {
  const [minX, minY, maxX, maxY] = vetor.bbox;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return vetor.linhas.map(l => {
    const path = [];
    for (let i = 0; i < l.pontos.length; i += 2) {
      // Y da imagem cresce para baixo; a geometria cresce para cima (mesmo sentido do resto do site, ver vetorGeom.js).
      path.push({ X: Math.round((l.pontos[i] - cx) * s * ESC), Y: Math.round(-(l.pontos[i + 1] - cy) * s * ESC) });
    }
    return { path, fechado: l.fechado };
  });
}

export const GERADOR_CAIXA_LUZ_NEON = 'caixa-luz-neon';

/**
 * @returns {{ tris:number[], geo:object, largura:number, altura:number, alturaTotal:number, avisos:string[] }}
 */
export function construirCaixaLuzNeon(vetor, parametros) {
  const p = normalizarParametrosNeon(parametros);
  const larguraPx = vetor.bbox[2] - vetor.bbox[0];
  const alturaPx = vetor.bbox[3] - vetor.bbox[1];
  const maiorLadoPx = Math.max(larguraPx, alturaPx);
  if (!(maiorLadoPx > 0)) throw Object.assign(new Error('O SVG não tem nenhuma linha com comprimento.'), { status: 400 });
  const s = p.largura / maiorLadoPx;

  const linhasEsc = linhasParaEsc(vetor, s);
  const canalHalf = p.largura_canal_mm / 2;
  const trilhaHalf = canalHalf + p.parede_mm;

  const trilha = offsetLinhas(linhasEsc, trilhaHalf);
  if (!trilha.length) throw Object.assign(new Error('A linha ficou vazia depois de aplicar a espessura da parede — reduz a parede ou aumenta a largura do canal.'), { status: 400 });
  const canal = offsetLinhas(linhasEsc, canalHalf);
  const paredes = diferenca(trilha, canal);
  if (!paredes.length) throw Object.assign(new Error('O canal ficou maior que a parede toda — reduz a largura do canal ou aumenta a espessura da parede.'), { status: 400 });

  const alturaCanalTotal = p.espessura_fundo_mm + p.profundidade_canal_mm;
  const fatias = [
    { z0: 0, z1: p.espessura_fundo_mm, regiao: trilha },
    { z0: p.espessura_fundo_mm, z1: alturaCanalTotal, regiao: paredes },
  ];
  const tris = fatiasParaTriangulos(fatias);

  const { minX, minY, maxX, maxY } = (() => {
    let a = Infinity, b = Infinity, cc = -Infinity, d = -Infinity;
    for (const q of trilha) for (const pt of q) { if (pt.X < a) a = pt.X; if (pt.X > cc) cc = pt.X; if (pt.Y < b) b = pt.Y; if (pt.Y > d) d = pt.Y; }
    return { minX: a / ESC, minY: b / ESC, maxX: cc / ESC, maxY: d / ESC };
  })();
  const largura = maxX - minX, altura = maxY - minY;

  const avisos = [...(vetor.avisos ?? [])];
  // Maior do que a mesa: divisão em blocos (app/divisaoBlocos.js), cortes sugeridos ou do cliente
  const divisao = planoDivisao({ fronteira: trilha, mesaX: p.mesa_x_mm, mesaY: p.mesa_y_mm, params: parametros });
  if (divisao?.ativo) {
    divisao.blocos = divisao.blocos
      .map(b => { const fb = fatiasNoBloco(fatias, b); return { ...b, tris: fb.length ? fatiasParaTriangulos(fb) : null }; })
      .filter(b => b.tris);
    avisos.push(`Dividida em ${divisao.blocos.length} blocos (${divisao.blocos.map(b => b.id).join(', ')}) para caber na mesa de ${p.mesa_x_mm.toFixed(0)} × ${p.mesa_y_mm.toFixed(0)} mm.`);
    const grandes = divisao.blocos.filter(b => !b.cabe);
    if (grandes.length) avisos.push(`Os blocos ${grandes.map(b => `${b.id} (${b.w.toFixed(0)} × ${b.h.toFixed(0)} mm)`).join(', ')} não cabem na mesa — ajusta os cortes ou repõe a sugestão.`);
  } else if (divisao && !divisao.cabeInteira) {
    avisos.push(
      `A peça (${largura.toFixed(0)} × ${altura.toFixed(0)} mm) não cabe de uma vez na mesa indicada ` +
      `(${p.mesa_x_mm.toFixed(0)} × ${p.mesa_y_mm.toFixed(0)} mm). Ativa a divisão em blocos, reduz a largura ou usa uma impressora com mesa maior.`
    );
  }

  return { tris, geo: p, largura, altura, alturaTotal: alturaCanalTotal, avisos, divisao };
}

export function guiaCaixaLuzNeon(res) {
  const sep = '='.repeat(49);
  const fmt = (v) => Number(v).toFixed(1);
  const L = [sep, '  CAIXA DE LUZ — CANAL DE NEON', sep, ''];
  L.push(`  Forma           : ${fmt(res.largura)} x ${fmt(res.altura)} mm`);
  L.push(`  Canal           : ${fmt(res.geo.largura_canal_mm)} mm largura x ${fmt(res.geo.profundidade_canal_mm)} mm profundidade`);
  L.push(`  Parede/fundo    : ${fmt(res.geo.parede_mm)} mm / ${fmt(res.geo.espessura_fundo_mm)} mm`);
  L.push('', sep, '', '  PECAS:');
  L.push('  1) canal.stl - uma peça só, com o fundo fechado. De pé ou deitada,');
  L.push('     sem suportes (o canal fica sempre aberto por cima).');
  if (res.divisao?.ativo) {
    L.push('', sep, '', '  DIVISAO EM BLOCOS:');
    L.push(`  ${res.divisao.blocos.length} blocos (canal_A1.stl, …) — colunas A, B… da esquerda para a direita,`);
    L.push('  linhas 1, 2… de cima para baixo. Cola-os topo a topo (cianoacrilato) numa superfície plana.');
    for (const b of res.divisao.blocos) L.push(`  ${b.id.padEnd(4)}: ${fmt(b.w)} x ${fmt(b.h)} mm${b.cabe ? '' : '  (NAO CABE NA MESA!)'}`);
  }
  L.push('', sep, '', '  MONTAGEM:');
  L.push('  * Encaixa a fita de neon LED (confirma a largura e a profundidade');
  L.push('    do canal contra a fita real antes de produzir em série) no canal,');
  L.push('    a toda a volta do traço.');
  L.push('  * Fixa com um pouco de cola quente ou silicone de vez em quando,');
  L.push('    para a fita não sair do canal nas curvas mais fechadas.');
  if (res.avisos.length) L.push('', '  AVISOS:', ...res.avisos.map(a => `  ! ${a}`));
  L.push('', '  NOTA: peça nova — confirma o encaixe da fita antes de produzir', '  em série.', '', sep);
  return L.join('\r\n');
}
