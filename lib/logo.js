// Logótipo carregado pelo cliente → silhueta em mm para o OpenSCAD.
//
// Reaproveita o vetorizador do porta-chaves de imagem (app/vetorPortachaves.js: remove o
// fundo, traça os contornos) e converte a silhueta (anéis em píxeis, Y para baixo) num
// polígono OpenSCAD centrado na origem, com a largura pedida:
//   logo_pts   = [[x, y], …]           pontos (mm)
//   logo_paths = [[0, 1, 2, …], …]     um caminho por anel (exteriores e buracos; even-odd)
//   tem_logo   = true | false
//
// Só corre para designs com a marca
//   "logo": { "param": "logo", "largura_param": "logo_largura", "so_ams": true }
// ou, para várias imagens, uma lista com um prefixo por imagem (as variáveis passam a ser
// <prefixo>_pts / <prefixo>_paths / tem_<prefixo>; sem prefixo é "logo"):
//   "logo": [ { "param": "imagem_rampa", "largura_param": "largura_imagem_rampa", "prefixo": "rampa" }, … ]
// "so_quando": { "<param>": "<valor>" } (opcional) só vectoriza quando o parâmetro tem esse valor;
// "simplificar_mm" (omissão 0,05) e "max_pontos" (omissão 12000) aliviam o CGAL em peças com rebaixos.
// Imagem com as cores próprias (opcional): "cores_param": "cores_imagem_rampa" (select; com o valor
// "Cores da imagem") e "num_cores_param": "num_cores_rampa" (2–6). Aí vectoriza com n cores e
// acrescenta, por cor i = 1..6, <prefixo>_c<i>_pts / _c<i>_paths / _c<i>_hex (vazias quando não há)
// — regiões sem sobreposições (lib/imagemCores.js, igual no frontend); <prefixo>_pts passa a ser a
// união das cores (o rebaixo).
// O parâmetro NÃO se chama image_path de propósito: esse nome activa o processamento de
// imagem do HueForge/litofania em download.js.
import ClipperLib from 'clipper-lib';
import { obterVetor } from '../app/vetorPortachaves.js';
import { regioesCores } from './imagemCores.js';

export const MAX_CORES_IMAGEM = 6;
export const VALOR_CORES_IMAGEM = 'Cores da imagem';

const ESC = 1000;              // µm (Clipper trabalha com inteiros)
const MAX_PONTOS = 12000;      // limite de pontos injectados no SCAD

const semAms = (params) => /^sem/i.test(String(params?.impressao ?? '').trim());

export function caminhoLogoValido(p, userId) {
  if (typeof p !== 'string' || p.length > 500 || p.includes('..')) return false;
  return userId ? p.startsWith(`uploads/${userId}/`) : /^uploads\/[\w-]+\/[\w.-]+$/.test(p);
}

/**
 * Acrescenta logo_pts / logo_paths / tem_logo a `params` (altera e devolve o objecto).
 * userId: na transferência, o caminho tem de ser do próprio utilizador; na pré-visualização
 * (sem sessão no backend) só se valida o formato.
 */
export async function aplicarLogo(generationSchema, params, userId = null, obter = obterVetor) {
  const cfg = generationSchema?.logo;
  if (!cfg || !params) return params;
  for (const c of Array.isArray(cfg) ? cfg : [cfg]) await aplicarUmLogo(c, params, userId, obter);
  return params;
}

async function aplicarUmLogo(cfg, params, userId, obter) {
  const pre = /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(cfg.prefixo || '')) ? cfg.prefixo : 'logo';
  const caminho = params[cfg.param || 'logo'];
  params[`tem_${pre}`] = false;
  params[`${pre}_pts`] = [];
  params[`${pre}_paths`] = [];
  if (cfg.cores_param) {
    for (let i = 1; i <= MAX_CORES_IMAGEM; i++) {
      params[`${pre}_c${i}_pts`] = [];
      params[`${pre}_c${i}_paths`] = [];
      params[`${pre}_c${i}_hex`] = '';
    }
  }
  if (!caminho || (cfg.so_ams && semAms(params))) return params;
  if (cfg.so_quando && Object.entries(cfg.so_quando).some(([k, v]) => String(params[k] ?? '') !== String(v))) return params;
  if (!caminhoLogoValido(caminho, userId)) {
    throw Object.assign(new Error('Imagem do logótipo inválida.'), { status: 400 });
  }

  const largura = Math.max(5, Math.min(200, Number(params[cfg.largura_param || 'logo_largura']) || 40));
  const simpl = (Number(cfg.simplificar_mm) > 0 ? Number(cfg.simplificar_mm) : 0.05) * ESC;
  const maxPts = Number(cfg.max_pontos) > 0 ? Math.min(MAX_PONTOS, Number(cfg.max_pontos)) : MAX_PONTOS;

  if (cfg.cores_param && String(params[cfg.cores_param] ?? '') === VALOR_CORES_IMAGEM) {
    const n = Math.max(2, Math.min(MAX_CORES_IMAGEM, Math.round(Number(params[cfg.num_cores_param]) || 3)));
    const vetor = await obter(caminho, { num_cores: n, remover_fundo: params.logo_remover_fundo ?? 1, tolerancia: 40, buracos_fundo: 1 });
    const r = regioesCores(vetor, largura);
    const u = paraScad(r.uniao, simpl, maxPts);
    if (u.pts.length >= 3) {
      params[`tem_${pre}`] = true;
      params[`${pre}_pts`] = u.pts;
      params[`${pre}_paths`] = u.idx;
    }
    r.cores.slice(0, MAX_CORES_IMAGEM).forEach((c, i) => {
      const e = paraScad(c.regiao, simpl, maxPts);
      params[`${pre}_c${i + 1}_pts`] = e.pts;
      params[`${pre}_c${i + 1}_paths`] = e.idx;
      params[`${pre}_c${i + 1}_hex`] = c.hex;
    });
    return params;
  }

  // buracos_fundo: as zonas brancas dentro do desenho (o miolo de um O, p.ex.) ficam abertas
  const vetor = await obter(caminho, { num_cores: 1, remover_fundo: params.logo_remover_fundo ?? 1, tolerancia: 40, buracos_fundo: 1 });
  const bb = vetor.ancoras?.bbox || [0, 0, vetor.w - 1, vetor.h - 1];
  const s = largura / Math.max(1, bb[2] - bb[0] + 1);           // mm por píxel
  const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;

  // anéis → mm (Y para cima), limpos e simplificados (0,05 mm), sem ilhas/buracos < 0,3 mm²
  let paths = (vetor.silhueta || []).map(a => {
    const p = [];
    for (let i = 0; i + 1 < a.length; i += 2) p.push({ X: Math.round((a[i] - cx) * s * ESC), Y: Math.round((cy - a[i + 1]) * s * ESC) });
    return p;
  });
  paths = ClipperLib.Clipper.SimplifyPolygons(paths, ClipperLib.PolyFillType.pftEvenOdd);
  const { pts, idx } = paraScad(paths, simpl, maxPts);
  if (pts.length >= 3) {
    params[`tem_${pre}`] = true;
    params[`${pre}_pts`] = pts;
    params[`${pre}_paths`] = idx;
  }
  return params;
}

/** Regiões (µm) → pontos/caminhos do OpenSCAD (mm), limpos, simplificados e com limite de pontos. */
function paraScad(regiao, simpl, maxPts) {
  const paths = ClipperLib.Clipper.CleanPolygons(regiao, simpl)
    .filter(p => p.length >= 3 && Math.abs(ClipperLib.Clipper.Area(p)) >= 0.3 * ESC * ESC);
  const pts = [], idx = [];
  for (const p of paths) {
    if (pts.length + p.length > maxPts) break;
    const ini = pts.length;
    for (const q of p) pts.push([Math.round(q.X) / ESC, Math.round(q.Y) / ESC]);
    idx.push(p.map((_, k) => ini + k));
  }
  return { pts, idx };
}
