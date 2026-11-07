/**
 * Caixa de Luz — logótipo/texto com forma livre (generation_schema.gerador =
 * "caixa-luz-logo"): a silhueta de QUALQUER imagem/SVG vetorizado (logótipo,
 * texto, desenho) desenha a própria caixa — como os letreiros luminosos reais
 * (letras de canal, placas de loja), não um retângulo com a imagem lá dentro.
 * Também pode ter forma fixa (redonda/quadrada/hexagonal) com a arte lá
 * dentro, em vez de seguir o contorno exato.
 *
 * Reaproveita TAL E QUAL o motor já usado no porta-chaves de imagem
 * (vetorGeom.js: construirPecas — separa cores, modo AMS num ficheiro só ou
 * "sem AMS" com uma peça por cor + encaixes na base) para gerar a FRENTE
 * (o "base" de construirPecas, fino, translúcido) + as peças de cor. As
 * peças novas aqui são o CORPO (paredes à volta da silhueta, ocas) e,
 * opcionalmente, a TAMPA (fecha o fundo).
 *
 * Processo: fita de LED colada por dentro das paredes do corpo (à volta,
 * perto do fundo), frente colada no rebordo da frente do corpo, peças de
 * cor coladas por cima da frente, tampa (se pedida) colada no fundo
 * (ver guiaCaixaLuzLogo).
 */
import ClipperLib from 'clipper-lib';
import { construirPecas, fatiasParaTriangulos, limparPequenos } from './vetorGeom.js';

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

function offset(paths, mm) {
  if (!paths.length || Math.abs(mm) < 1e-4) return paths;
  const co = new C.ClipperOffset(2, 0.02 * ESC);
  co.AddPaths(paths, C.JoinType.jtRound, C.EndType.etClosedPolygon);
  const out = new C.Paths();
  co.Execute(out, mm * ESC);
  return out;
}

/** Maior distância de (0,0) a um ponto de paths, em mm — paths já centrados na origem. */
function raioAteOrigem(paths) {
  let r2 = 0;
  for (const q of paths) for (const pt of q) {
    const x = pt.X / ESC, y = pt.Y / ESC;
    const d2 = x * x + y * y;
    if (d2 > r2) r2 = d2;
  }
  return Math.sqrt(r2);
}

/** Polígono regular centrado na origem, raio = distância ao CENTRO DOS LADOS (apótema). */
function poligonoRegularPorApotema(apotema, lados, rotacaoGraus = 0) {
  const r = apotema / Math.cos(Math.PI / lados);
  const pts = [];
  for (let i = 0; i < lados; i++) {
    const a = (rotacaoGraus * Math.PI) / 180 + (i / lados) * 2 * Math.PI;
    pts.push({ X: Math.round(r * Math.cos(a) * ESC), Y: Math.round(r * Math.sin(a) * ESC) });
  }
  return [pts];
}

export const FORMAS_CAIXA = ['imagem', 'redonda', 'quadrada', 'hexagonal'];

/**
 * Fronteira da frente/corpo: a silhueta (base2d, já com a moldura) ou uma
 * forma fixa que a envolve por completo (toca no ponto da arte mais longe
 * do centro — por isso nunca corta a arte, só pode sobrar mais moldura nos
 * outros lados consoante a forma do desenho).
 */
export function fronteiraCaixa(tipo, base2d) {
  if (!FORMAS_CAIXA.includes(tipo) || tipo === 'imagem') return base2d;
  const apotema = raioAteOrigem(base2d);
  if (tipo === 'redonda') return poligonoRegularPorApotema(apotema, 96);
  if (tipo === 'hexagonal') return poligonoRegularPorApotema(apotema, 6, 30);
  return poligonoRegularPorApotema(apotema, 4, 45); // quadrada
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
    temTampa: p?.tem_tampa === true || p?.tem_tampa === 1 || p?.tem_tampa === '1',
    espessuraTampaMm: num(p?.espessura_tampa_mm, 2, 1.2, 4),
  };
}

/**
 * Paredes ocas à volta de `fronteira`. Abertas nos dois topos (z=0 e
 * z=profundidade): a frente cola-se no rebordo de cima; sem tampa, a fita
 * de LED e o cabo entram livremente pelo fundo aberto — não precisa de
 * furo dedicado (ao contrário de uma base fechada, isto é só um aro: não
 * há parede nenhuma a bloquear o fundo). Um furo lateral fixo seria frágil
 * em formas com pontas finas (ex. uma estrela) — o fundo aberto resolve
 * para qualquer silhueta.
 */
export function corpoFatias(fronteira, geo) {
  const inner = offset(fronteira, -geo.paredeMm);
  const anel = diferenca(fronteira, inner);
  if (!anel.length) throw Object.assign(new Error('A forma ficou vazia depois de abrir a parede — reduz a espessura da parede ou aumenta a moldura.'), { status: 400 });
  return [{ z0: 0, z1: geo.profundidadeMm, regiao: anel }];
}

/**
 * Tampa opcional: painel liso igual à frente, fecha o fundo do corpo. Com
 * furo para o cabo da fita de LED SÓ se o centro da forma (0,0) estiver
 * mesmo dentro dela — em formas muito finas/vazadas ao centro, sai sem
 * furo (o cabo passa pela folga entre a tampa e a parede).
 */
export function tampaFatias(fronteira, geo) {
  const furoD = 8;
  const centroDentro = fronteira.some(poly => C.Clipper.PointInPolygon({ X: 0, Y: 0 }, poly) !== 0);
  let regiao = fronteira;
  if (centroDentro) {
    const seg = 32, pts = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * 2 * Math.PI;
      pts.push({ X: Math.round((furoD / 2) * Math.cos(a) * ESC), Y: Math.round((furoD / 2) * Math.sin(a) * ESC) });
    }
    regiao = diferenca(fronteira, [pts]);
  }
  return [{ z0: 0, z1: geo.espessuraTampaMm, regiao }];
}

export const GERADOR_CAIXA_LUZ_LOGO = 'caixa-luz-logo';

/**
 * Entrada única: devolve a frente+cores (igual ao porta-chaves de imagem,
 * ver construirPecas) + o corpo (+ tampa opcional), todos a encaixar na
 * mesma fronteira (a silhueta da arte, ou uma forma fixa à escolha).
 */
export function construirCaixaLuzLogo(vetor, params) {
  const r = construirPecas(vetor, params);
  if (!r.base2d) throw new Error('vetorGeom.js desatualizado — falta base2d em construirPecas (atualiza os dois repositórios).');
  const geo = corpoGeometria(params);
  const formaTipo = FORMAS_CAIXA.includes(params?.forma_caixa) ? params.forma_caixa : 'imagem';
  const fronteira = fronteiraCaixa(formaTipo, r.base2d);

  if (fronteira !== r.base2d) {
    // Forma fixa: a frente passa a preencher essa forma (maior que a arte),
    // preservando os encaixes das peças de cor quando é "peças para colar".
    const p = r.parametros;
    const cores = r.pecas.slice(1);
    if (p.modo !== 'ams' && p.metodo === 'pecas') {
      const f2 = p.folga / 2;
      // Com forma fixa, estes encaixes ficam espalhados num círculo/quadrado
      // bem maior que a arte: cada mancha de cor isolada vira um buraco
      // separado na frente (centenas delas, em imagens com ruído), e
      // triangular um polígono com milhares de buracos é extremamente lento
      // (earcut escala mal com o nº de buracos). limparPequenos usa o mesmo
      // limiar (detalhe_min) já aplicado às manchas de cor noutro sítio.
      const encaixes = limparPequenos(uniao(cores.flatMap(pc => offset(pc.fatias[0]?.regiao ?? [], f2))), Math.max(p.detalhe_min, 0.01));
      r.pecas[0] = { ...r.pecas[0], fatias: [
        { z0: 0, z1: p.espessura_base - p.encaixe, regiao: fronteira },
        { z0: p.espessura_base - p.encaixe, z1: p.espessura_base, regiao: diferenca(fronteira, encaixes) },
      ] };
    } else {
      // ams/relevo e sem_ams/pausas: a 1.ª fatia da frente é sempre um
      // preenchimento liso — troca só essa. (ams/liso fica por afinar: a
      // 2.ª fatia recorta as cores da silhueta antiga, não da forma nova.)
      r.pecas[0] = { ...r.pecas[0], fatias: r.pecas[0].fatias.map((f, i) => (i === 0 ? { ...f, regiao: fronteira } : f)) };
    }
    const { minX, minY, maxX, maxY } = (() => {
      let a = Infinity, b = Infinity, cc = -Infinity, d = -Infinity;
      for (const q of fronteira) for (const pt of q) { if (pt.X < a) a = pt.X; if (pt.X > cc) cc = pt.X; if (pt.Y < b) b = pt.Y; if (pt.Y > d) d = pt.Y; }
      return { minX: a / ESC, minY: b / ESC, maxX: cc / ESC, maxY: d / ESC };
    })();
    r.largura = maxX - minX;
    r.altura = maxY - minY;
  }

  const corpoTris = fatiasParaTriangulos(corpoFatias(fronteira, geo));
  const tampaTris = geo.temTampa ? fatiasParaTriangulos(tampaFatias(fronteira, geo)) : null;

  // Ainda sem divisão automática pela mesa — só avisa se a peça não couber de uma vez.
  if (r.largura > geo.mesaXMm || r.altura > geo.mesaYMm) {
    r.avisos.push(
      `A peça (${r.largura.toFixed(0)} × ${r.altura.toFixed(0)} mm) não cabe de uma vez na mesa indicada ` +
      `(${geo.mesaXMm.toFixed(0)} × ${geo.mesaYMm.toFixed(0)} mm). Reduz a largura ou usa uma impressora com mesa maior ` +
      `— a divisão automática em blocos ainda não está disponível.`
    );
  }
  return { r, geo, corpoTris, tampaTris, formaTipo };
}

export function guiaCaixaLuzLogo(r, geo, formaTipo) {
  const sep = '='.repeat(49);
  const fmt = (v) => Number(v).toFixed(1);
  const nomesForma = { imagem: 'à volta do desenho', redonda: 'redonda', quadrada: 'quadrada', hexagonal: 'hexagonal' };
  const L = [sep, '  CAIXA DE LUZ — LOGOTIPO/TEXTO', sep, ''];
  L.push(`  Forma           : ${fmt(r.largura)} x ${fmt(r.altura)} mm (${nomesForma[formaTipo] ?? formaTipo})`);
  L.push(`  Caixa           : parede ${fmt(geo.paredeMm)} mm, profundidade ${fmt(geo.profundidadeMm)} mm`);
  L.push('', sep, '', '  PECAS:');
  L.push('  1) corpo.stl    - paredes ocas. Qualquer cor, de pe, sem suportes.');
  if (geo.temTampa) {
    L.push('  2) tampa.stl    - fecha o fundo. Mesma cor do corpo.');
    L.push('  3) frente.stl (ou corpo_frente dentro do 3MF em modo AMS) - painel');
  } else {
    L.push('     Fica aberto no fundo — a fita de LED e o cabo entram por ali.');
    L.push('  2) frente.stl (ou corpo_frente dentro do 3MF em modo AMS) - painel');
  }
  L.push('     fino translucido. PLA BRANCO ou "natural" — e por onde a luz passa.');
  if (r.parametros.modo === 'ams') {
    L.push('  • cores (no mesmo 3MF da frente) - atribui um filamento do AMS a');
    L.push('     cada parte.');
  } else if (r.parametros.metodo === 'pecas') {
    L.push('  • cor_N.stl - uma peca por cor, com encaixe na frente. Cola com');
    L.push('     cola de contacto ou cianoacrilato depois de montar a caixa.');
  } else {
    L.push('  • a frente sai com os niveis de cor ja incluidos (trocas de');
    L.push('     filamento por altura — ver guia abaixo).');
  }
  L.push(...r.guia.map(g => '  ' + g));
  L.push('', sep, '', '  MONTAGEM:');
  if (geo.temTampa) {
    L.push('  * Cola a fita de LED por dentro das paredes do corpo, à volta.');
    L.push('  * Cola a tampa no fundo (passa o cabo pela folga antes de colar,');
    L.push('    ou pelo furo no meio da tampa, se tiver saído com um).');
  } else {
    L.push('  * Cola a fita de LED por dentro das paredes do corpo, à volta,');
    L.push('    perto do fundo aberto — fita virada para dentro/para a frente.');
  }
  L.push('  * Cola a frente (painel fino) no rebordo de cima do corpo.');
  L.push('  * Cola as peças de cor por cima da frente, nos encaixes.');
  if (r.avisos.length) L.push('', '  AVISOS:', ...r.avisos.map(a => `  ! ${a}`));
  L.push('', '  NOTA: peca nova — confirma o encaixe frente/corpo e a difusão da', '  luz antes de produzir em serie.', '', sep);
  return L.join('\r\n');
}
