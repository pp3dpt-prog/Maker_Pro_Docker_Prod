/**
 * Porta-chaves de imagem a cores (generation_schema.engine = "vetor-cores").
 *
 * Liga as peças: vetorização (vetor.js) → geometria (vetorGeom.js) → ficheiros
 * (ficheiros3d.js). Usado pela rota /vetorizar (pré-visualização) e pelo
 * download-stl (ficheiro final).
 *
 *   Com AMS ............. 1 ficheiro .3mf com as partes montadas (base + cada cor)
 *   Sem AMS + SVG ....... 1 .stl (base + cor escolhida em relevo) + guia de troca de filamento
 *   Sem AMS + PNG/JPG ... .zip com base (com encaixes) + 1 .stl por cor para colar + guia
 */
import { createClient } from '@supabase/supabase-js';
import { vetorizarImagem } from './vetor.js';
import { construirPecas, fatiasParaTriangulos } from './vetorGeom.js';
import { stlBinario, tresMf } from './ficheiros3d.js';

export const ENGINE_VETOR = 'vetor-cores';
const BUCKET = 'makers_pro_stl_prod';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Cache em memória: a vetorização (potrace) é o passo caro; a pré-visualização e
// o download seguinte usam o mesmo resultado.
const cache = new Map();
const CACHE_MAX = 24;

export function opcoesVetor(params = {}) {
  return {
    numCores: Math.max(1, Math.min(6, Math.round(Number(params.num_cores ?? 3)) || 3)),
    removerFundo: !(params.remover_fundo === 0 || params.remover_fundo === false || params.remover_fundo === '0'),
    tolerancia: Math.max(5, Math.min(150, Number(params.tolerancia ?? 40) || 40)),
  };
}

/** Garante que a imagem é do próprio utilizador (uploads/<user_id>/…). */
export function validarCaminhoImagem(imagePath, userId) {
  if (typeof imagePath !== 'string' || !imagePath.startsWith(`uploads/${userId}/`) || imagePath.includes('..') || imagePath.length > 500) {
    throw Object.assign(new Error('Imagem inválida.'), { status: 400 });
  }
}

export async function obterVetor(imagePath, params) {
  const opts = opcoesVetor(params);
  const chave = `${imagePath}|${opts.numCores}|${opts.removerFundo}|${opts.tolerancia}`;
  if (cache.has(chave)) {
    const v = cache.get(chave);
    cache.delete(chave); cache.set(chave, v); // LRU
    return v;
  }
  const { data, error } = await supabase.storage.from(BUCKET).download(imagePath);
  if (error || !data) throw Object.assign(new Error(`Erro ao descarregar a imagem: ${error?.message ?? 'sem dados'}`), { status: 400 });
  const buffer = Buffer.from(await data.arrayBuffer());

  const v = await vetorizarImagem(buffer, opts);
  // Arredonda a 0,1 px: resposta mais leve, sem perda visível.
  const r = (a) => a.map(an => an.map(n => Math.round(n * 10) / 10));
  const leve = { ...v, cores: v.cores.map(c => ({ ...c, aneis: r(c.aneis) })), silhueta: r(v.silhueta) };

  cache.set(chave, leve);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return leve;
}

/** @returns {Promise<{ name: string, buffer: Buffer }[]>} */
export async function gerarFicheirosVetor(imagePath, params, nomeBase = 'porta-chaves') {
  const vetor = await obterVetor(imagePath, params);
  const r = construirPecas(vetor, params);
  const p = r.parametros;
  const guia = [
    'pp3d.pt — Porta-chaves com imagem',
    `Dimensões: ${r.largura.toFixed(1)} × ${r.altura.toFixed(1)} × ${r.alturaTotal.toFixed(1)} mm`,
    '',
    ...r.guia,
    ...(r.avisos.length ? ['', 'Avisos:', ...r.avisos.map(a => `  ! ${a}`)] : []),
    '',
  ].join('\r\n');

  if (p.modo === 'ams') {
    const partes = r.pecas.map(pc => ({ nome: pc.nome, cor: pc.cor, tri: fatiasParaTriangulos(pc.fatias) }));
    return [{ name: `${nomeBase}.3mf`, buffer: await tresMf(partes, nomeBase) }];
  }

  const ficheiros = r.pecas.map(pc => ({
    name: r.pecas.length === 1 ? `${nomeBase}.stl` : `${nomeBase}_${pc.nome.replace(/\s+/g, '_')}${pc.solta ? `_${pc.cor.slice(1)}` : ''}.stl`,
    buffer: stlBinario(fatiasParaTriangulos(pc.fatias), pc.nome),
  }));
  ficheiros.push({ name: 'LEIA-ME_impressao.txt', buffer: Buffer.from(guia, 'utf8') });
  return ficheiros;
}
