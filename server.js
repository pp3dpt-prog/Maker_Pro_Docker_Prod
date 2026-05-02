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

/* ================= ENV ================= */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'designs-vault';
const OPENSCAD_BIN = process.env.OPENSCAD_BIN || 'openscad';
const OPENSCAD_TIMEOUT_MS = Number(process.env.OPENSCAD_TIMEOUT_MS || 180000);
const SIGNED_URL_TTL_SECONDS = Number(process.env.SIGNED_URL_TTL_SECONDS || 120);
const DESIGNS_TABLE = process.env.DESIGNS_TABLE || 'prod_designs';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

console.log('✅ STL backend a iniciar');

/* ================= SUPABASE ================= */

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

/* ================= MIDDLEWARE ================= */

app.use(express.json({ limit: '1mb' }));
app.use(cors());

const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

/* ================= HELPERS ================= */

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function stable(obj) {
  const o = {};
  Object.keys(obj).sort().forEach(k => (o[k] = obj[k]));
  return JSON.stringify(o);
}

async function getUser(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/);

  if (!m) {
    throw Object.assign(new Error('No token'), { statusCode: 401 });
  }

  const { data, error } = await supabase.auth.getUser(m[1]);

  if (error || !data?.user) {
    throw Object.assign(new Error('Invalid token'), { statusCode: 401 });
  }

  return data.user;
}

function normalizeParams(schema, input = {}) {
  const out = {};

  for (const [k, def] of Object.entries(schema.parameters)) {
    let v = input[k];

    if (v === undefined) {
      if (def.required && def.default === undefined) {
        throw Object.assign(
          new Error(`Missing param: ${k}`),
          { statusCode: 400 }
        );
      }
      v = def.default;
    }

    if (def.type === 'number') {
      v = Number(v);
      if (!Number.isFinite(v)) throw new Error(`Invalid number: ${k}`);
      out[k] = v;
    } else if (def.type === 'boolean') {
      out[k] = v ? 1 : 0;
    } else if (def.type === 'string') {
      out[k] = String(v);
    }
  }

  return out;
}

/* ================= SCAD BUILDER ================= */

function buildScadFile({ params, scadTemplate }) {
  const lines = [];

  lines.push('// AUTO-GENERATED — DO NOT EDIT\n');

  // Variáveis injetadas
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') {
      lines.push(`${k} = "${v.replace(/"/g, '\\"')}";`);
    } else {
      lines.push(`${k} = ${v};`);
    }
  }

  lines.push('\n// ===== TEMPLATE DA BD =====\n');
  lines.push(scadTemplate);

  return lines.join('\n');
}

/* ================= HEALTH ================= */

app.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/* ================= ROUTE ================= */

app.post('/gerar-stl-pro', async (req, res) => {
  let scadFile;
  let outFile;

  try {
    console.log('\n🚀 /gerar-stl-pro');

    const { id, mode = 'final', params } = req.body || {};
    if (!id) {
      return res.status(400).json({ error: 'id required' });
    }

    const user = await getUser(req);

    const { data: design } = await supabase
      .from(DESIGNS_TABLE)
      .select('generation_schema, scad_template')
      .eq('id', id)
      .maybeSingle();

    if (!design?.generation_schema || !design?.scad_template) {
      return res.status(404).json({ error: 'Design incompleto ou inexistente' });
    }

    const schema = design.generation_schema;
    const scadTemplate = design.scad_template;

    const normalized = normalizeParams(schema, params);

    const hash = sha256(id + stable(normalized) + mode);
    scadFile = path.join(tmpDir, `${hash}.scad`);
    outFile = path.join(tmpDir, `${hash}.stl`);

    const scadContent = buildScadFile({
      params: normalized,
      scadTemplate
    });

    await fsp.writeFile(scadFile, scadContent);

    await new Promise((resolve, reject) => {
      const p = spawn(OPENSCAD_BIN, ['-o', outFile, scadFile]);

      const t = setTimeout(() => {
        p.kill('SIGKILL');
        reject(new Error('OpenSCAD timeout'));
      }, OPENSCAD_TIMEOUT_MS);

      p.stderr.on('data', d => {
        console.error('[OpenSCAD]', d.toString());
      });

      p.on('close', code => {
        clearTimeout(t);
        code === 0 ? resolve() : reject(new Error(`OpenSCAD exit ${code}`));
      });
    });

    const buffer = await fsp.readFile(outFile);

    const storagePath = `tmp/${user.id}/${id}_${hash}.stl`;

    await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, { upsert: true });

    const { data: signed } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    res.json({
      success: true,
      url: signed.signedUrl
    });
  } catch (e) {
    console.error('❌ ERRO STL:', e);
    res.status(e.statusCode || 500).json({ error: e.message });
  } finally {
    if (scadFile) try { fs.unlinkSync(scadFile); } catch {}
    if (outFile) try { fs.unlinkSync(outFile); } catch {}
  }
});

app.listen(10000, () => {
  console.log('✅ STL backend a escutar na porta 10000');
});