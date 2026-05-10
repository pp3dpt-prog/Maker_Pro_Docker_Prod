import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import archiver from 'archiver';
import { v4 as uuid } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { PassThrough } from 'stream';

const OPENSCAD_BIN = 'openscad';
const TMP_DIR = path.join(process.cwd(), 'tmp');

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getUser(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) throw new Error('UNAUTHORIZED');
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new Error('UNAUTHORIZED');
  return data.user;
}

async function gerarSTL({ scadTemplate, params, outFile }) {
  const scadFile = outFile.replace('.stl', '.scad');

  const vars = Object.entries(params)
    .map(([k, v]) => `${k} = ${typeof v === 'string' ? `"${v}"` : v};`)
    .join('\n');

  fs.writeFileSync(scadFile, `${vars}\n\n${scadTemplate}\n`);

  await new Promise((resolve, reject) => {
    const p = spawn(OPENSCAD_BIN, ['-o', outFile, scadFile]);

    let stderrOutput = '';
    p.stderr.on('data', (data) => { stderrOutput += data.toString(); });

    const timeout = setTimeout(() => {
      p.kill();
      reject(new Error('OpenSCAD timeout após 60s'));
    }, 60000);

    p.on('close', code => {
      clearTimeout(timeout);
      if (stderrOutput) console.log('OpenSCAD stderr:', stderrOutput);
      if (code !== 0) {
        return reject(new Error(`OpenSCAD failed com código ${code}`));
      }
      resolve();
    });

    p.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  // Verificar se o STL foi criado
  if (!fs.existsSync(outFile)) {
    throw new Error(`STL não foi gerado: ${outFile}`);
  }
}

async function uploadToStorage(filePath, storagePath, mimeType) {
  try {
    const buffer = fs.readFileSync(filePath);
    const { error } = await supabase.storage
      .from('user-stls')
      .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

    if (error) {
      console.error('Erro no upload Storage:', error);
      return null;
    }

    const { data: signedData } = await supabase.storage
      .from('user-stls')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    return signedData?.signedUrl ?? null;
  } catch (err) {
    console.error('Erro uploadToStorage:', err);
    return null;
  }
}

function cleanupFiles(files) {
  files.forEach(f => {
    fs.unlink(f.path, () => {});
    const scad = f.path.replace('.stl', '.scad');
    fs.unlink(scad, () => {});
  });
}

export async function downloadStl(req, res) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).send('SERVER_MISCONFIGURED');
    }

    const user = await getUser(req);
    const { design_id, params } = req.body;

    console.log('Download request — design_id:', design_id, 'params:', JSON.stringify(params));

    if (!design_id || !params) {
      return res.status(400).send('INVALID_REQUEST');
    }

    // Buscar design
    const { data: design, error: designError } = await supabase
      .from('prod_designs')
      .select('scad_template, credit_cost, nome')
      .eq('id', design_id)
      .single();

    if (designError || !design) {
      console.error('Design não encontrado:', designError);
      return res.status(404).send('DESIGN_NOT_FOUND');
    }

    const cost = design.credit_cost ?? 0;

    // Verificar créditos
    const { data: perfil } = await supabase
      .from('prod_perfis')
      .select('creditos_disponiveis')
      .eq('id', user.id)
      .single();

    if (!perfil || perfil.creditos_disponiveis < cost) {
      return res.status(402).send('INSUFFICIENT_CREDITS');
    }

    // Normalizar params
    const paramsNormalizados = {
      ...params,
      tem_tampa: params.tem_tampa ? 1 : 0,
    };

    console.log('Params normalizados:', JSON.stringify(paramsNormalizados));

    // Gerar STL(s)
    const jobId = uuid();
    const base = path.join(TMP_DIR, jobId);
    const files = [];

    // Caixa (sempre)
    const caixaPath = `${base}_caixa.stl`;
    await gerarSTL({
      scadTemplate: design.scad_template,
      params: { ...paramsNormalizados, modo: 'corpo' },
      outFile: caixaPath,
    });
    files.push({ name: 'caixa.stl', path: caixaPath });
    console.log('✅ Caixa gerada:', fs.existsSync(caixaPath));

    // Tampa (opcional)
    if (params.tem_tampa) {
      const tampaPath = `${base}_tampa.stl`;
      await gerarSTL({
        scadTemplate: design.scad_template,
        params: { ...paramsNormalizados, modo: 'tampa' },
        outFile: tampaPath,
      });
      files.push({ name: 'tampa.stl', path: tampaPath });
      console.log('✅ Tampa gerada:', fs.existsSync(tampaPath));
    }

    // Debitar créditos
    if (cost > 0) {
      await supabase
        .from('prod_perfis')
        .update({ creditos_disponiveis: perfil.creditos_disponiveis - cost })
        .eq('id', user.id);

      await supabase.from('prod_transacoes').insert({
        user_id: user.id,
        descricao: `Download STL: ${design.nome}`,
        creditos_alterados: -cost,
      });
    }

    // Incrementar total_downloads
    await supabase.rpc('increment_downloads', { design_id });

    // Upload para Storage
    const isZip = files.length > 1;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = isZip
      ? `${design_id}_${timestamp}.zip`
      : `${design_id}_${timestamp}.stl`;
    const storagePath = `${user.id}/${fileName}`;

    let fileUrl = null;

    if (isZip) {
      // Criar ZIP em disco para upload
      const zipPath = `${base}.zip`;
      await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(output);
        files.forEach(f => archive.file(f.path, { name: f.name }));
        archive.finalize();
        output.on('close', resolve);
        archive.on('error', reject);
      });
      fileUrl = await uploadToStorage(zipPath, storagePath, 'application/zip');
      fs.unlink(zipPath, () => {});
    } else {
      fileUrl = await uploadToStorage(files[0].path, storagePath, 'model/stl');
    }

    // Guardar em prod_user_assets
    if (fileUrl) {
      await supabase.from('prod_user_assets').upsert(
        {
          user_id: user.id,
          design_id: design_id,
          stl_url: fileUrl,
          scad_vault_path: storagePath,
          last_rendered_at: new Date().toISOString(),
          is_archived: false,
        },
        { onConflict: 'user_id,design_id' }
      );
    }

    // Registar em prod_downloads_log
    await supabase.from('prod_downloads_log').insert({
      email: user.email,
      file_url: fileUrl,
      shape_type: design_id,
      custom_name: design.nome,
    });

    // ── Enviar resposta ao browser ──
    if (!isZip) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${files[0].name}"`);

      const stream = fs.createReadStream(files[0].path);
      stream.pipe(res);

      // Limpar só depois de enviar
      res.on('finish', () => cleanupFiles(files));
      return;
    }

    // ZIP — criar novo arquivo para enviar ao browser
    const archive = archiver('zip', { zlib: { level: 9 } });
    const zipStream = new PassThrough();

    archive.pipe(zipStream);
    files.forEach(f => archive.file(f.path, { name: f.name }));
    archive.finalize();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${design_id}.zip"`);
    zipStream.pipe(res);

    // Limpar só depois de enviar
    res.on('finish', () => cleanupFiles(files));

  } catch (err) {
    console.error('DOWNLOAD_FAILED', err);
    res.status(500).send('DOWNLOAD_FAILED');
  }
}
