/**
 * Caixa de Luz — logótipo/texto com forma livre (generation_schema.gerador =
 * "caixa-luz-logo"): a silhueta de QUALQUER imagem/SVG vetorizado (logótipo,
 * texto, desenho) desenha a própria caixa — como os letreiros luminosos reais
 * (letras de canal, placas de loja), não um retângulo com a imagem lá dentro.
 *
 * Reaproveita TAL E QUAL o motor já usado no porta-chaves de imagem
 * (vetorGeom.js: construirPecas — separa cores, modo AMS num ficheiro só ou
 * "sem AMS" com uma peça por cor + encaixes na base) para gerar a FRENTE
 * (o "base" de construirPecas, fino, translúcido) + as peças de cor. A única
 * peça nova aqui é o CORPO: paredes à volta da mesma silhueta (base2d, agora
 * devolvido por construirPecas), ocas, abertas atrás para a fita de LED —
 * em vez da frente ficar deitada numa secretária, cola-se por cima do corpo
 * e a luz da fita (colada por dentro das paredes) atravessa-a.
 *
 * Processo: fita de LED colada por dentro das paredes do corpo (à volta,
 * perto do fundo aberto), frente colada no rebordo da frente do corpo,
 * peças de cor coladas por cima da frente (ver guiaCaixaLuzLogo).
 */
import ClipperLib from 'clipper-lib';
import { construirPecas, fatiasParaTriangulos } from './vetorGeom.js';

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
const diferenca = (a, b) => (b.length ? executar(C.ClipType.ctDifference, a, b) : a);

function offset(paths, mm) {
  if (!paths.length || Math.abs(mm) < 1e-4) return paths;
  const co = new C.ClipperOffset(2, 0.02 * ESC);
  co.AddPaths(paths, C.JoinType.jtRound, C.EndType.etClosedPolygon);
  const out = new C.Paths();
  co.Execute(out, mm * ESC);
  return out;
}

const num = (v, def, min, max) => {
  const n = Number(v);
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : def));
};

export function corpoGeometria(p) {
  return {
    paredeMm: num(p?.parede_caixa_mm, 2.4, 1.6, 4),
    profundidadeMm: num(p?.profundidade_mm, 25, 15, 60),
    mesaXMm: num(p?.mesa_x_mm, 256, 100, 1000),
    mesaYMm: num(p?.mesa_y_mm, 256, 100, 1000),
  };
}

/**
 * Paredes ocas à volta de base2d (o contorno da frente, devolvido por
 * construirPecas — MESMA silhueta, por isso encaixam sem folga). Abertas
 * nos dois topos (z=0 e z=profundidade): a frente cola-se no rebordo de
 * cima; a fita de LED e o cabo entram livremente pelo fundo aberto — não
 * precisa de furo dedicado (ao contrário de uma base fechada, isto é só um
 * aro: não há parede nenhuma a bloquear o fundo). Um furo lateral fixo
 * seria frágil em formas com pontas finas (ex. uma estrela) — o fundo
 * aberto resolve para qualquer silhueta.
 */
export function corpoFatias(base2d, geo) {
  const inner = offset(base2d, -geo.paredeMm);
  const anel = diferenca(base2d, inner);
  if (!anel.length) throw Object.assign(new Error('A forma ficou vazia depois de abrir a parede — reduz a espessura da parede ou aumenta a moldura.'), { status: 400 });
  return [{ z0: 0, z1: geo.profundidadeMm, regiao: anel }];
}

export const GERADOR_CAIXA_LUZ_LOGO = 'caixa-luz-logo';

/**
 * Entrada única: devolve a frente+cores (igual ao porta-chaves de imagem,
 * ver construirPecas) + o corpo novo, todos a encaixar na mesma silhueta.
 */
export function construirCaixaLuzLogo(vetor, params) {
  const r = construirPecas(vetor, params);
  if (!r.base2d) throw new Error('vetorGeom.js desatualizado — falta base2d em construirPecas (atualiza os dois repositórios).');
  const geo = corpoGeometria(params);
  const corpoTris = fatiasParaTriangulos(corpoFatias(r.base2d, geo));
  // Ainda sem divisão automática pela mesa — só avisa se a peça (corpo ou
  // frente, mesma silhueta) não couber de uma vez.
  if (r.largura > geo.mesaXMm || r.altura > geo.mesaYMm) {
    r.avisos.push(
      `A peça (${r.largura.toFixed(0)} × ${r.altura.toFixed(0)} mm) não cabe de uma vez na mesa indicada ` +
      `(${geo.mesaXMm.toFixed(0)} × ${geo.mesaYMm.toFixed(0)} mm). Reduz a largura ou usa uma impressora com mesa maior ` +
      `— a divisão automática em blocos ainda não está disponível.`
    );
  }
  return { r, geo, corpoTris };
}

export function guiaCaixaLuzLogo(r, geo) {
  const sep = '='.repeat(49);
  const fmt = (v) => Number(v).toFixed(1);
  const L = [sep, '  CAIXA DE LUZ — LOGOTIPO/TEXTO', sep, ''];
  L.push(`  Forma           : ${fmt(r.largura)} x ${fmt(r.altura)} mm`);
  L.push(`  Caixa           : parede ${fmt(geo.paredeMm)} mm, profundidade ${fmt(geo.profundidadeMm)} mm`);
  L.push('', sep, '', '  PECAS:');
  L.push('  1) corpo.stl    - paredes ocas, abertas dos dois lados. Qualquer cor,');
  L.push('     de pe (parede fina ao baixo), sem suportes.');
  L.push('  2) frente.stl (ou corpo_frente dentro do 3MF em modo AMS) - painel');
  L.push('     fino translucido. PLA BRANCO ou "natural" — e por onde a luz passa.');
  if (r.parametros.modo === 'ams') {
    L.push('  3) cores (no mesmo 3MF da frente) - atribui um filamento do AMS a');
    L.push('     cada parte.');
  } else if (r.parametros.metodo === 'pecas') {
    L.push('  3) cor_N.stl - uma peca por cor, com encaixe na frente. Cola com');
    L.push('     cola de contacto ou cianoacrilato depois de montar a caixa.');
  } else {
    L.push('  3) a frente sai com os niveis de cor ja incluidos (trocas de');
    L.push('     filamento por altura — ver guia abaixo).');
  }
  L.push(...r.guia.map(g => '  ' + g));
  L.push('', sep, '', '  MONTAGEM:');
  L.push('  * Cola a fita de LED por dentro das paredes do corpo, à volta,');
  L.push('    perto do fundo aberto (o lado sem rebordo) — fita virada para');
  L.push('    dentro/para a frente.');
  L.push('  * Cola a frente (painel fino) no rebordo de cima do corpo.');
  L.push('  * Cola as peças de cor por cima da frente, nos encaixes.');
  if (r.avisos.length) L.push('', '  AVISOS:', ...r.avisos.map(a => `  ! ${a}`));
  L.push('', '  NOTA: peca nova — confirma o encaixe frente/corpo e a difusão da', '  luz antes de produzir em serie.', '', sep);
  return L.join('\r\n');
}
