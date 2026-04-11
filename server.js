/**
 * Backend STL Generator (Secure)
 * - Validates Supabase Bearer token (Authorization: Bearer <token>)
 * - Ignores user_id from body (legacy insecure)
 * - Generates STL via OpenSCAD using spawn (no shell), with timeout
 * - Uploads to Supabase Storage (private bucket recommended)
 * - Returns storagePath (+ optional signed url for compatibility)
 */

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
// ENV / CONFIG
// ──────────────────────────────────────────────

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const STORAGE_BUCKET = (process.env.STORAGE_BUCKET || 'designs-vault').trim();

const FRONTEND_ORIGIN = (process.env.FRONTEND_ORIGIN || '').trim(); // opcional: "https://teu-site.vercel.app"
const OPENSCAD_BIN = (process.env.OPENSCAD_BIN || 'openscad').trim();
const OPENSCAD_TIMEOUT_MS = Number(process.env.OPENSCAD_TIMEOUT_MS || '90000'); // 90s
const SIGNED_URL_TTL_SECONDS = Number(process.env.SIGNED_URL_TTL_SECONDS || '120'); // 2 min

// Compatibilidade (DESATIVADO por defeito)
const ALLOW_LEGACY_USER_ID = (process.env.ALLOW_LEGACY_USER_ID || 'false').toLowerCase() === 'true';

// Produtos permitidos (recomendado: lista real dos 5 IDs)
const ALLOWED_PRODUCTS = (process.env.ALLOWED_PRODUCTS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Limites básicos
const MAX_STRING_LEN = Number(process.env.MAX_STRING_LEN || '64');
const SAFE_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // falhar cedo no backend é OK (é serviço server, não bundle client)
  console.error('Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ──────────────────────────────────────────────
// MIDDLEWARES
// ──────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));

// CORS: por defeito aberto (beta). Em produção, fixa o FRONTEND_ORIGIN.
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

function sanitizeParams(raw) {
  const sanitized = {};

  for (const [key, val] of Object.entries(raw || {})) {
    if (key === 'id' || key === 'user_id') continue;

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
      // evita caracteres de controlo estranhos
      sanitized[key] = val.replace(/\r/g, '').replace(/\n/g, ' ');
    } else if (typeof val === 'number') {
      if (!Number.isFinite(val)) {
        const e = new Error(`Número inválido em ${key}`);
        e.statusCode = 400;
        throw e;
      }
      sanitized[key] = val;
    } else if (typeof val === 'boolean') {
      // OpenSCAD é mais previsível com 0/1
      sanitized[key] = val ? 1 : 0;
    } else {
      const e = new Error(`Tipo inválido em ${key}`);
      e.statusCode = 400;
      throw e;
    }
  }

  return sanitized;
}

async function getUserFromBearer(req) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);

  if (!m) {
    if (ALLOW_LEGACY_USER_ID) return null; // fallback inseguro (beta)
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

  return data.user; // contém id, email, etc.
}

async function fileExistsInStorage(bucket, folder, filename) {
  // list com search reduz overhead vs download
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

// ──────────────────────────────────────────────
// ROUTES
// ──────────────────────────────────────────────

app.get('/healthz', (_req, res) => {
  res.status(200).send('ok');
});

/**
 * POST /gerar-stl-pro
 * Body: { id: produtoId, ...params }
 * Auth: Authorization: Bearer <supabase_access_token>
 *
 * Returns:
 * { success: true, storagePath, url?, paramsHash }
 *
 * Nota: "url" é um signed URL curto (compatibilidade). Em modo seguro, o frontend deve preferir "storagePath".
 */
app.post('/gerar-stl-pro', async (req, res) => {
  let outputPath = null;

  try {
    const { id: produtoId, user_id: legacyUserId, ...rest } = req.body || {};

    if (!produtoId) {
      return res.status(400).json({ error: 'id (produtoId) é obrigatório.' });
    }

    // whitelist de produtos (se definida)
    if (ALLOWED_PRODUCTS.length > 0 && !ALLOWED_PRODUCTS.includes(String(produtoId))) {
      return res.status(400).json({ error: 'produtoId inválido.' });
    }

    // autenticação
    const user = await getUserFromBearer(req);

    // fallback inseguro (só se ALLOW_LEGACY_USER_ID=true)
    const userId = user?.id || legacyUserId;

    if (!userId) {
      return res.status(401).json({ error: 'Sem utilizador autenticado.' });
    }

    // sanitização de params
    const params = sanitizeParams(rest);

    // paths
    const scadPath = path.join(__dirname, 'scads', `${produtoId}.scad`);
    if (!fs.existsSync(scadPath)) {
      return res.status(404).json({ error: `Template SCAD não encontrado: ${produtoId}.scad` });
    }

    // cache por hash (nome determinístico)
    const paramsHash = sha256(String(produtoId) + '|' + stableStringify(params));
    const outputName = `${produtoId}_${paramsHash}.stl`;

    const folder = `users/${userId}`;
    const storagePath = `${folder}/${outputName}`;

    // se já existir no storage, devolve imediatamente (poupa OpenSCAD)
    const exists = await fileExistsInStorage(STORAGE_BUCKET, folder, outputName);
    if (exists) {
      const signedUrl = await createSignedUrl(STORAGE_BUCKET, storagePath, SIGNED_URL_TTL_SECONDS);
      return res.json({
        success: true,
        storagePath,
        url: signedUrl, // compatibilidade/UX
        paramsHash,
        cached: true,
      });
    }

    outputPath = path.join(tmpDir, outputName);

    // montar args do OpenSCAD sem shell (seguro)
    const args = ['-o', outputPath];

    for (const [key, val] of Object.entries(params)) {
      if (typeof val === 'string') {
        const escaped = val.replace(/"/g, '\\"');
        args.push('-D', `${key}="${escaped}"`);
      } else {
        args.push('-D', `${key}=${val}`);
      }
    }

    args.push(scadPath);

    // spawn + timeout
    const child = spawn(OPENSCAD_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    child.stderr.on('data', (d) => {
      // guarda apenas um pouco para não explodir memória
      stderr += d.toString().slice(0, 4000);
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, OPENSCAD_TIMEOUT_MS);

    const exitCode = await new Promise((resolve) => {
      child.on('close', (code) => resolve(code));
    });

    clearTimeout(timer);

    if (exitCode !== 0) {
      return res.status(500).json({
        error: 'Falha ao processar o modelo 3D.',
        details: stderr || `OpenSCAD exit code: ${exitCode}`,
      });
    }

    // upload para storage
    const fileBuffer = await fsp.readFile(outputPath);

    const { error: upErr } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: 'model/stl',
        upsert: true,
      });

    if (upErr) {
      return res.status(500).json({ error: 'Erro ao fazer upload para o Storage.', details: upErr.message });
    }

    const signedUrl = await createSignedUrl(STORAGE_BUCKET, storagePath, SIGNED_URL_TTL_SECONDS);

    return res.json({
      success: true,
      storagePath,
      url: signedUrl, // compatibilidade/UX (opcional)
      paramsHash,
      cached: false,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || 'Erro interno.' });
  } finally {
    // cleanup tmp
    if (outputPath) {
      try { await fsp.unlink(outputPath); } catch (_) {}
    }
  }
});

app.listen(process.env.PORT || 10000, '0.0.0.0', () => {
  console.log(`STL backend a correr em :${process.env.PORT || 10000}`);
  console.log(`Bucket: ${STORAGE_BUCKET}`);
  console.log(`Allowed products: ${ALLOWED_PRODUCTS.length > 0 ? ALLOWED_PRODUCTS.join(', ') : '(sem whitelist)'}`);
});