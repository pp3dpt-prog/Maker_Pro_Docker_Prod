require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

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
 */
app.post('/gerar-stl-pro', async (req, res) => {
  let outputPath = null;
  let scadTempPath = null;

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
      Baloo2: 'Baloo 2', // ✅ OpenSCAD usa espaço
    };

    // aplica mapping se existir
    if (params.fonte && FONT_MAP[params.fonte]) {
      params.fonte = FONT_MAP[params.fonte];
    }

    const design = await getDesign(String(produtoId));
    if (!design) return res.status(404).json({ error: 'Design não encontrado.' });

    const templateText = String(design.scad_template || '').trim();
    if (!templateText) return res.status(500).json({ error: 'Design sem scad_template definido.' });

    const renderMode = (String(mode || 'final').toLowerCase() === 'preview') ? 'preview' : 'final';
    const qualityFn = renderMode === 'preview'
      ? (design.qualidade_preview || 24)
      : (design.qualidade_final || 100);

    // NOTA:
    // Se o teu scad_template tiver $fn hardcoded nos cilindros (ex.: $fn=100),
    // este qualityFn NÃO vai alterar o resultado. Só funciona se removeres $fn fixos.
    // Mesmo assim, preview/final continuam EXACTOS (só mais lento).
    //
    // Aqui injetamos quality_fn e $fn global no topo do template (sem o modificar na BD).
    const composed = `
quality_fn = ${qualityFn};
$fn = quality_fn;

${templateText}
`.trim();

    const templateHash = sha256(composed);

    scadTempPath = path.join(tmpDir, `${produtoId}_${templateHash}.scad`);
    await fsp.writeFile(scadTempPath, composed, 'utf8');

    const paramsHash = sha256(`${produtoId}|${templateHash}|${stableStringify(params)}|${renderMode}`);
    const outputName = `${produtoId}_${paramsHash}.stl`;

    const folder = `users/${userId}/${renderMode}`;
    const storagePath = `${folder}/${outputName}`;

    const exists = await fileExistsInStorage(STORAGE_BUCKET, folder, outputName);
    if (exists) {
      const signedUrl = await createSignedUrl(STORAGE_BUCKET, storagePath, SIGNED_URL_TTL_SECONDS);
      return res.json({ success: true, storagePath, url: signedUrl, cached: true, mode: renderMode });
    }

    outputPath = path.join(tmpDir, outputName);

    // OpenSCAD args
    const args = ['-o', outputPath];

    for (const [key, val] of Object.entries(params)) {
      if (typeof val === 'string') args.push('-D', `${key}="${val.replace(/"/g, '\\"')}"`);
      else args.push('-D', `${key}=${val}`);
    }

    args.push(scadTempPath);

    const child = spawn(OPENSCAD_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString().slice(0, 4000); });

    const timer = setTimeout(() => child.kill('SIGKILL'), OPENSCAD_TIMEOUT_MS);
    const { code, signal } = await new Promise((resolve) =>
      child.on('close', (code, signal) => resolve({ code, signal }))
    );

    if (signal) {
      return res.status(500).json({ error: 'OpenSCAD terminou por sinal (possível timeout).', details: stderr, signal });
    }
    if (code !== 0) {
      return res.status(500).json({ error: 'Falha ao processar modelo 3D.', details: stderr });
    }
    clearTimeout(timer);

    if (exitCode !== 0) {
      return res.status(500).json({ error: 'Falha ao processar modelo 3D.', details: stderr });
    }

    const fileBuffer = await fsp.readFile(outputPath);
    const { error: upErr } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, { contentType: 'model/stl', upsert: true });

    if (upErr) return res.status(500).json({ error: 'Erro upload Storage.', details: upErr.message });

    const signedUrl = await createSignedUrl(STORAGE_BUCKET, storagePath, SIGNED_URL_TTL_SECONDS);
    return res.json({ success: true, storagePath, url: signedUrl, cached: false, mode: renderMode });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || 'Erro interno.' });
  } finally {
    if (outputPath) { try { await fsp.unlink(outputPath); } catch (_) {} }
    if (scadTempPath) { try { await fsp.unlink(scadTempPath); } catch (_) {} }
  }
});

app.listen(process.env.PORT || 10000, '0.0.0.0', () => {
  console.log(`STL backend a correr em :${process.env.PORT || 10000}`);
  console.log(`Designs table: ${DESIGNS_TABLE}`);
  console.log(`Bucket: ${STORAGE_BUCKET}`);
});