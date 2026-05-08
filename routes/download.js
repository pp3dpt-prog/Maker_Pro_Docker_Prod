import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import archiver from 'archiver';
import { v4 as uuid } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { PassThrough } from 'stream';

// ============================
// Config
// ============================
const OPENSCAD_BIN = 'openscad';
const TMP_DIR = path.join(process.cwd(), 'tmp');

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// ============================
// Supabase client
// ============================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================
// Helpers
// ============================
async function getUser(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) throw new Error('UNAUTHORIZED');

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data || !data.user) {
    throw new Error('UNAUTHORIZED');
  }

  return data.user;
}

async function gerarSTL({ scadTemplate, params, outFile }) {
  const scadFile = outFile.replace('.stl', '.scad');

  const vars = Object.entries(params)
    .map(([k, v]) => `${k} = ${typeof v === 'string' ? `"${v}"` : v};`)
    .join('\n');

  const scadContent = `${vars}\n\n${scadTemplate}\n`;

  fs.writeFileSync(scadFile, scadContent);

  // ✅ Log do ficheiro SCAD gerado
  console.log('--- SCAD FILE:', scadFile, '---');
  console.log(scadContent);
  console.log('--- FIM SCAD ---');

  await new Promise((resolve, reject) => {
    const p = spawn(OPENSCAD_BIN, ['-o', outFile, scadFile]);

    let stderrOutput = '';
    p.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });

    p.on('close', code => {
      console.log('OpenSCAD exit code:', code);
      if (stderrOutput) {
        console.log('OpenSCAD stderr:', stderrOutput);
      }
      if (code !== 0) {
        return reject(new Error(`OpenSCAD failed com código ${code}`));
      }
      resolve();
    });

    p.on('error', (err) => {
      console.error('Erro ao lançar OpenSCAD:', err);
      reject(err);
    });
  });
}

// ============================
// Route (Express handler)
// ============================
export async function downloadStl(req, res) {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      console.error('SERVER_MISCONFIGURED: missing Supabase env vars');
      return res.status(500).send('SERVER_MISCONFIGURED');
    }

    const user = await getUser(req);
    const { design_id, params } = req.body;

    console.log('Download request — design_id:', design_id, 'params:', params);

    if (!design_id || !params) {
      return res.status(400).send('INVALID_REQUEST');
    }

    // ----------------------------
    // Fetch design
    // ----------------------------
    const { data: design, error: designError } = await supabase
      .from('prod_designs')
      .select('scad_template, credit_cost')
      .eq('id', design_id)
      .single();

    if (designError || !design) {
      console.error('Design não encontrado:', designError);
      return res.status(404).send('DESIGN_NOT_FOUND');
    }

    const cost = design.credit_cost ?? 0;

    // ----------------------------
    // Check credits
    // ----------------------------
    const { data: perfil } = await supabase
      .from('prod_perfis')
      .select('creditos_disponiveis')
      .eq('id', user.id)
      .single();

    if (!perfil || perfil.creditos_disponiveis < cost) {
      return res.status(402).send('INSUFFICIENT_CREDITS');
    }

    // ----------------------------
    // Generate STL(s)
    // ----------------------------
    const jobId = uuid();
    const base = path.join(TMP_DIR, jobId);
    const files = [];

    // Normalizar tem_tampa para inteiro (OpenSCAD não entende true/false)
    const paramsNormalizados = {
      ...params,
      tem_tampa: params.tem_tampa ? 1 : 0,
    };

    // Caixa (sempre) — injeta modo="corpo" antes do template
    const caixaPath = `${base}_caixa.stl`;
    console.log('A gerar caixa...');
    await gerarSTL({
      scadTemplate: design.scad_template,
      params: { ...paramsNormalizados, modo: '"corpo"' },
      outFile: caixaPath,
    });
    console.log('✅ Caixa gerada:', fs.existsSync(caixaPath));
    files.push({ name: 'caixa.stl', path: caixaPath });

    // Tampa (opcional)
    if (params.tem_tampa) {
      const tampaPath = `${base}_tampa.stl`;
      console.log('A gerar tampa...');
      await gerarSTL({
        scadTemplate: design.scad_template,
        params: { ...paramsNormalizados, modo: '"tampa"' },
        outFile: tampaPath,
      });
      console.log('✅ Tampa gerada:', fs.existsSync(tampaPath));
      files.push({ name: 'tampa.stl', path: tampaPath });
    }

    // ----------------------------
    // Debit credits
    // ----------------------------
    if (cost > 0) {
      await supabase.from('prod_transacoes').insert({
        user_id: user.id,
        descricao: `Download STL (${design_id})`,
        creditos_alterados: -cost,
      });

      await supabase
        .from('prod_perfis')
        .update({ creditos_disponiveis: perfil.creditos_disponiveis - cost })
        .eq('id', user.id);
    }

    // ----------------------------
    // Respond download
    // ----------------------------
    if (files.length === 1) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${files[0].name}"`);
      return fs.createReadStream(files[0].path).pipe(res);
    }

    // ZIP (2 STLs)
    const archive = archiver('zip', { zlib: { level: 9 } });
    const zipStream = new PassThrough();

    archive.pipe(zipStream);
    files.forEach(f => archive.file(f.path, { name: f.name }));
    archive.finalize();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${design_id}.zip"`);

    zipStream.pipe(res);

  } catch (err) {
    console.error('DOWNLOAD_FAILED', err);
    res.status(500).send('DOWNLOAD_FAILED');
  }
}