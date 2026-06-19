import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import archiver from 'archiver';
import { v4 as uuid } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { PassThrough } from 'stream';
import Jimp from 'jimp';
import { generateHueforgeStl, generateBookmarkStl, generateLithophaneFlatStl, generateLithophaneCurvedStl } from '../app/hueforge-stl.js';
import { frameImage, aspectForFamily } from '../app/image-proc.js';
import { buildHueforgeTxt }   from './gerar-stl-pro.js';

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

  if (!fs.existsSync(outFile)) {
    throw new Error(`STL não foi gerado: ${outFile}`);
  }
}

async function uploadToStorage(filePath, storagePath, mimeType) {
  try {
    console.log('A fazer upload para Storage:', storagePath);
    const buffer = fs.readFileSync(filePath);
    console.log('Tamanho do buffer:', buffer.length, 'bytes');

    const { error } = await supabase.storage
      .from('user-stls')
      .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

    if (error) {
      console.error('Erro no upload Storage:', JSON.stringify(error));
      return null;
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from('user-stls')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    if (signedError) {
      console.error('Erro ao criar URL assinado:', JSON.stringify(signedError));
      return null;
    }

    console.log('✅ Upload OK');
    return signedData?.signedUrl ?? null;
  } catch (err) {
    console.error('Erro uploadToStorage:', err);
    return null;
  }
}

function cleanupFiles(files) {
  files.forEach(f => {
    fs.unlink(f.path, () => {});
    fs.unlink(f.path.replace('.stl', '.scad'), () => {});
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
      .select('scad_template, nome, familia, acesso_maker, requer_licenca_comercial')
      .eq('id', design_id)
      .single();

    if (designError || !design) {
      console.error('Design não encontrado:', designError);
      return res.status(404).send('DESIGN_NOT_FOUND');
    }

    // Verificar plano e limite de downloads
    const { data: perfil } = await supabase
      .from('prod_perfis')
      .select('plano, downloads_mes, downloads_limite, downloads_comprados')
      .eq('id', user.id)
      .single();

    if (!perfil) return res.status(402).send('PROFILE_NOT_FOUND');

    // Pode descarregar se tiver downloads comprados (avulsos) OU quota mensal disponível
    const temComprados = (perfil.downloads_comprados ?? 0) > 0;
    const temQuota     = perfil.downloads_mes < perfil.downloads_limite;
    if (!temComprados && !temQuota) {
      return res.status(402).send('DOWNLOAD_LIMIT_REACHED');
    }

    // Normalizar params
    const paramsNormalizados = {
      ...params,
      tem_tampa: params.tem_tampa ? 1 : 0,
    };

    // Processar imagem se existir (HueForge e portachaves com imagem)
    const tempImageFiles = [];
    if (typeof paramsNormalizados.image_path === 'string' && paramsNormalizados.image_path.startsWith('uploads/')) {
      const imgUid = uuid();
      const rawPath  = path.join(TMP_DIR, `img_raw_${imgUid}.png`);
      const procPath = path.join(TMP_DIR, `img_proc_${imgUid}.png`);
      tempImageFiles.push(rawPath, procPath);

      // Descarregar do Supabase Storage
      const { data: imgData, error: imgErr } = await supabase.storage
        .from('makers_pro_stl_prod')
        .download(paramsNormalizados.image_path);
      if (imgErr || !imgData) throw new Error(`Erro ao descarregar imagem: ${imgErr?.message}`);
      await fsp.writeFile(rawPath, Buffer.from(await imgData.arrayBuffer()));

      // Enquadrar (igual ao preview: ajuste/zoom/posição). 100px no lado maior.
      const familiaImg = String(design.familia || '').toLowerCase();
      const rawImg = await Jimp.read(rawPath);
      const img = await frameImage(rawImg, {
        targetLong: 100,
        aspect: aspectForFamily(familiaImg, paramsNormalizados),
        fit: paramsNormalizados.img_ajuste ?? 'Esticar',
        zoom: paramsNormalizados.img_zoom,
        posX: paramsNormalizados.img_pos_x,
        posY: paramsNormalizados.img_pos_y,
      });
      // Ajustes de imagem
      const contraste = Number(paramsNormalizados.contraste ?? 0);
      const brilho    = Number(paramsNormalizados.brilho    ?? 0);
      if (contraste !== 0) img.contrast(Math.max(-1, Math.min(1, contraste)));
      if (brilho    !== 0) img.brightness(Math.max(-1, Math.min(1, brilho)));

      // ── Modo cor ou P&B ───────────────────────────────────────────────
      const numCores = Math.max(2, Math.min(6, Number(paramsNormalizados.num_cores ?? 4)));
      const n = numCores;
      const iw = img.getWidth(), ih = img.getHeight();
      const modoCor = paramsNormalizados.modo_cor === true || paramsNormalizados.modo_cor === 1;

      if (modoCor) {
        const pixels = [];
        img.scan(0, 0, iw, ih, function (x, y, idx) {
          pixels.push([this.bitmap.data[idx], this.bitmap.data[idx+1], this.bitmap.data[idx+2]]);
        });
        // k-means++ para centros iniciais mais distintos
        let centers = [pixels[Math.floor(Math.random() * pixels.length)].slice()];
        while (centers.length < n) {
          const dists = pixels.map(([r,g,b]) => Math.min(...centers.map(([cr,cg,cb]) => (r-cr)**2+(g-cg)**2+(b-cb)**2)));
          const total = dists.reduce((a,b) => a+b, 0);
          let rr = Math.random() * total;
          let chosen = pixels[pixels.length-1].slice();
          for (let i = 0; i < pixels.length; i++) { rr -= dists[i]; if (rr <= 0) { chosen = pixels[i].slice(); break; } }
          centers.push(chosen);
        }
        for (let iter = 0; iter < 20; iter++) {
          const sums = Array.from({ length: n }, () => [0, 0, 0]);
          const counts = new Array(n).fill(0);
          for (const [r, g, b] of pixels) {
            let best = 0, bestD = Infinity;
            for (let i = 0; i < n; i++) {
              const d = (r-centers[i][0])**2 + (g-centers[i][1])**2 + (b-centers[i][2])**2;
              if (d < bestD) { bestD = d; best = i; }
            }
            sums[best][0] += r; sums[best][1] += g; sums[best][2] += b;
            counts[best]++;
          }
          centers = centers.map((c, i) => counts[i] > 0
            ? [sums[i][0]/counts[i], sums[i][1]/counts[i], sums[i][2]/counts[i]]
            : c);
        }
        const lum = ([r, g, b]) => 0.299*r + 0.587*g + 0.114*b;
        centers.sort((a, b) => lum(a) - lum(b));
        let pi = 0;
        img.scan(0, 0, iw, ih, function (x, y, idx) {
          const [r, g, b] = pixels[pi++];
          let best = 0, bestD = Infinity;
          for (let i = 0; i < n; i++) {
            const d = (r-centers[i][0])**2 + (g-centers[i][1])**2 + (b-centers[i][2])**2;
            if (d < bestD) { bestD = d; best = i; }
          }
          const q = n === 1 ? 0 : Math.round(best / (n - 1) * 255);
          this.bitmap.data[idx] = this.bitmap.data[idx+1] = this.bitmap.data[idx+2] = q;
        });
      } else {
        // grayscale + auto-contraste: imagens de baixo contraste deixam de
        // sair todas no mesmo nível (relevo plano).
        img.grayscale();
        img.normalize();
        img.scan(0, 0, iw, ih, function (x, y, idx) {
          const gray  = this.bitmap.data[idx];
          const level = Math.min(Math.floor(gray / 256 * n), n - 1);
          const q     = n === 1 ? 0 : Math.round(level / (n - 1) * 255);
          this.bitmap.data[idx] = this.bitmap.data[idx+1] = this.bitmap.data[idx+2] = q;
        });
      }

      await img.writeAsync(procPath);

      paramsNormalizados.image_path = procPath;
      paramsNormalizados.image_w    = img.getWidth();
      paramsNormalizados.image_h    = img.getHeight();
    }

    // Gerar STL(s) conforme a família
    const jobId = uuid();
    const base = path.join(TMP_DIR, jobId);
    const files = [];

    const JS_FAMILIES_DL = ['hueforge', 'marcadores', 'portachaves', 'litofania', 'litofania-curva'];
    const isHueforgeFamily = JS_FAMILIES_DL.includes(String(design.familia || '').toLowerCase());
    const isCaixa = design.familia === 'caixas';
    const isLetras = design.familia === 'letras-decorativas';
    const isCaixaLuz = design.familia === 'letras-caixa-luz';

    if (isHueforgeFamily && typeof paramsNormalizados.image_path === 'string' && paramsNormalizados.image_path.startsWith('/')) {
      // HueForge: gerar STL com JS puro (imagem já processada acima)
      const img = await Jimp.read(paramsNormalizados.image_path);
      const w = img.getWidth(), h = img.getHeight();
      const heightmap = Array.from({ length: h }, (_, r) =>
        Array.from({ length: w }, (_, c) => {
          const idx = img.getPixelIndex(c, r);
          return img.bitmap.data[idx] / 255;
        })
      );
      const familiaLower = String(design.familia || '').toLowerCase();
      let stlBuffer;
      if (familiaLower === 'marcadores' || familiaLower === 'portachaves') {
        const largura = Number(paramsNormalizados.largura ?? paramsNormalizados.largura_mm ?? (familiaLower === 'portachaves' ? 55 : 20));
        const altura  = Number(paramsNormalizados.altura  ?? paramsNormalizados.altura_mm  ?? (familiaLower === 'portachaves' ? 35 : 150));
        stlBuffer = generateBookmarkStl({
          heightmap, largura, altura,
          espBase:   Number(paramsNormalizados.espessura ?? paramsNormalizados.espessura_base ?? (familiaLower === 'portachaves' ? 3.5 : 0.6)),
          altRelevo: Number(paramsNormalizados.relevo    ?? paramsNormalizados.altura_relevo  ?? 1.5),
          holeDiameter:  familiaLower === 'portachaves' ? 5 : Number(paramsNormalizados.hole_diameter ?? 4),
          holeMarginTop: familiaLower === 'portachaves' ? 4 : Number(paramsNormalizados.hole_margin_top ?? 6),
        });
      } else if (familiaLower === 'litofania') {
        stlBuffer = generateLithophaneFlatStl({ heightmap,
          largura: Number(paramsNormalizados.largura_mm ?? 150),
          altura:  Number(paramsNormalizados.altura_mm  ?? 150),
          espMax:  Number(paramsNormalizados.esp_max ?? 3.0),
          espMin:  Number(paramsNormalizados.esp_min ?? 0.6) });
      } else if (familiaLower === 'litofania-curva') {
        stlBuffer = generateLithophaneCurvedStl({ heightmap,
          alturaMm: Number(paramsNormalizados.altura_mm ?? 150),
          raio:     Number(paramsNormalizados.raio   ?? 50),
          angulo:   Number(paramsNormalizados.angulo ?? 270),
          espMax:   Number(paramsNormalizados.esp_max ?? 3.0),
          espMin:   Number(paramsNormalizados.esp_min ?? 0.6) });
      } else {
        stlBuffer = generateHueforgeStl({
          heightmap,
          largura: Number(paramsNormalizados.largura_mm ?? 100),
          altura:  Number(paramsNormalizados.altura_mm  ?? 100),
          espBase: Number(paramsNormalizados.espessura_base ?? 1.0),
          altRelevo: Number(paramsNormalizados.altura_relevo ?? 2.0),
        });
      }
      const stlPath = `${base}.stl`;
      await fsp.writeFile(stlPath, stlBuffer);
      files.push({ name: `${design_id}.stl`, path: stlPath });

      // Gerar TXT e incluir no ZIP
      const txtContent = buildHueforgeTxt({
        numCores    : Number(paramsNormalizados.num_cores      ?? 4),
        layerHeight : Number(paramsNormalizados.layer_height   ?? 0.16),
        espessuraBase: Number(paramsNormalizados.espessura_base ?? 1.0),
        alturaRelevo : Number(paramsNormalizados.altura_relevo  ?? 2.0),
        larguraMm   : Number(paramsNormalizados.largura_mm     ?? 100),
        alturaMm    : Number(paramsNormalizados.altura_mm      ?? 100),
      });
      const txtPath = `${base}_hueforge.txt`;
      await fsp.writeFile(txtPath, txtContent, 'ascii');
      files.push({ name: 'hueforge_cores.txt', path: txtPath });
    } else if (isCaixa) {
      // Caixa — usa modo="corpo" e modo="tampa"
      const caixaPath = `${base}_caixa.stl`;
      await gerarSTL({
        scadTemplate: design.scad_template,
        params: { ...paramsNormalizados, modo: 'corpo' },
        outFile: caixaPath,
      });
      files.push({ name: 'caixa.stl', path: caixaPath });
      console.log('✅ Caixa gerada:', fs.existsSync(caixaPath));

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
    } else if (isCaixaLuz) {
      // Caixa de Luz com letra inicial — 3 partes: base LED, tampa difusora, letras do nome
      const basePath = `${base}_base.stl`;
      await gerarSTL({ scadTemplate: design.scad_template, params: { ...paramsNormalizados, modo: 'corpo' }, outFile: basePath });
      files.push({ name: 'base_led.stl', path: basePath });

      const tampaPath = `${base}_tampa.stl`;
      await gerarSTL({ scadTemplate: design.scad_template, params: { ...paramsNormalizados, modo: 'tampa' }, outFile: tampaPath });
      files.push({ name: 'tampa_difusora.stl', path: tampaPath });

      const nomePath = `${base}_nome.stl`;
      await gerarSTL({ scadTemplate: design.scad_template, params: { ...paramsNormalizados, modo: 'nome' }, outFile: nomePath });
      files.push({ name: 'letras_nome.stl', path: nomePath });

    } else if (isLetras) {
      const letraPath = `${base}_letra.stl`;
      await gerarSTL({
        scadTemplate: design.scad_template,
        params: { ...paramsNormalizados, modo: 'corpo' },
        outFile: letraPath,
      });
      files.push({ name: 'letra_inicial.stl', path: letraPath });

      const nomePath = `${base}_nome.stl`;
      await gerarSTL({
        scadTemplate: design.scad_template,
        params: { ...paramsNormalizados, modo: 'tampa' },
        outFile: nomePath,
      });
      files.push({ name: 'nome_decorativo.stl', path: nomePath });

      // Tampa traseira (fecha a caixa de luz) — só se o produto a pedir.
      if (paramsNormalizados.tem_traseira === true || paramsNormalizados.tem_traseira === 1) {
        const trasPath = `${base}_traseira.stl`;
        await gerarSTL({
          scadTemplate: design.scad_template,
          params: { ...paramsNormalizados, modo: 'traseira' },
          outFile: trasPath,
        });
        files.push({ name: 'tampa_traseira.stl', path: trasPath });
      }
    } else {
      // Pet-tags e outros — gera diretamente sem modo
      const stlPath = `${base}.stl`;
      await gerarSTL({
        scadTemplate: design.scad_template,
        params: paramsNormalizados,
        outFile: stlPath,
      });
      files.push({ name: `${design_id}.stl`, path: stlPath });
      console.log('✅ STL gerado:', fs.existsSync(stlPath));
    }

    // Incrementar contador de downloads do utilizador
    // Consumir primeiro os downloads comprados; só depois a quota mensal
    if (temComprados) {
      await supabase
        .from('prod_perfis')
        .update({ downloads_comprados: perfil.downloads_comprados - 1 })
        .eq('id', user.id);
    } else {
      await supabase
        .from('prod_perfis')
        .update({ downloads_mes: perfil.downloads_mes + 1 })
        .eq('id', user.id);
    }

    // Incrementar total_downloads no design
    const { error: rpcError } = await supabase.rpc('increment_downloads', { design_id });
    if (rpcError) {
      console.error('Erro ao incrementar downloads:', JSON.stringify(rpcError));
    } else {
      console.log('✅ total_downloads incrementado');
    }

    // Contar downloads anteriores para nome único
    const { count: downloadCount } = await supabase
      .from('prod_user_assets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('design_id', design_id);

    const numeroDownload = (downloadCount ?? 0) + 1;
    const nomeUnico = `${design.nome} — Download #${numeroDownload}`;

    // Upload para Storage
    const isZip = files.length > 1;
    const timestamp = `${Date.now()}`; // milissegundos — sempre único
    const fileName = isZip
      ? `${design_id}_${timestamp}.zip`
      : `${design_id}_${timestamp}.stl`;
    const storagePath = `${user.id}/${fileName}`;

    let fileUrl = null;

    if (isZip) {
      // Criar ZIP em disco para upload
      const zipPath = `${base}_upload.zip`;
      await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const arc = archiver('zip', { zlib: { level: 9 } });
        arc.pipe(output);
        files.forEach(f => arc.file(f.path, { name: f.name }));
        arc.finalize();
        output.on('close', resolve);
        arc.on('error', reject);
      });
      console.log('✅ ZIP para upload criado:', fs.existsSync(zipPath), fs.statSync(zipPath).size, 'bytes');
      fileUrl = await uploadToStorage(zipPath, storagePath, 'application/zip');
      fs.unlink(zipPath, () => {});
    } else {
      fileUrl = await uploadToStorage(files[0].path, storagePath, 'model/stl');
    }

    console.log('fileUrl:', fileUrl ? 'gerado' : 'null');

    // Guardar em prod_user_assets com nome único
    const { error: assetError } = await supabase
      .from('prod_user_assets')
      .insert({
        user_id: user.id,
        design_id: design_id,
        nome_personalizado: nomeUnico,
        stl_url: fileUrl,
        scad_vault_path: storagePath,
        last_rendered_at: new Date().toISOString(),
        is_archived: false,
      });

    if (assetError) {
      console.error('Erro ao guardar asset:', JSON.stringify(assetError));
    } else {
      console.log('✅ Asset guardado:', nomeUnico);
    }

    // Registar em prod_downloads_log
    const { error: logError } = await supabase.from('prod_downloads_log').insert({
      email: user.email,
      file_url: fileUrl,
      shape_type: design_id,
      custom_name: nomeUnico,
    });
    if (logError) console.error('Erro ao registar log:', JSON.stringify(logError));

    // ── Enviar ao browser ──
    if (!isZip) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${files[0].name}"`);
      const stream = fs.createReadStream(files[0].path);
      stream.pipe(res);
      res.on('finish', () => { cleanupFiles(files); tempImageFiles.forEach(f => fsp.unlink(f).catch(() => {})); const txtTmp = `${base}_hueforge.txt`; fsp.unlink(txtTmp).catch(() => {}); });
      return;
    }

    // ZIP para o browser
    const archiveBrowser = archiver('zip', { zlib: { level: 9 } });
    const zipStream = new PassThrough();
    archiveBrowser.pipe(zipStream);
    files.forEach(f => archiveBrowser.file(f.path, { name: f.name }));
    archiveBrowser.finalize();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${design_id}.zip"`);
    zipStream.pipe(res);
    res.on('finish', () => { cleanupFiles(files); tempImageFiles.forEach(f => fsp.unlink(f).catch(() => {})); const txtTmp = `${base}_hueforge.txt`; fsp.unlink(txtTmp).catch(() => {}); });

  } catch (err) {
    console.error('DOWNLOAD_FAILED', err);
    res.status(500).send('DOWNLOAD_FAILED');
  }
}
