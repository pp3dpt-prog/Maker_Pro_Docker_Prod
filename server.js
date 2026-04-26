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

/* ======================================================
   ENV
====================================================== */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'designs-vault';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '';
const OPENSCAD_BIN = process.env.OPENSCAD_BIN || 'openscad';
const OPENSCAD_TIMEOUT_MS = Number(process.env.OPENSCAD_TIMEOUT_MS || 180000);
const SIGNED_URL_TTL_SECONDS = Number(process.env.SIGNED_URL_TTL_SECONDS || 120);
const DESIGNS_TABLE = process.env.DESIGNS_TABLE || 'prod_designs';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em falta');
  process.exit(1);
}

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

/* ======================================================
   MIDDLEWARE
====================================================== */

app.use(express.json({ limit: '1mb' }));
app.use(cors(FRONTEND_ORIGIN
  ? { origin: FRONTEND_ORIGIN, credentials: true }
  : undefined
));

const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

/* ======================================================
   HELPERS GERAIS
====================================================== */

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function stableStringify(obj) {
  const out = {};
  Object.keys(obj).sort().forEach(k => out[k] = obj[k]);
  return JSON.stringify(out);
}

async function getUserFromBearer(req) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    const e = new Error('Authorization Bearer token em falta');
    e.statusCode = 401;
    throw e;
  }
  const { data, error } = await supabaseAdmin.auth.getUser(m[1]);
  if (error || !data?.user) {
    const e = new Error('Token inválido');
    e.statusCode = 401;
    throw e;
  }
  return data.user;
}

/* ======================================================
   GENERATION_SCHEMA ENGINE
====================================================== */

function normalizeParams(schema, inputParams = {}) {
  const out = {};

  for (const [key, def] of Object.entries(schema.parameters || {})) {
    let v = inputParams[key];

    if (v === undefined || v === null) {
      if (def.required && def.default === undefined) {
        throw Object.assign(
          new Error(`Parâmetro obrigatório em falta: ${key}`),
          { statusCode: 400 }
        );
      }
      v = def.default;
    }

    if (def.type === 'number') {
      v = Number(v);
      if (!Number.isFinite(v))
        throw Object.assign(
          new Error(`Parâmetro inválido: ${key}`),
          { statusCode: 400 }
        );
      if (def.min !== undefined && v < def.min)
        throw Object.assign(
          new Error(`${key} abaixo do mínimo`),
          { statusCode: 400 }
        );
      if (def.max !== undefined && v > def.max)
        throw Object.assign(
          new Error(`${key} acima do máximo`),
          { statusCode: 400 }
        );
      out[key] = v;
    }

    else if (def.type === 'boolean') {
      out[key] = v ? 1 : 0;
    }

    else if (def.type === 'string') {
      out[key] = String(v);
    }

    else {
      throw Object.assign(
        new Error(`Tipo não suportado em ${key}`),
        { statusCode: 400 }
      );
    }
  }

  return out;
}

function buildScadWrapper({ params, schema, mode }) {
  const lines = [];

  lines.push('// AUTO-GENERATED — DO NOT EDIT');
  lines.push('');

  for (const [k, v] of Object.entries(params)) {
    lines.push(
      typeof v === 'string'
        ? `${k} = "${v.replace(/"/g, '\\"')}";`
        : `${k} = ${v};`
    );
  }

  const q = schema.modes?.[mode]?.quality_fn;
  if (q) {
    lines.push('');
    lines.push(`quality_fn = ${q};`);
    lines.push(`$fn = quality_fn;`);
  }

  lines.push('');
  lines.push(`use <${schema.entry}>;`);
  lines.push('render();');

  return lines.join('\n');
}

/* ======================================================
   ROUTE PRINCIPAL
====================================================== */

app.post('/gerar-stl-pro', async (req, res) => {
  let scadPath = null;
  let outPath = null;

  try {
    const { id: produtoId, mode = 'final', params } = req.body || {};
    if (!produtoId) {
      return res.status(400).json({ error: 'id é obrigatório' });
    }

    const user = await getUserFromBearer(req);

    const { data: design, error } = await supabaseAdmin
      .from(DESIGNS_TABLE)
      .select('generation_schema, scad_entry')
      .eq('id', produtoId)
      .maybeSingle();

    if (error || !design) {
      return res.status(404).json({ error: 'Design não encontrado' });
    }

    const schema = design.generation_schema;
    if (!schema || !schema.parameters || !schema.entry) {
      return res.status(500).json({ error: 'generation_schema inválido' });
    }

    const normalized = normalizeParams(schema, params);
    const scadText = buildScadWrapper({
      params: normalized,
      schema,
      mode
    });

    const hash = sha256(
      produtoId + stableStringify(normalized) + mode
    );

    scadPath = path.join(tmpDir, `${produtoId}_${hash}.scad`);
    outPath = path.join(tmpDir, `${produtoId}_${hash}.stl`);

    await fsp.writeFile(scadPath, scadText, 'utf8');

    await new Promise((resolve, reject) => {
      const child = spawn(
        OPENSCAD_BIN,
        ['-o', outPath, scadPath],
        { stdio: 'inherit' }
      );

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Timeout OpenSCAD'));
      }, OPENSCAD_TIMEOUT_MS);

      child.on('close', code => {
        clearTimeout(timer);
        code === 0 ? resolve() : reject(new Error('Erro OpenSCAD'));
      });
    });

    const fileBuffer = await fsp.readFile(outPath);
    const storagePath = `users/${user.id}/${produtoId}_${hash}.stl`;

    await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: 'model/stl',
        upsert: true
      });

    const { data: signed } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    return res.json({
      success: true,
      storagePath,
      url: signed.signedUrl
    });

  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Erro interno'
    });
  } finally {
    if (scadPath) try { await fsp.unlink(scadPath); } catch {}
    if (outPath) try { await fsp.unlink(outPath); } catch {}
  }
});

/* ======================================================
   BOOT
====================================================== */

app.listen(process.env.PORT || 10000, '0.0.0.0', () => {
  console.log('✅ STL backend ativo');
});
