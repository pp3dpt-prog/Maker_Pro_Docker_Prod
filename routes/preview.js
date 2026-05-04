import express from 'express';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { v4 as uuid } from 'uuid';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Diretório temporário
const TMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST /api/preview
router.post('/', async (req, res) => {
  try {
    const { design_id, params } = req.body;

    if (!design_id || !params) {
      return res.status(400).send('INVALID_REQUEST');
    }

    const { data: design, error } = await supabase
      .from('prod_designs')
      .select('scad_template')
      .eq('id', design_id)
      .single();

    if (error || !design) {
      return res.status(404).send('DESIGN_NOT_FOUND');
    }

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

    // ✅ OpenSCAD HEADLESS REAL
    const p = spawn('openscad', [
      '--preview=throwntogether',  // ✅ CHAVE
      '--viewall',
      '--imgsize=800,600',
      '-o',
      pngPath,
      scadPath,
    ]);

    p.stderr.on('data', data => {
      console.error('OPENSCAD STDERR:', data.toString());
    });

    p.on('close', code => {
      if (code !== 0) {
        return res.status(500).send('OPENSCAD_FAILED');
      }
      return res.sendFile(pngPath);
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('PREVIEW_FAILED');
  }
});

export default router;