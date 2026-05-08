import express from 'express';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { v4 as uuid } from 'uuid';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const TMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.post('/', async (req, res) => {
  try {
    const { design_id, params } = req.body;

    console.log('Preview params recebidos:', JSON.stringify(params));

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

    // Normalizar parâmetros
    // Normalizar tem_tampa explicitamente
    const paramsNormalizados = {
      ...params,
      tem_tampa: params.tem_tampa ? 1 : 0,
    };

    const vars = Object.entries(paramsNormalizados)
      .map(([k, v]) => {
        if (typeof v === 'string') return `${k} = "${v}";`;
        return `${k} = ${v};`;
      })
      .join('\n');

    // Para preview não injetamos modo — o template usa "preview" por defeito
    // MAS o template já não tem modo declarado, então temos de injetar
    fs.writeFileSync(
      scadPath,
      `${vars}\nmodo = "preview";\n\n${design.scad_template}\n`
    );

    const p = spawn('openscad', ['-o', stlPath, scadPath]);

    let stderrOutput = '';
    p.stderr.on('data', (data) => { stderrOutput += data.toString(); });

    p.on('close', code => {
      if (code !== 0) {
        console.error('OpenSCAD preview failed:', stderrOutput);
        return res.status(500).send('OPENSCAD_FAILED');
      }

      // ✅ Ler o ficheiro e enviar como buffer — mais fiável que sendFile
      const buffer = fs.readFileSync(stlPath);
      res.setHeader('Content-Type', 'model/stl');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Length', buffer.length);
      res.end(buffer);

      // Limpar ficheiros temporários
      fs.unlink(scadPath, () => {});
      fs.unlink(stlPath, () => {});
    });

  } catch (err) {
    console.error('PREVIEW_FAILED:', err);
    res.status(500).send('PREVIEW_FAILED');
  }
});

export default router;