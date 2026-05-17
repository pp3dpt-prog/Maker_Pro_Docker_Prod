require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const Jimp = require('jimp');

const app = express();

// ──────────────────────────────────────────────
// ENV
// ──────────────────────────────────────────────
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const STORAGE_BUCKET = (process.env.STORAGE_BUCKET || 'designs-vault').trim();

const FRONTEND_ORIGIN = (process.env.FRONTEND_ORIGIN || '').trim();
const OPENSCAD_BIN = (process.env.OPENSCAD_BIN || 'openscad').trim();
const OPENSCAD_TIMEOUT_MS = Number(process.env.OPENSCAD_TIMEOUT_MS || '90000');
const SIGNED_URL_TTL_SECONDS = Number(process.env.SIGNED_URL_TTL_SECONDS || '120');

const DESIGNS_TABLE = (process.env.DESIGNS_TABLE || 'prod_designs').trim();

const ALLOW_LEGACY_USER_ID = (process.env.ALLOW_LEGACY_USER_ID || 'false').toLowerCase() === 'true';

const ALLOWED_PRODUCTS = (process.env.ALLOWED_PRODUCTS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const MAX_STRING_LEN = Number(process.env.MAX_STRING_LEN || '64');
const SAFE_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ──────────────────────────────────────────────
// MIDDLEWARE
// ──────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

if (FRONTEND_ORIGIN) {
  app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
} else {
  app.use(cors());
}

const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
function stableStringify(obj) {
  const keys = Object.keys(obj).sort();
  const out = {};
  for (const k of keys) out[k] = obj[k];
  return JSON.stringify(out);
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

async function getUserFromBearer(req) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);

  if (!m) {
    if (ALLOW_LEGACY_USER_ID) return null;
    const e = new Error('Falta Authorization Bearer token.');
    e.statusCode = 401;
    throw e;
  }

  const token = m[1];
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    const e = new Error('Token inválido ou expirado.');
    e.statusCode = 401;
    throw e;
  }

  return data.user;
}

function sanitizeParams(raw) {
  const sanitized = {};

  for (const [key, val] of Object.entries(raw || {})) {
    if (key === 'id' || key === 'user_id' || key === 'mode') continue;

    if (!SAFE_KEY_RE.test(key)) {
      const e = new Error(`Parâmetro inválido: ${key}`);
      e.statusCode = 400;
      throw e;
    }

    if (typeof val === 'string') {
      if (val.length > MAX_STRING_LEN) {
        const e = new Error(`Texto demasiado longo em ${key} (max ${MAX_STRING_LEN})`);
        e.statusCode = 400;
        throw e;
      }
      sanitized[key] = val.replace(/\r/g, '').replace(/\n/g, ' ');
    } else if (typeof val === 'number') {
      if (!Number.isFinite(val)) {
        const e = new Error(`Número inválido em ${key}`);
        e.statusCode = 400;
        throw e;
      }
      sanitized[key] = val;
    } else if (typeof val === 'boolean') {
      sanitized[key] = val ? 1 : 0;
    } else {
      const e = new Error(`Tipo inválido em ${key}`);
      e.statusCode = 400;
      throw e;
    }
  }

  // Aliases para compatibilidade com frontend antigo:
  // texto -> nome (o teu SCAD usa "nome")
  if (sanitized.texto && !sanitized.nome) sanitized.nome = sanitized.texto;

  // Nome (capital) -> nome (lowercase) — generation_schema pode usar maiúscula
  if (sanitized.Nome && !sanitized.nome) sanitized.nome = sanitized.Nome;

  // tamanho -> fontSize
  if (sanitized.tamanho && !sanitized.fontSize) sanitized.fontSize = sanitized.tamanho;

  // nome_pet -> nome (se existir)
  if (sanitized.nome_pet && !sanitized.nome) sanitized.nome = sanitized.nome_pet;

  return sanitized;
}

async function fileExistsInStorage(bucket, folder, filename) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .list(folder, { search: filename, limit: 1 });

  if (error) return false;
  return Array.isArray(data) && data.some(f => f.name === filename);
}

async function createSignedUrl(bucket, storagePath, ttlSeconds) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(storagePath, ttlSeconds);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function getDesign(produtoId) {
  const { data, error } = await supabaseAdmin
    .from(DESIGNS_TABLE)
    .select('id, familia, scad_template, qualidade_preview, qualidade_final')
    .eq('id', produtoId)
    .maybeSingle();

  if (error) {
    const e = new Error(`Erro a ler ${DESIGNS_TABLE}: ${error.message}`);
    e.statusCode = 500;
    throw e;
  }

  return data || null;
}

// ──────────────────────────────────────────────
// ROUTES
// ──────────────────────────────────────────────
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

/**
 * POST /gerar-stl-pro
 * body: { id, mode?, ...params }
 * mode: 'preview' | 'final' (default: 'final')
 *
 * Suporta produtos com imagem: se params.image_path for um caminho no Storage,
 * descarrega, processa (resize / quantize para HueForge) e passa ao OpenSCAD.
 * Para a família 'hueforge', gera também um ficheiro TXT com as camadas de mudança.
 */
app.post('/gerar-stl-pro', async (req, res) => {
  let outputPath    = null;
  let scadTempPath  = null;
  let imgLocalPath  = null;
  let imgProcPath   = null;

  try {
    const { id: produtoId, user_id: legacyUserId, mode, ...rest } = req.body || {};

    if (!produtoId) return res.status(400).json({ error: 'id (produtoId) é obrigatório.' });

    if (ALLOWED_PRODUCTS.length > 0 && !ALLOWED_PRODUCTS.includes(String(produtoId))) {
      return res.status(400).json({ error: 'produtoId inválido.' });
    }

    const user = await getUserFromBearer(req);
    const userId = user?.id || legacyUserId;

    if (!userId) return res.status(401).json({ error: 'Sem utilizador autenticado.' });

    const params = sanitizeParams(rest);

    // Map UI font names -> OpenSCAD logical font names
    const FONT_MAP = {
      Aladin: 'Aladin',
      Amarante: 'Amarante',
      Benne: 'Benne',
      Baloo2: 'Baloo 2',
    };
    if (params.fonte && FONT_MAP[params.fonte]) {
      params.fonte = FONT_MAP[params.fonte];
    }

    const design = await getDesign(String(produtoId));
    if (!design) return res.status(404).json({ error: 'Design não encontrado.' });

    const templateText = String(design.scad_template || '').trim();
    if (!templateText) return res.status(500).json({ error: 'Design sem scad_template definido.' });

    const renderMode = (String(mode || 'final').toLowerCase() === 'preview') ? 'preview' : 'final';
    const qualityFn  = renderMode === 'preview'
      ? (design.qualidade_preview || 24)
      : (design.qualidade_final || 100);

    // ── PROCESSAMENTO DE IMAGEM (se o produto tiver image_path) ──────────
    const isHueforge   = String(design.familia || '').toLowerCase() === 'hueforge';
    const isImageBased = typeof params.image_path === 'string' && params.image_path.length > 0;

    if (isImageBased) {
      const uid      = crypto.randomBytes(8).toString('hex');
      imgLocalPath   = path.join(tmpDir, `img_raw_${uid}.png`);
      imgProcPath    = path.join(tmpDir, `img_proc_${uid}.png`);

      // 1. Descarregar imagem do Storage
      await downloadFromStorage(STORAGE_BUCKET, params.image_path, imgLocalPath);

      // 2. Para HueForge: quantizar; para outros: só redimensionar
      const numCores = Number(params.num_cores ?? 4);
      let imgInfo;

      if (isHueforge) {
        // Pré-redimensiona antes de quantizar (melhor qualidade)
        await prepareImageForSurface(imgLocalPath, imgLocalPath, 200);
        imgInfo = await quantizeImageForHueforge(imgLocalPath, imgProcPath, numCores);
      } else {
        imgInfo = await prepareImageForSurface(imgLocalPath, imgProcPath, 150);
      }

      // 3. Substituir image_path pelo caminho local processado + injetar dimensões
      params.image_path = imgProcPath;
      params.image_w    = imgInfo.width;
      params.image_h    = imgInfo.height;
    }

    // ── HASH E CACHE ─────────────────────────────────────────────────────
    // Para produtos com imagem, excluímos image_path do hash (varia por sessão)
    // e usamos o conteúdo da imagem em vez do caminho.
    let paramsForHash = { ...params };
    if (isImageBased && imgLocalPath) {
      delete paramsForHash.image_path;
      try {
        const imgBuf = await fsp.readFile(imgProcPath || imgLocalPath);
        paramsForHash._image_hash = sha256(imgBuf.toString('base64').slice(0, 1000));
      } catch (_) {}
    }

    const composed = `
quality_fn = ${qualityFn};
$fn = quality_fn;

${templateText}
`.trim();

    const templateHash = sha256(composed);
    scadTempPath = path.join(tmpDir, `${produtoId}_${templateHash}.scad`);
    await fsp.writeFile(scadTempPath, composed, 'utf8');

    const paramsHash = sha256(`${produtoId}|${templateHash}|${stableStringify(paramsForHash)}|${renderMode}`);
    const outputName  = `${produtoId}_${paramsHash}.stl`;
    const folder      = `users/${userId}/${renderMode}`;
    const storagePath = `${folder}/${outputName}`;

    // Cache hit?
    const exists = await fileExistsInStorage(STORAGE_BUCKET, folder, outputName);
    if (exists) {
      const signedUrl = await createSignedUrl(STORAGE_BUCKET, storagePath, SIGNED_URL_TTL_SECONDS);
      const response  = { success: true, storagePath, url: signedUrl, cached: true, mode: renderMode };

      // HueForge: tenta devolver também o TXT em cache
      if (isHueforge) {
        const txtName   = `${produtoId}_${paramsHash}.txt`;
        const txtPath   = `${folder}/${txtName}`;
        const txtExists = await fileExistsInStorage(STORAGE_BUCKET, folder, txtName);
        if (txtExists) {
          response.txtUrl = await createSignedUrl(STORAGE_BUCKET, txtPath, SIGNED_URL_TTL_SECONDS);
        }
      }

      return res.json(response);
    }

    // ── OPENSCAD ──────────────────────────────────────────────────────────
    outputPath = path.join(tmpDir, outputName);

    const args = ['-o', outputPath];
    for (const [key, val] of Object.entries(params)) {
      if (key === '_image_hash') continue; // auxiliar, não é param SCAD
      if (typeof val === 'string') args.push('-D', `${key}="${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
      else args.push('-D', `${key}=${val}`);
    }
    args.push(scadTempPath);

    const child  = spawn(OPENSCAD_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr   = '';
    child.stderr.on('data', (d) => { stderr += d.toString().slice(0, 4000); });

    const timer    = setTimeout(() => child.kill('SIGKILL'), OPENSCAD_TIMEOUT_MS);
    const exitCode = await new Promise((resolve) => child.on('close', (code) => resolve(code)));
    clearTimeout(timer);

    if (exitCode !== 0) {
      return res.status(500).json({ error: 'Falha ao processar modelo 3D.', details: stderr });
    }

    // ── UPLOAD STL ────────────────────────────────────────────────────────
    const fileBuffer  = await fsp.readFile(outputPath);
    const { error: upErr } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, { contentType: 'model/stl', upsert: true });

    if (upErr) return res.status(500).json({ error: 'Erro upload Storage.', details: upErr.message });

    const signedUrl = await createSignedUrl(STORAGE_BUCKET, storagePath, SIGNED_URL_TTL_SECONDS);
    const response  = { success: true, storagePath, url: signedUrl, cached: false, mode: renderMode };

    // ── HueForge: gerar e fazer upload do TXT ────────────────────────────
    if (isHueforge) {
      const txtContent = generateHueforgeTxt({
        numCores     : Number(params.num_cores    ?? 4),
        layerHeight  : Number(params.layer_height ?? 0.16),
        espessuraBase: Number(params.espessura_base ?? 1.0),
        alturaRelevo : Number(params.altura_relevo  ?? 2.0),
        larguraMm    : Number(params.largura_mm     ?? 100),
        alturaMm     : Number(params.altura_mm      ?? 100),
      });

      const txtName    = `${produtoId}_${paramsHash}.txt`;
      const txtStoragePath = `${folder}/${txtName}`;
      const { error: txtErr } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(txtStoragePath, Buffer.from(txtContent, 'utf8'),
                { contentType: 'text/plain', upsert: true });

      if (!txtErr) {
        response.txtUrl = await createSignedUrl(STORAGE_BUCKET, txtStoragePath, SIGNED_URL_TTL_SECONDS);
      }
    }

    return res.json(response);

  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || 'Erro interno.' });
  } finally {
    for (const p of [outputPath, scadTempPath, imgLocalPath, imgProcPath]) {
      if (p && p !== imgLocalPath) { // imgLocalPath pode ser = imgProcPath nalguns casos
        try { await fsp.unlink(p); } catch (_) {}
      }
    }
    // Limpar ficheiro de imagem original separadamente se for diferente do processado
    if (imgLocalPath && imgLocalPath !== imgProcPath) {
      try { await fsp.unlink(imgLocalPath); } catch (_) {}
    }
    if (imgProcPath) {
      try { await fsp.unlink(imgProcPath); } catch (_) {}
    }
  }
});

// ──────────────────────────────────────────────
// IMAGE PROCESSING HELPERS
// ──────────────────────────────────────────────

/**
 * Download a file from Supabase Storage to a local tmp path.
 * Returns the local file path.
 */
async function downloadFromStorage(bucket, storagePath, localPath) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .download(storagePath);

  if (error || !data) {
    const e = new Error(`Erro ao descarregar imagem do Storage: ${error?.message || 'sem dados'}`);
    e.statusCode = 400;
    throw e;
  }

  const arrayBuffer = await data.arrayBuffer();
  await fsp.writeFile(localPath, Buffer.from(arrayBuffer));
  return localPath;
}

/**
 * Resize an image to fit within maxPx in the longest dimension.
 * Converts to grayscale and saves as PNG.
 * Returns { localPath, width, height }
 */
async function prepareImageForSurface(inputPath, outputPath, maxPx = 150) {
  const img = await Jimp.read(inputPath);

  const w = img.getWidth();
  const h = img.getHeight();

  // Scale down if larger than maxPx
  if (w > maxPx || h > maxPx) {
    if (w >= h) {
      img.resize(maxPx, Jimp.AUTO);
    } else {
      img.resize(Jimp.AUTO, maxPx);
    }
  }

  img.grayscale();

  await img.writeAsync(outputPath);
  return { localPath: outputPath, width: img.getWidth(), height: img.getHeight() };
}

/**
 * Quantize a grayscale image to N discrete levels (for HueForge).
 * Lower values (dark) = shorter = first filament.
 * Returns { localPath, width, height }
 */
async function quantizeImageForHueforge(inputPath, outputPath, numCores) {
  const img = await Jimp.read(inputPath);
  img.grayscale();

  const n = Math.max(2, Math.min(6, numCores));

  img.scan(0, 0, img.getWidth(), img.getHeight(), function (x, y, idx) {
    const gray = this.bitmap.data[idx];
    // Map 0-255 → level 0..(n-1), then back to 0-255
    const level = Math.min(Math.floor(gray / 256 * n), n - 1);
    const quantized = n === 1 ? 0 : Math.round(level / (n - 1) * 255);
    this.bitmap.data[idx]     = quantized;
    this.bitmap.data[idx + 1] = quantized;
    this.bitmap.data[idx + 2] = quantized;
    // alpha (idx+3) unchanged
  });

  await img.writeAsync(outputPath);
  return { localPath: outputPath, width: img.getWidth(), height: img.getHeight() };
}

/**
 * Generate the HueForge color-change TXT guide.
 */
function generateHueforgeTxt({ numCores, layerHeight, espessuraBase, alturaRelevo, larguraMm, alturaMm }) {
  const lh = layerHeight;
  const layersBase = Math.ceil(espessuraBase / lh);
  const layersPerColor = Math.max(1, Math.ceil((alturaRelevo / numCores) / lh));
  const totalLayers = layersBase + (numCores - 1) * layersPerColor;

  const lines = [];
  lines.push('=== HueForge — Guia de Mudança de Filamento ===');
  lines.push('');
  lines.push(`Dimensões do modelo : ${larguraMm} mm × ${alturaMm} mm`);
  lines.push(`Altura da camada     : ${lh} mm`);
  lines.push(`Número de cores      : ${numCores}`);
  lines.push(`Espessura da base    : ${espessuraBase} mm`);
  lines.push(`Altura do relevo     : ${alturaRelevo} mm`);
  lines.push(`Total de camadas (aprox.) : ${totalLayers}`);
  lines.push('');
  lines.push('─────────────────────────────────────────────────');
  lines.push('');
  lines.push(`COR 1 (a mais escura / base)`);
  lines.push(`  → Carrega este filamento antes de iniciar a impressão.`);
  lines.push(`  → Imprime desde a camada 1 até à camada ${layersBase + layersPerColor - 1}.`);
  lines.push('');

  for (let i = 2; i <= numCores; i++) {
    const changeLayer = layersBase + (i - 2) * layersPerColor + layersPerColor;
    const heightMm = (changeLayer * lh).toFixed(2);
    lines.push(`COR ${i}`);
    lines.push(`  → Para a impressão na camada ${changeLayer} (altura ≈ ${heightMm} mm).`);
    lines.push(`  → Troca o filamento e retoma a impressão.`);
    if (i < numCores) {
      const nextChange = changeLayer + layersPerColor;
      lines.push(`  → Esta cor dura até à camada ${nextChange - 1}.`);
    } else {
      lines.push(`  → Esta é a última cor (cobre as zonas mais claras).`);
    }
    lines.push('');
  }

  lines.push('─────────────────────────────────────────────────');
  lines.push('');
  lines.push('DICAS:');
  lines.push('  • Usa "Pause at Layer" (Bambu/Orca/PrusaSlicer) ou M600 no G-code.');
  lines.push('  • A cor 1 é a mais escura e deve ser carregada primeiro.');
  lines.push('  • As camadas exatas podem variar ±1-2 conforme o slicer.');
  lines.push('  • Testa com uma amostra pequena antes de imprimir a peça final.');

  return lines.join('\n');
}

// ──────────────────────────────────────────────
// ROUTE: POST /gerar-stl-pro  (updated with image support)
// ──────────────────────────────────────────────

app.listen(process.env.PORT || 10000, '0.0.0.0', () => {
  console.log(`STL backend a correr em :${process.env.PORT || 10000}`);
  console.log(`Designs table: ${DESIGNS_TABLE}`);
  console.log(`Bucket: ${STORAGE_BUCKET}`);
});