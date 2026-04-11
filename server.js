
require('dotenv').config(); // ⬅️ OBRIGATÓRIO

const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const fs = require('fs');
const path = require('path');


const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

// Whitelist simples (ideal: vir da BD)
const ALLOWED_PRODUCTS = new Set([
  // mete aqui os IDs reais: "pet_tag_1", "box_param", ...
]);

const SAFE_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function stableStringify(obj) {
  // normalização determinística (ordena chaves)
  const keys = Object.keys(obj).sort();
  const out = {};
  for (const k of keys) out[k] = obj[k];
  return JSON.stringify(out);
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

app.post('/gerar-stl-pro', async (req, res) => {
  const { user_id, id: produtoId, ...params } = req.body;

  if (!user_id || !produtoId) {
    return res.status(400).json({ error: 'user_id e produtoId são obrigatórios.' });
  }

  // valida produto
  if (ALLOWED_PRODUCTS.size > 0 && !ALLOWED_PRODUCTS.has(produtoId)) {
    return res.status(400).json({ error: 'produtoId inválido.' });
  }

  // valida chaves e valores
  const sanitized = {};
  for (const [key, val] of Object.entries(params)) {
    if (key === 'id' || key === 'user_id') continue;
    if (!SAFE_KEY_RE.test(key)) {
      return res.status(400).json({ error: `Parâmetro inválido: ${key}` });
    }

    if (typeof val === 'string') {
      if (val.length > 64) return res.status(400).json({ error: `Texto demasiado longo em ${key}` });
      sanitized[key] = val;
    } else if (typeof val === 'number') {
      if (!Number.isFinite(val)) return res.status(400).json({ error: `Número inválido em ${key}` });
      sanitized[key] = val;
    } else if (typeof val === 'boolean') {
      sanitized[key] = val ? 1 : 0; // OpenSCAD gosta de 0/1
    } else {
      return res.status(400).json({ error: `Tipo inválido em ${key}` });
    }
  }

  // hash para cache/idempotência
  const paramsHash = sha256(produtoId + '|' + stableStringify(sanitized));

  // NOME DETERMINÍSTICO (evita duplicados e facilita cache)
  const outputName = `${produtoId}_${paramsHash}.stl`;
  const outputPath = path.join(tmpDir, outputName);

  const scadPath = path.join(__dirname, 'scads', `${produtoId}.scad`);

  // Se quiseres, antes de renderizar: tenta ver se já existe no storage
  const storagePath = `users/${user_id}/${outputName}`;

  try {
    // tenta criar signed URL se já existir (sem render)
    // (na prática: precisas de verificar existência; podes tentar download head ou listar)
    // aqui deixo como passo futuro para não complicar.

    // construir args do openscad (sem shell)
    const args = ['-o', outputPath];

    for (const [key, val] of Object.entries(sanitized)) {
      if (typeof val === 'string') {
        const escaped = val.replace(/"/g, '\\"');
        args.push('-D', `${key}="${escaped}"`);
      } else {
        args.push('-D', `${key}=${val}`);
      }
    }

    args.push(scadPath);

    const child = spawn('openscad', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString().slice(0, 2000); });

    const timeoutMs = 90_000;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, timeoutMs);

    const exitCode = await new Promise((resolve) => {
      child.on('close', (code) => resolve(code));
    });

    clearTimeout(timer);

    if (exitCode !== 0) {
      return res.status(500).json({ error: 'Falha ao processar o modelo 3D.', details: stderr });
    }

    // upload (async) — sem readFileSync
    const fileBuffer = await fsp.readFile(outputPath);

    const { error: upErr } = await supabase.storage
      .from('designs-vault')
      .upload(storagePath, fileBuffer, { contentType: 'model/stl', upsert: true });

    if (upErr) throw upErr;

    // URL assinado (privado)
    const { data: signed, error: signErr } = await supabase.storage
      .from('designs-vault')
      .createSignedUrl(storagePath, 120); // 2 min

    if (signErr) throw signErr;

    return res.json({ success: true, url: signed.signedUrl, paramsHash });

  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ error: 'Erro ao gerar/armazenar o ficheiro.' });
  } finally {
    // cleanup local (mesmo que falhe)
    try { await fsp.unlink(outputPath); } catch (_) {}
  }
});

app.listen(process.env.PORT || 10000, '0.0.0.0');