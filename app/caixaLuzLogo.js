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
import { planoDivisao, fatiasNoBloco, zonasComEncaixes, fatiasNaZona, paredesComDentes, comEncaixes, volumeFatias, VOLUME_MIN } from './divisaoBlocos.js';

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

function circuloEm(cx, cy, r, seg = 32) {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * 2 * Math.PI;
    pts.push({ X: Math.round((cx + r * Math.cos(a)) * ESC), Y: Math.round((cy + r * Math.sin(a)) * ESC) });
  }
  return [pts];
}

/** Ponto de `paths` que maximiza scoreFn(x,y) — usado para escolher onde fica o furo do cabo. */
function pontoExtremo(paths, scoreFn) {
  let melhor = null, melhorScore = -Infinity;
  for (const anel of paths) for (const pt of anel) {
    const x = pt.X / ESC, y = pt.Y / ESC;
    const sc = scoreFn(x, y);
    if (sc > melhorScore) { melhorScore = sc; melhor = { x, y }; }
  }
  return melhor;
}

/** Maior anel de `paths` por área — o contorno exterior principal, ignorando buracos pequenos (ex. letras com furos). */
function anelMaior(paths) {
  let melhor = null, melhorArea = -Infinity;
  for (const anel of paths) {
    const a = Math.abs(C.Clipper.Area(anel));
    if (a > melhorArea) { melhorArea = a; melhor = anel; }
  }
  return melhor ? [melhor] : paths;
}

/** Recorta `corte` da região de cada fatia cujo intervalo [z0,z1] sobreponha [zA,zB], dividindo-a em três se necessário. */
function aplicarFuroEmFatias(fatias, corte, zA, zB) {
  const out = [];
  for (const f of fatias) {
    const a = Math.max(f.z0, zA), b = Math.min(f.z1, zB);
    if (a >= b) { out.push(f); continue; }
    if (a > f.z0) out.push({ z0: f.z0, z1: a, regiao: f.regiao });
    out.push({ z0: a, z1: b, regiao: diferenca(f.regiao, corte) });
    if (b < f.z1) out.push({ z0: b, z1: f.z1, regiao: f.regiao });
  }
  return out;
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
    montagem: p?.montagem === 'parede' ? 'parede' : 'pe',
  };
}

// Encaixe da frente e da tampa: rebaixo (como numa moldura de quadro). Em cada ponta aberta do
// corpo a parede fica só com um aro exterior fino (ARO mm) e a frente/tampa entra lá dentro e
// assenta no degrau que sobra da parede. A frente/tampa têm o contorno recuado ARO + FOLGA.
export const ARO_MM = 1.2;          // espessura do aro à volta da frente/tampa
export const FOLGA_ENCAIXE = 0.2;   // folga por lado (encaixe justo; cola opcional)
export const aroDe = (paredeMm) => Math.min(ARO_MM, paredeMm - 0.8);   // deixa ≥ 0.8 mm de degrau

/**
 * Paredes ocas à volta de `fronteira`, abertas nos dois topos. Em cima há um rebaixo com a
 * espessura da frente (geo.espFrenteMm) e, se houver tampa, em baixo outro com a espessura da
 * tampa: nessas alturas a parede é só o aro exterior, e a frente/tampa (contorno recuado
 * aro + folga) encaixa lá dentro, centrada, e assenta no degrau. A frente fica à face do aro.
 *
 * Sem tampa, a fita de LED e o cabo entram livremente pelo fundo aberto.
 * Com `montagem: 'parede'`, abre-se também um furo lateral na parede
 * (a meia altura, no ponto mais afastado do centro) para o cabo sair de
 * lado — encostada à parede real, o fundo fica tapado e um furo aí ficava
 * bloqueado.
 */
export function corpoFatias(fronteira, geo) {
  const inner = offset(fronteira, -geo.paredeMm);
  const anel = diferenca(fronteira, inner);
  if (!anel.length) throw Object.assign(new Error('A forma ficou vazia depois de abrir a parede — reduz a espessura da parede ou aumenta a moldura.'), { status: 400 });

  const h = geo.profundidadeMm;
  const aro = diferenca(fronteira, offset(fronteira, -aroDe(geo.paredeMm)));
  const recCima = geo.espFrenteMm || 0;
  const recBaixo = geo.temTampa ? geo.espessuraTampaMm : 0;
  let fatias;
  if (aro.length && h > recCima + recBaixo + 4) {
    fatias = [];
    if (recBaixo > 0) fatias.push({ z0: 0, z1: recBaixo, regiao: aro });
    fatias.push({ z0: recBaixo, z1: h - recCima, regiao: anel });
    if (recCima > 0) fatias.push({ z0: h - recCima, z1: h, regiao: aro });
  } else {
    fatias = [{ z0: 0, z1: h, regiao: anel }];
  }

  if (geo.montagem === 'parede') {
    const ladoPt = pontoExtremo(anelMaior(fronteira), (x, y) => Math.abs(x));
    const furoD = Math.max(4, Math.min(8, h * 0.35));
    if (ladoPt) {
      const zCentro = h / 2;
      fatias = aplicarFuroEmFatias(fatias, circuloEm(ladoPt.x, ladoPt.y, furoD / 2), zCentro - furoD / 2, zCentro + furoD / 2);
    }
  }
  return fatias;
}

/** Contorno da frente/tampa que encaixa no rebaixo do corpo. */
export function contornoEncaixe(fronteira, geo) {
  return offset(fronteira, -(aroDe(geo.paredeMm) + FOLGA_ENCAIXE));
}

/**
 * Tampa opcional: painel liso igual à frente, fecha o fundo do corpo.
 * Com `montagem: 'parede'` sai sólida (sem furo) — o cabo sai pelo furo
 * lateral do corpo, porque o fundo fica encostado à parede real. De pé
 * (`montagem: 'pe'`, por defeito) sai com um furo perto da base — nunca
 * no meio da peça — para o cabo descer até à mesa onde assenta, discreto.
 * Em formas muito finas onde não há espaço com margem segura para o
 * furo, sai sem ele (o cabo passa pela folga entre a tampa e a parede).
 */
export function tampaFatias(fronteira, geo) {
  const furoD = 8;
  fronteira = contornoEncaixe(fronteira, geo);   // entra no rebaixo de baixo do corpo
  let regiao = fronteira;
  if (geo.montagem === 'pe') {
    const zonaSegura = offset(fronteira, -(furoD / 2 + 3));
    const pt = pontoExtremo(zonaSegura, (x, y) => -y); // -y maior = y menor = mais perto da base
    if (pt) regiao = diferenca(fronteira, circuloEm(pt.x, pt.y, furoD / 2));
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

  // Frente e peças de cor recortadas pelo contorno do encaixe (entram no rebaixo de cima do
  // corpo, à face do aro). A frente propriamente dita é a 1.ª peça; as cores ficam por cima.
  geo.espFrenteMm = r.parametros.espessura_base;
  geo.zFrente = geo.profundidadeMm - geo.espFrenteMm;   // onde assenta a frente (pré-visualização)
  const encaixe = contornoEncaixe(fronteira, geo);
  if (!encaixe.length) throw Object.assign(new Error('A forma é demasiado fina para o encaixe da frente — aumenta a largura ou o contorno.'), { status: 400 });
  r.pecas = r.pecas.map(pc => ({ ...pc, fatias: pc.fatias
    .map(f => ({ ...f, regiao: executar(C.ClipType.ctIntersection, f.regiao, encaixe) }))
    .filter(f => f.regiao.length) }));
  if (formaTipo === 'imagem' && Number(r.parametros.contorno) < aroDe(geo.paredeMm) + FOLGA_ENCAIXE + 0.5) {
    r.avisos.push(`O contorno (${Number(r.parametros.contorno).toFixed(1)} mm) é estreito para o encaixe da frente: o desenho junto à borda fica escondido pelo aro do corpo. Aumenta o contorno para ${(aroDe(geo.paredeMm) + FOLGA_ENCAIXE + 0.5).toFixed(1)} mm ou mais.`);
  }

  const corpoF = corpoFatias(fronteira, geo);
  const tampaF = geo.temTampa ? tampaFatias(fronteira, geo) : null;
  const corpoTris = fatiasParaTriangulos(corpoF);
  const tampaTris = tampaF ? fatiasParaTriangulos(tampaF) : null;

  // Peça maior do que a mesa: divisão em blocos (app/divisaoBlocos.js) — cortes sugeridos ou os
  // do cliente (params.cortes_x / cortes_y), aplicados a TODAS as peças (corpo, tampa, frente, cores).
  const divisao = planoDivisao({
    fronteira,
    cores: r.pecas.slice(1).map(pc => pc.fatias[0]?.regiao ?? []),
    mesaX: geo.mesaXMm, mesaY: geo.mesaYMm, params,
  });
  if (divisao?.ativo) {
    // Encaixes nas juntas (por omissão): rabos de andorinha na frente e na tampa, dentes a 45° nas
    // paredes do corpo — sem peças de reforço por trás, que fariam sombra na frente.
    const enc = comEncaixes(params);
    divisao.encaixes = enc;
    const zFrente = enc ? zonasComEncaixes(r.pecas[0]?.fatias[0]?.regiao ?? encaixe, divisao) : null;
    const zTampa = enc && tampaF ? zonasComEncaixes(tampaF[0].regiao, divisao) : null;
    const corpoDentes = enc ? paredesComDentes(corpoF, divisao) : null;
    divisao.blocos = divisao.blocos.map(b => {
      const lasca = (fs) => (volumeFatias(fs) < VOLUME_MIN ? [] : fs);
      const corpoB = lasca(enc ? corpoDentes.get(b.id) : fatiasNoBloco(corpoF, b));
      const tampaB = !tampaF ? [] : lasca(enc ? fatiasNaZona(tampaF, zTampa.get(b.id)) : fatiasNoBloco(tampaF, b));
      return {
        ...b,
        corpoTris: corpoB.length ? fatiasParaTriangulos(corpoB) : null,
        tampaTris: tampaB.length ? fatiasParaTriangulos(tampaB) : null,
        pecas: r.pecas.map(pc => ({ ...pc, fatias: enc ? fatiasNaZona(pc.fatias, zFrente.get(b.id)) : fatiasNoBloco(pc.fatias, b) }))
          .filter(pc => pc.fatias.length && volumeFatias(pc.fatias) >= 1),
      };
    }).filter(b => b.corpoTris || b.tampaTris || b.pecas.length);
    const grandes = divisao.blocos.filter(b => !b.cabe);
    r.avisos.push(`Dividida em ${divisao.blocos.length} blocos (${divisao.blocos.map(b => b.id).join(', ')}) para caber na mesa de ${geo.mesaXMm.toFixed(0)} × ${geo.mesaYMm.toFixed(0)} mm.`);
    if (grandes.length) {
      r.avisos.push(`Os blocos ${grandes.map(b => `${b.id} (${b.w.toFixed(0)} × ${b.h.toFixed(0)} mm)`).join(', ')} não cabem na mesa — ajusta os cortes ou repõe a sugestão.`);
    }
  } else if (divisao && !divisao.cabeInteira) {
    r.avisos.push(
      `A peça (${r.largura.toFixed(0)} × ${r.altura.toFixed(0)} mm) não cabe de uma vez na mesa indicada ` +
      `(${geo.mesaXMm.toFixed(0)} × ${geo.mesaYMm.toFixed(0)} mm). Ativa a divisão em blocos, reduz a largura ou usa uma impressora com mesa maior.`
    );
  }
  return { r, geo, corpoTris, tampaTris, formaTipo, divisao };
}

export function guiaCaixaLuzLogo(r, geo, formaTipo, divisao = null) {
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
  L.push(`  Fixação         : ${geo.montagem === 'parede' ? 'parede (furo lateral no corpo)' : 'de pé (furo na tampa, perto da base)'}`);
  if (geo.montagem === 'parede') {
    L.push('  * O cabo sai por um furo lateral no corpo (a meia altura) — o');
    L.push('    fundo fica encostado à parede, por isso não tem furo nenhum.');
  } else if (geo.temTampa) {
    L.push('  * Cola a fita de LED por dentro das paredes do corpo, à volta.');
    L.push('  * O cabo sai pelo furo na tampa (perto da base, não no meio) —');
    L.push('    ou pela folga entre a tampa e a parede, se a forma não deu');
    L.push('    espaço para o furo.');
  } else {
    L.push('  * Cola a fita de LED por dentro das paredes do corpo, à volta,');
    L.push('    perto do fundo aberto — fita virada para dentro/para a frente.');
  }
  if (geo.temTampa) L.push('  * Encaixa a tampa no rebaixo do fundo do corpo (entra justa; um ponto de cola chega).');
  L.push('  * Encaixa a frente (painel fino) no rebaixo de cima do corpo: fica a face do aro.');
  L.push(`    Folga do encaixe: ${fmt(FOLGA_ENCAIXE)} mm por lado. Se entrar apertada, lixa a borda;`);
  L.push('    se ficar solta, um ponto de cola no degrau.');
  L.push('  * Cola as peças de cor por cima da frente, nos encaixes.');
  if (divisao?.ativo) {
    L.push('', sep, '', '  DIVISAO EM BLOCOS:');
    L.push(`  ${divisao.blocos.length} blocos — colunas A, B, C… da esquerda para a direita, linhas 1, 2… de`);
    L.push('  cima para baixo (visto de frente). Cada ficheiro tem o nome do bloco (ex.: corpo_A1.stl).');
    for (const b of divisao.blocos) L.push(`  ${b.id.padEnd(4)}: ${fmt(b.w)} x ${fmt(b.h)} mm${b.cabe ? '' : '  (NAO CABE NA MESA!)'}`);
    L.push('  * Imprime todos os blocos de cada peça com o mesmo filamento e as mesmas definições.');
    if (divisao.encaixes) {
      L.push('  * As juntas encaixam: o corpo tem dentes em ziguezague na altura (encaixa-os');
      L.push('    de cima para baixo) e a frente e a tampa têm rabos de andorinha (desliza a');
      L.push('    patilha no entalhe do bloco ao lado). Folga 0,15 mm: se ficar apertado, lixa.');
      L.push('  * Cola os blocos do corpo nos dentes (cianoacrilato), numa superfície plana;');
      L.push('    depois os da frente (um ponto de cola nas patilhas), dentro do rebaixo, e as cores.');
    } else {
      L.push('  * Cola primeiro os blocos do corpo uns aos outros (cianoacrilato ou cola de contacto),');
      L.push('    numa superfície plana; depois os da frente, dentro do rebaixo, e por fim as cores.');
    }
  }
  if (r.avisos.length) L.push('', '  AVISOS:', ...r.avisos.map(a => `  ! ${a}`));
  L.push('', '  NOTA: peca nova — confirma o encaixe frente/corpo e a difusão da', '  luz antes de produzir em serie.', '', sep);
  return L.join('\r\n');
}
