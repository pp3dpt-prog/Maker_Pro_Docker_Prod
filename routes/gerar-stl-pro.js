import express from 'express';
import fs from 'fs';
import path from 'path';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { v4 as uuid } from 'uuid';
import { createClient } from '@supabase/supabase-js';

const execFileAsync = promisify(execFile);
const router = express.Router();

const TMP_DIR = path.join(process.cwd(), 'temp');
const BUCKET = 'makers_pro_stl_prod';

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getUser(req) {
  const auth = req.headers['authorization'];
  if (!auth) throw new Error('UNAUTHORIZED');
  const token = auth.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new Error('UNAUTHORIZED');
  return data.user;
}

// Descarrega ficheiro do Supabase (bucket público) e guarda em destPath
async function downloadFile(storagePath, destPath) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const url = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ao descarregar imagem (${res.status}): ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

// Converte qualquer imagem para PNG usando ImageMagick
async function toPng(srcPath, destPath) {
  await execFileAsync('convert', [srcPath, destPath]);
}

// Corre o OpenSCAD e gera um STL
function runOpenSCAD(scadPath, stlPath) {
  return new Promise((resolve, reject) => {
    const p = spawn('openscad', ['-o', stlPath, scadPath]);
    let stderr = '';
    p.stderr.on('data', d => { stderr += d.toString(); });
    const timeout = setTimeout(() => { p.kill(); reject(new Error('OpenSCAD timeout (60s)')); }, 60_000);
    p.on('close', code => {
      clearTimeout(timeout);
      if (stderr) console.log('OpenSCAD stderr:', stderr);
      if (code !== 0) return reject(new Error(`OpenSCAD falhou (código ${code}):\n${stderr}`));
      resolve();
    });
    p.on('error', err => { clearTimeout(timeout); reject(err); });
  });
}

function cleanup(...files) {
  files.forEach(f => f && fs.unlink(f, () => {}));
}

router.post('/', async (req, res) => {
  const jobId = uuid();
  const scadPath = path.join(TMP_DIR, `${jobId}.scad`);
  const stlPath  = path.join(TMP_DIR, `${jobId}.stl`);
  let   imgRaw   = null; // caminho da imagem descarregada
  let   imgPng   = null; // caminho da imagem em PNG (pronta para surface())

  try {
    const user = await getUser(req);
    const { id, mode = 'preview', image_path, ...otherParams } = req.body;

    if (!id) return res.status(400).json({ error: 'id é obrigatório' });

    // Validar image_path
    if (image_path && !image_path.startsWith('uploads/')) {
      return res.status(400).json({ error: 'image_path deve começar com "uploads/".' });
    }

    // Buscar design no Supabase
    const { data: design, error: designError } = await supabase
      .from('prod_designs')
      .select('scad_template, familia')
      .eq('id', id)
      .single();

    if (designError || !design) {
      return res.status(404).json({ error: 'DESIGN_NOT_FOUND' });
    }

    // Processar imagem se existir
    if (image_path) {
      const ext = image_path.split('.').pop()?.toLowerCase() || 'jpg';
      imgRaw = path.join(TMP_DIR, `${jobId}_raw.${ext}`);
      imgPng = path.join(TMP_DIR, `${jobId}_input.png`);

      await downloadFile(image_path, imgRaw);

      if (ext === 'png') {
        fs.copyFileSync(imgRaw, imgPng);
      } else {
        // JPG, SVG, etc. → converter para PNG via ImageMagick
        await toPng(imgRaw, imgPng);
      }

      console.log(`✅ Imagem pronta: ${imgPng}`);
    }

    // Montar variáveis SCAD
    const vars = Object.entries(otherParams)
      .map(([k, v]) => (typeof v === 'string' ? `${k} = "${v}";` : `${k} = ${v};`))
      .join('\n');

    // image_file aponta para o PNG local — o template usa surface(image_file)
    const imageVar = imgPng ? `image_file = "${imgPng}";` : '';

    const scadContent = `${vars}\n${imageVar}\nmodo = "${mode}";\n\n${design.scad_template}\n`;
    fs.writeFileSync(scadPath, scadContent);
    console.log('--- SCAD ---\n', scadContent.slice(0, 400), '\n---');

    await runOpenSCAD(scadPath, stlPath);

    if (!fs.existsSync(stlPath)) throw new Error('STL não foi gerado');

    // Upload STL para Supabase
    const storagePath = `previews/${user.id}/${jobId}.stl`;
    const stlBuffer   = fs.readFileSync(stlPath);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, stlBuffer, { contentType: 'model/stl', upsert: true });

    if (uploadError) throw new Error(`Erro no upload do STL: ${uploadError.message}`);

    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 3600);

    cleanup(scadPath, stlPath, imgRaw, imgPng);

    return res.json({ success: true, url: signed?.signedUrl ?? null, storagePath });

  } catch (err) {
    console.error('gerar-stl-pro error:', err.message);
    cleanup(scadPath, stlPath, imgRaw, imgPng);

    if (err.message === 'UNAUTHORIZED') return res.status(401).json({ error: 'UNAUTHORIZED' });
    return res.status(500).json({ error: err.message, details: err.stack });
  }
});

export default router;
