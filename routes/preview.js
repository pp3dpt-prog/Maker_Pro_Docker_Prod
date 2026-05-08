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

// POST /api/preview (agora gera STL)
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
    const stlPath = path.join(TMP_DIR, `${jobId}.stl`);

    const vars = Object.entries(params)
      .map(([k, v]) => {
        if (typeof v === 'string') return `${k} = "${v}";`;
        if (typeof v === 'boolean') return `${k} = ${v ? 1 : 0};`;
        return `${k} = ${v};`;
      })
      .join('\n');

    fs.writeFileSync(
      scadPath,
      `${vars}\n\n${design.scad_template}\n\n${design.scad_template}\n`
    );

    // ✅ OpenSCAD → STL (headless, estável)
    const p = spawn('openscad', ['-o', stlPath, scadPath]);

    p.on('close', code => {
      if (code !== 0) {
        return res.status(500).send('OPENSCAD_FAILED');
      }

      res.setHeader('Content-Type', 'model/stl');
      res.setHeader('Cache-Control', 'no-store');

      return res.sendFile(stlPath);
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('PREVIEW_FAILED');
  }
});

export default router;