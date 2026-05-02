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

console.log('✅ Backend STL a iniciar');
console.log('OPENSCAD_BIN:', OPENSCAD_BIN);

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

console.log('TMP DIR:', tmpDir);

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

function buildWrapper({ entry, params, mode, schema }) {
  const lines = [];
  lines.push('// AUTO-GENERATED — DEBUG ENABLED\n');

  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') {
      lines.push(`${k}="${v.replace(/"/g, '\\"')}";`);
    } else {
      lines.push(`${k}=${v};`);
    }
  }

  const q = schema.modes?.[mode]?.quality_fn;
  if (q) {
    lines.push(`quality_fn=${q};`);
    lines.push(`$fn=quality_fn;`);
  }

  lines.push(`use <${entry}>;`);
  lines.push(`render();`);

  return lines.join('\n');
}

/* ================= HEALTH ================= */

app.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/* ================= ROUTE ================= */

app.post('/gerar-stl-pro', async (req, res) => {
  let scadFile, outFile;

  try {
    console.log('\n🚀 NOVO PEDIDO /gerar-stl-pro');

    const { id, mode = 'final', params } = req.body || {};
    console.log('Body recebido:', req.body);

    if (!id) {
      return res.status(400).json({ error: 'id required' });
    }

    const user = await getUser(req);
    console.log('Utilizador:', user.id);

    const { data: design } = await supabase
      .from(DESIGNS_TABLE)
      .select('generation_schema')
      .eq('id', id)
      .maybeSingle();

    if (!design?.generation_schema) {
      return res.status(404).json({ error: 'Design not found' });
    }

    const schema = design.generation_schema;
    console.log('Schema entry:', schema.entry);

    const normalized = normalizeParams(schema, params);
    console.log('Params normalizados:', normalized);

    const wrapper = buildWrapper({
      entry: schema.entry,
      params: normalized,
      mode,
      schema
    });

    const hash = sha256(id + stable(normalized) + mode);
    scadFile = path.join(tmpDir, `${hash}.scad`);
    outFile = path.join(tmpDir, `${hash}.stl`);

    console.log('SCAD:', scadFile);
    console.log('STL:', outFile);

    await fsp.writeFile(scadFile, wrapper);

    await new Promise((resolve, reject) => {
      console.log('🛠 A executar OpenSCAD…');

      const p = spawn(OPENSCAD_BIN, ['-o', outFile, scadFile]);

      const t = setTimeout(() => {
        console.error('⏱ TIMEOUT OpenSCAD');
        p.kill('SIGKILL');
      }, OPENSCAD_TIMEOUT_MS);

      p.stdout.on('data', d => {
        console.log('[OpenSCAD STDOUT]', d.toString());
      });

      p.stderr.on('data', d => {
        console.error('[OpenSCAD STDERR]', d.toString());
      });

      p.on('close', code => {
        clearTimeout(t);
        if (code === 0) {
          console.log('✅ OpenSCAD terminou com sucesso');
          resolve();
        } else {
          reject(new Error(`OpenSCAD exit code ${code}`));
        }
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

    console.log('✅ STL gerado com sucesso');

    res.json({
      success: true,
      url: signed.signedUrl
    });
  } catch (e) {
    console.error('❌ ERRO GERAÇÃO STL:', e);
    res.status(e.statusCode || 500).json({ error: e.message });
  } finally {
    if (scadFile) try { fs.unlinkSync(scadFile); } catch {}
    if (outFile) try { fs.unlinkSync(outFile); } catch {}
  }
});

app.listen(10000, () => {
  console.log('✅ STL backend a escutar na porta 10000');
});