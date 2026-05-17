/**
 * POST /gerar-stl-pro
 *
 * Gera um STL a partir de um design SCAD com parâmetros.
 * Suporta produtos normais (texto, sliders) e produtos com imagem (portachaves, HueForge).
 * Para HueForge devolve também txtUrl com o guia de mudança de filamento.
 */

import fs   from 'fs';
import fsp  from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { spawn }       from 'child_process';
import { v4 as uuid }  from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname }       from 'path';

// Jimp é CommonJS — compatível com ESM em Node 20
import Jimp from 'jimp';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ──────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────
const OPENSCAD_BIN        = process.env.OPENSCAD_BIN || 'openscad';
const OPENSCAD_TIMEOUT_MS = Number(process.env.OPENSCAD_TIMEOUT_MS || '120000');
const SIGNED_URL_TTL      = Number(process.env.SIGNED_URL_TTL_SECONDS || '3600');
const STL_BUCKET          = process.env.STL_BUCKET  || 'user-stls';
const IMG_BUCKET          = process.env.IMG_BUCKET  || 'designs-vault';
const DESIGNS_TABLE       = process.env.DESIGNS_TABLE || 'prod_designs';
const MAX_PARAM_LEN       = 64;
const MAX_PATH_LEN        = 500;
const SAFE_KEY_RE         = /^[A-Za-z_][A-Za-z0-9_]*$/;

const TMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ──────────────────────────────────────────────
// Supabase (service role — acesso total)
// ──────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function stableJson(obj) {
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
  return JSON.stringify(sorted);
}

async function getUser(req) {
  const auth  = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const e = new Error('Authorization Bearer obrigatório.');
    e.status = 401;
    throw e;
  }
  const { data, error } = await supabase.auth.getUser(match[1]);
  if (error || !data?.user) {
    const e = new Error('Token inválido ou expirado.');
    e.status = 401;
    throw e;
  }
  return data.user;
}

/**
 * Valida e limpa os parâmetros recebidos do frontend.
 * Trata image_path separadamente (pode ser longo).
 */
function sanitizeParams(raw) {
  const out = {};

  for (const [key, val] of Object.entries(raw || {})) {
    if (key === 'id' || key === 'user_id' || key === 'mode') continue;
    if (!SAFE_KEY_RE.test(key)) {
      const e = new Error(`Parâmetro inválido: "${key}"`);
      e.status = 400;
      throw e;
    }

    if (key === 'image_path') {
      // Caminho do Storage — validação própria
      if (val === null || val === undefined || val === '') continue; // imagem não enviada
      if (typeof val !== 'string' || val.length > MAX_PATH_LEN) {
        const e = new Error('image_path inválido.');
        e.status = 400;
        throw e;
      }
      // Só aceita caminhos dentro de "uploads/"
      if (!val.startsWith('uploads/')) {
        const e = new Error('image_path deve começar com "uploads/".');
        e.status = 400;
        throw e;
      }
      out[key] = val;
      continue;
    }

    if (typeof val === 'string') {
      if (val.length > MAX_PARAM_LEN) {
        const e = new Error(`Valor demasiado longo em "${key}" (max ${MAX_PARAM_LEN})`);
        e.status = 400;
        throw e;
      }
      out[key] = val.replace(/\r/g, '').replace(/\n/g, ' ');
    } else if (typeof val === 'number') {
      if (!Number.isFinite(val)) {
        const e = new Error(`Número inválido em "${key}"`);
        e.status = 400;
        throw e;
      }
      out[key] = val;
    } else if (typeof val === 'boolean') {
      out[key] = val ? 1 : 0;
    } else if (val === null) {
      // ignorar nulls
    } else {
      const e = new Error(`Tipo inválido em "${key}"`);
      e.status = 400;
      throw e;
    }
  }

  // Aliases de compatibilidade
  if (out.texto    && !out.nome) out.nome      = out.texto;
  if (out.Nome     && !out.nome) out.nome      = out.Nome;
  if (out.nome_pet && !out.nome) out.nome      = out.nome_pet;
  if (out.tamanho  && !out.fontSize) out.fontSize = out.tamanho;

  // Font mapping: nome abreviado → nome completo OpenSCAD
  const FONT_MAP = { Aladin: 'Aladin', Amarante: 'Amarante', Benne: 'Benne', Baloo2: 'Baloo 2' };
  if (out.fonte && FONT_MAP[out.fonte]) out.fonte = FONT_MAP[out.fonte];

  return out;
}

/** Escreve os params como variáveis SCAD no topo do template. */
function buildScadContent(params, templateText, qualityFn) {
  const vars = Object.entries(params)
    .map(([k, v]) => {
      if (typeof v === 'string') return `${k} = "${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}";`;
      return `${k} = ${v};`;
    })
    .join('\n');

  return `// Parâmetros injetados automaticamente
${vars}
quality_fn = ${qualityFn};
$fn = quality_fn;

// Template do produto
${templateText}
`.trim();
}

/** Descarrega um ficheiro do Supabase Storage para disco local. */
async function downloadFromStorage(bucket, storagePath, localPath) {
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) {
    const e = new Error(`Erro ao descarregar imagem: ${error?.message || 'sem dados'}`);
    e.status = 400;
    throw e;
  }
  await fsp.writeFile(localPath, Buffer.from(await data.arrayBuffer()));
}

/** Redimensiona e converte para escala de cinza (para portachaves, etc.). */
async function prepareImage(inputPath, outputPath, maxPx = 150) {
  const img = await Jimp.read(inputPath);
  if (img.getWidth() > maxPx || img.getHeight() > maxPx) {
    img.getWidth() >= img.getHeight()
      ? img.resize(maxPx, Jimp.AUTO)
      : img.resize(Jimp.AUTO, maxPx);
  }
  img.grayscale();
  await img.writeAsync(outputPath);
  return { width: img.getWidth(), height: img.getHeight() };
}

/** Quantiza para N níveis de cinza (HueForge). */
async function quantizeImage(inputPath, outputPath, numCores) {
  const n   = Math.max(2, Math.min(6, numCores));
  const img = await Jimp.read(inputPath);
  img.grayscale();
  img.scan(0, 0, img.getWidth(), img.getHeight(), function (x, y, idx) {
    const gray       = this.bitmap.data[idx];
    const level      = Math.min(Math.floor(gray / 256 * n), n - 1);
    const quantized  = n === 1 ? 0 : Math.round(level / (n - 1) * 255);
    this.bitmap.data[idx]     = quantized;
    this.bitmap.data[idx + 1] = quantized;
    this.bitmap.data[idx + 2] = quantized;
  });
  await img.writeAsync(outputPath);
  return { width: img.getWidth(), height: img.getHeight() };
}

/** Gera o guia TXT de mudança de filamento para HueForge. */
function buildHueforgeTxt({ numCores, layerHeight, espessuraBase, alturaRelevo, larguraMm, alturaMm }) {
  const lh            = layerHeight;
  const layersBase    = Math.ceil(espessuraBase / lh);
  const layersPerClr  = Math.max(1, Math.ceil((alturaRelevo / numCores) / lh));
  const totalLayers   = layersBase + (numCores - 1) * layersPerClr;

  const L = [
    '=== HueForge — Guia de Mudança de Filamento ===',
    '',
    `Dimensões      : ${larguraMm} mm × ${alturaMm} mm`,
    `Altura de camada: ${lh} mm`,
    `Número de cores : ${numCores}`,
    `Espessura base  : ${espessuraBase} mm`,
    `Altura do relevo: ${alturaRelevo} mm`,
    `Total de camadas: ~${totalLayers}`,
    '',
    '─────────────────────────────────────────────────',
    '',
    'COR 1  (mais escura — carrega antes de iniciar)',
    `  → Camadas 1 até ${layersBase + layersPerClr - 1}`,
    '',
  ];

  for (let i = 2; i <= numCores; i++) {
    const changeAt = layersBase + (i - 2) * layersPerClr + layersPerClr;
    const heightMm = (changeAt * lh).toFixed(2);
    L.push(`COR ${i}`);
    L.push(`  → Para na camada ${changeAt}  (altura ≈ ${heightMm} mm)`);
    L.push(`  → Troca o filamento e retoma`);
    if (i < numCores) L.push(`  → Dura até à camada ${changeAt + layersPerClr - 1}`);
    else              L.push('  → Última cor (zonas mais claras)');
    L.push('');
  }

  L.push('─────────────────────────────────────────────────');
  L.push('');
  L.push('DICAS:');
  L.push('  • Usa "Pause at Layer" (Bambu Studio / Orca / PrusaSlicer) ou M600.');
  L.push('  • Cor 1 = mais escura, Cor N = mais clara.');
  L.push('  • As camadas podem variar ±1-2 conforme o slicer.');

  return L.join('\n');
}

/** Upload para Supabase Storage. Devolve URL assinada ou null. */
async function uploadFile(bucket, storagePath, buffer, mimeType) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

  if (error) {
    console.error('Erro no upload:', error.message);
    return null;
  }

  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, SIGNED_URL_TTL);

  return data?.signedUrl ?? null;
}

/** Verifica se um ficheiro já existe no Storage. */
async function fileExists(bucket, folder, filename) {
  const { data } = await supabase.storage
    .from(bucket)
    .list(folder, { search: filename, limit: 1 });
  return Array.isArray(data) && data.some(f => f.name === filename);
}

// ──────────────────────────────────────────────
// Handler principal
// ──────────────────────────────────────────────
export async function gerarStlPro(req, res) {
  const tempFiles = [];

  try {
    // 1. Auth
    const user = await getUser(req);

    // 2. Body
    const { id: produtoId, mode, ...rest } = req.body || {};
    if (!produtoId) {
      return res.status(400).json({ error: 'id (produtoId) é obrigatório.' });
    }

    // 3. Params
    const params = sanitizeParams(rest);

    // 4. Design
    const { data: design, error: dErr } = await supabase
      .from(DESIGNS_TABLE)
      .select('id, familia, scad_template, qualidade_preview, qualidade_final')
      .eq('id', String(produtoId))
      .maybeSingle();

    if (dErr || !design) {
      return res.status(404).json({ error: 'Design não encontrado.' });
    }

    const templateText = String(design.scad_template || '').trim();
    if (!templateText) {
      return res.status(500).json({ error: 'Design sem scad_template definido.' });
    }

    const renderMode = String(mode || 'preview').toLowerCase() === 'preview' ? 'preview' : 'final';
    const qualityFn  = renderMode === 'preview'
      ? (design.qualidade_preview || 24)
      : (design.qualidade_final   || 100);

    const isHueforge   = String(design.familia || '').toLowerCase() === 'hueforge';
    const isImageBased = typeof params.image_path === 'string' && params.image_path.length > 0;

    // ── 5. Processar imagem (se existir) ─────────────────────────────────
    if (isImageBased) {
      const uid      = uuid();
      const rawPath  = path.join(TMP_DIR, `img_raw_${uid}.png`);
      const procPath = path.join(TMP_DIR, `img_proc_${uid}.png`);
      tempFiles.push(rawPath, procPath);

      await downloadFromStorage(IMG_BUCKET, params.image_path, rawPath);

      let imgInfo;
      if (isHueforge) {
        const numCores = Number(params.num_cores ?? 4);
        await prepareImage(rawPath, rawPath, 200);   // pré-reduz
        imgInfo = await quantizeImage(rawPath, procPath, numCores);
      } else {
        imgInfo = await prepareImage(rawPath, procPath, 150);
      }

      // Substitui o path do Storage pelo caminho local processado
      params.image_path = procPath;
      params.image_w    = imgInfo.width;
      params.image_h    = imgInfo.height;
    }

    // ── 6. Hash para cache ────────────────────────────────────────────────
    const hashParams = { ...params };
    if (isImageBased) delete hashParams.image_path; // path local muda por sessão
    // Adiciona hash do conteúdo do ficheiro processado para o cache ser correto
    if (isImageBased && params.image_path) {
      try {
        const buf = await fsp.readFile(params.image_path);
        hashParams._img_hash = sha256(buf.subarray(0, 2048).toString('base64'));
      } catch (_) {}
    }

    const scadContent  = buildScadContent(params, templateText, qualityFn);
    const templateHash = sha256(scadContent);
    const paramsHash   = sha256(`${produtoId}|${templateHash}|${stableJson(hashParams)}|${renderMode}`);
    const stlFilename  = `${produtoId}_${paramsHash}.stl`;
    const folder       = `${user.id}/${renderMode}`;
    const stlStorage   = `${folder}/${stlFilename}`;

    // ── 7. Cache hit? ────────────────────────────────────────────────────
    const cached = await fileExists(STL_BUCKET, folder, stlFilename);
    if (cached) {
      const { data: urlData } = await supabase.storage
        .from(STL_BUCKET)
        .createSignedUrl(stlStorage, SIGNED_URL_TTL);

      const response = { success: true, url: urlData?.signedUrl, cached: true, mode: renderMode };

      if (isHueforge) {
        const txtFilename = `${produtoId}_${paramsHash}.txt`;
        if (await fileExists(STL_BUCKET, folder, txtFilename)) {
          const { data: td } = await supabase.storage
            .from(STL_BUCKET)
            .createSignedUrl(`${folder}/${txtFilename}`, SIGNED_URL_TTL);
          response.txtUrl = td?.signedUrl;
        }
      }

      return res.json(response);
    }

    // ── 8. Gerar SCAD + STL ──────────────────────────────────────────────
    const jobId    = uuid();
    const scadPath = path.join(TMP_DIR, `${jobId}.scad`);
    const stlPath  = path.join(TMP_DIR, `${jobId}.stl`);
    tempFiles.push(scadPath, stlPath);

    await fsp.writeFile(scadPath, scadContent, 'utf8');

    const child = spawn(OPENSCAD_BIN, ['-o', stlPath, scadPath], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString().slice(0, 4000); });

    const timer    = setTimeout(() => child.kill('SIGKILL'), OPENSCAD_TIMEOUT_MS);
    const exitCode = await new Promise((resolve) => child.on('close', resolve));
    clearTimeout(timer);

    if (exitCode !== 0) {
      console.error('OpenSCAD stderr:', stderr);
      return res.status(500).json({ error: 'Falha ao gerar modelo 3D.', details: stderr });
    }

    // ── 9. Upload STL ────────────────────────────────────────────────────
    const stlBuffer = await fsp.readFile(stlPath);
    const stlUrl    = await uploadFile(STL_BUCKET, stlStorage, stlBuffer, 'model/stl');

    if (!stlUrl) {
      return res.status(500).json({ error: 'Erro no upload do STL.' });
    }

    const response = { success: true, url: stlUrl, cached: false, mode: renderMode };

    // ── 10. HueForge TXT ─────────────────────────────────────────────────
    if (isHueforge) {
      const txtContent  = buildHueforgeTxt({
        numCores     : Number(params.num_cores      ?? 4),
        layerHeight  : Number(params.layer_height   ?? 0.16),
        espessuraBase: Number(params.espessura_base ?? 1.0),
        alturaRelevo : Number(params.altura_relevo  ?? 2.0),
        larguraMm    : Number(params.largura_mm     ?? 100),
        alturaMm     : Number(params.altura_mm      ?? 100),
      });

      const txtFilename = `${produtoId}_${paramsHash}.txt`;
      const txtStorage  = `${folder}/${txtFilename}`;
      const txtUrl      = await uploadFile(STL_BUCKET, txtStorage,
                                           Buffer.from(txtContent, 'utf8'), 'text/plain');
      if (txtUrl) response.txtUrl = txtUrl;
    }

    return res.json(response);

  } catch (err) {
    const status = err.status || 500;
    console.error('gerar-stl-pro error:', err.message);
    return res.status(status).json({ error: err.message || 'Erro interno.' });
  } finally {
    // Limpar ficheiros temporários
    for (const f of tempFiles) {
      try { await fsp.unlink(f); } catch (_) {}
    }
  }
}
