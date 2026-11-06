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
// O parâmetro NÃO se chama image_path de propósito: esse nome activa o processamento de
// imagem do HueForge/litofania em download.js.
import ClipperLib from 'clipper-lib';
import { obterVetor } from '../app/vetorPortachaves.js';

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
  const caminho = params[cfg.param || 'logo'];
  params.tem_logo = false;
  params.logo_pts = [];
  params.logo_paths = [];
  if (!caminho || (cfg.so_ams && semAms(params))) return params;
  if (!caminhoLogoValido(caminho, userId)) {
    throw Object.assign(new Error('Imagem do logótipo inválida.'), { status: 400 });
  }

  // buracos_fundo: as zonas brancas dentro do desenho (o miolo de um O, p.ex.) ficam abertas
  const vetor = await obter(caminho, { num_cores: 1, remover_fundo: params.logo_remover_fundo ?? 1, tolerancia: 40, buracos_fundo: 1 });
  const bb = vetor.ancoras?.bbox || [0, 0, vetor.w - 1, vetor.h - 1];
  const largura = Math.max(5, Math.min(200, Number(params[cfg.largura_param || 'logo_largura']) || 40));
  const s = largura / Math.max(1, bb[2] - bb[0] + 1);           // mm por píxel
  const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;

  // anéis → mm (Y para cima), limpos e simplificados (0,05 mm), sem ilhas/buracos < 0,3 mm²
  let paths = (vetor.silhueta || []).map(a => {
    const p = [];
    for (let i = 0; i + 1 < a.length; i += 2) p.push({ X: Math.round((a[i] - cx) * s * ESC), Y: Math.round((cy - a[i + 1]) * s * ESC) });
    return p;
  });
  paths = ClipperLib.Clipper.SimplifyPolygons(paths, ClipperLib.PolyFillType.pftEvenOdd);
  paths = ClipperLib.Clipper.CleanPolygons(paths, 0.05 * ESC)
    .filter(p => p.length >= 3 && Math.abs(ClipperLib.Clipper.Area(p)) >= 0.3 * ESC * ESC);

  const pts = [], idx = [];
  for (const p of paths) {
    if (pts.length + p.length > MAX_PONTOS) break;
    const ini = pts.length;
    for (const q of p) pts.push([Math.round(q.X) / ESC, Math.round(q.Y) / ESC]);
    idx.push(p.map((_, k) => ini + k));
  }
  if (pts.length >= 3) {
    params.tem_logo = true;
    params.logo_pts = pts;
    params.logo_paths = idx;
  }
  return params;
}
