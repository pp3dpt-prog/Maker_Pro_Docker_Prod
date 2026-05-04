import express from 'express';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { v4 as uuid } from 'uuid';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// ============================
// Diretório temporário
// ============================
const TMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// ============================
// Supabase
// ============================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================
// POST /api/preview
// ============================
router.post('/', async (req, res) => {
  try {
    const { design_id, params } = req.body;

    if (!design_id || !params) {
      console.error('❌ INVALID_REQUEST:', req.body);
      return res.status(400).send('INVALID_REQUEST');
    }

    // 1️⃣ Buscar template SCAD à BD
    const { data: design, error } = await supabase
      .from('prod_designs')
      .select('scad_template')
      .eq('id', design_id)
      .single();

    if (error || !design) {
      console.error('❌ DESIGN_NOT_FOUND:', design_id, error);
      return res.status(404).send('DESIGN_NOT_FOUND');
    }

    // 2️⃣ Gerar ficheiros temporários
    const jobId = uuid();
    const scadPath = path.join(TMP_DIR, `${jobId}.scad`);
    const pngPath = path.join(TMP_DIR, `${jobId}.png`);

    const vars = Object.entries(params)
      .map(([k, v]) => {
        if (typeof v === 'string') return `${k} = "${v}";`;
        if (typeof v === 'boolean') return `${k} = ${v ? 1 : 0};`;
        return `${k} = ${v};`;
      })
      .join('\n');

    const finalScad = `
${vars}

${design.scad_template}

corpo_caixa();
if (tem_tampa == 1) {
  tampa_caixa();
}
`;

    fs.writeFileSync(scadPath, finalScad);

    // 3️⃣ OpenSCAD → PNG (HEADLESS)
    const p = spawn('openscad', [
      '--backend', 'cgal',     // ✅ ESSENCIAL EM SERVIDOR
      '--imgsize=800,600',
      '-o',
      pngPath,
      scadPath,
    ]);

    // Logs úteis (podes remover depois)
    p.stdout.on('data', data => {
      console.log('🟢 OPENSCAD STDOUT:', data.toString());
    });

    p.stderr.on('data', data => {
      console.error('🔴 OPENSCAD STDERR:', data.toString());
    });

    p.on('close', code => {
      console.log('🟡 OPENSCAD EXIT CODE:', code);

      if (code !== 0) {
        return res.status(500).send('OPENSCAD_FAILED');
      }

      return res.sendFile(pngPath);
    });

  } catch (err) {
    console.error('❌ PREVIEW_FAILED:', err);
    res.status(500).send('PREVIEW_FAILED');
  }
});

export default router;