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
// Supabase
// ============================


const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// ============================
// Helpers
// ============================
async function getUser(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) throw new Error('UNAUTHORIZED');

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data || !data.user) throw new Error('UNAUTHORIZED');
  return data.user;
}

async function gerarSTL({ scadTemplate, params, moduleCall, outFile }) {
  const scadFile = outFile.replace('.stl', '.scad');

  const vars = Object.entries(params)
    .map(([k, v]) => `${k} = ${typeof v === 'string' ? `"${v}"` : v};`)
    .join('\n');

  fs.writeFileSync(
    scadFile,
    `${vars}\n\n${scadTemplate}\n\n${moduleCall}\n`
  );

  await new Promise((resolve, reject) => {
    const p = spawn(OPENSCAD_BIN, ['-o', outFile, scadFile]);
    p.on('close', code =>
      code === 0 ? resolve() : reject(new Error('OpenSCAD failed'))
    );
    p.on('error', reject);
  });
}

// ============================
// Route handler (Express)
// ============================
export async function downloadStl(req, res) {
  try {
    const user = await getUser(req);
    const { design_id, params } = req.body;

    if (!design_id || !params) {
      return res.status(400).send('INVALID_REQUEST');
    }

    // Fetch design
    const { data: design, error: designError } = await supabase
      .from('prod_designs')
      .select('scad_template, credit_cost')
      .eq('id', design_id)
      .single();

    if (designError || !design) {
      return res.status(404).send('DESIGN_NOT_FOUND');
    }

    
    if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
    console.error('Env vars em falta no runtime');
    return res.status(500).send('SERVER_MISCONFIGURED');
    }


    const cost = design.credit_cost ?? 1;

    // Check credits
    const { data: perfil } = await supabase
      .from('prod_perfis')
      .select('creditos_disponiveis')
      .eq('id', user.id)
      .single();

    if (!perfil || perfil.creditos_disponiveis < cost) {
      return res.status(402).send('INSUFFICIENT_CREDITS');
    }

    // Generate STL(s)
    const jobId = uuid();
    const base = path.join(TMP_DIR, jobId);
    const files = [];

    // Caixa
    const caixaPath = `${base}_caixa.stl`;
    await gerarSTL({
      scadTemplate: design.scad_template,
      params,
      moduleCall: 'corpo_caixa();',
      outFile: caixaPath,
    });
    files.push({ name: 'caixa.stl', path: caixaPath });

    // Tampa (boolean)
    if (params.tem_tampa === true) {
      const tampaPath = `${base}_tampa.stl`;
      await gerarSTL({
        scadTemplate: design.scad_template,
        params,
        moduleCall: 'tampa_caixa();',
        outFile: tampaPath,
      });
      files.push({ name: 'tampa.stl', path: tampaPath });
    }

    // Debit credits
    await supabase.from('prod_transacoes').insert({
      user_id: user.id,
      descricao: `Download STL (${design_id})`,
      creditos_alterados: -cost,
    });

    await supabase
      .from('prod_perfis')
      .update({
        creditos_disponiveis: perfil.creditos_disponiveis - cost,
      })
      .eq('id', user.id);

    // Respond
    if (files.length === 1) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${files[0].name}"`
      );
      return fs.createReadStream(files[0].path).pipe(res);
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    const zipStream = new PassThrough();

    archive.pipe(zipStream);
    files.forEach(f => archive.file(f.path, { name: f.name }));
    archive.finalize();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${design_id}.zip"`
    );

    zipStream.pipe(res);
  } catch (err) {
    console.error('DOWNLOAD_FAILED', err);
    res.status(500).send('DOWNLOAD_FAILED');
  }
}