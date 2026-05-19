/**
 * POST /gerar-stl-hueforge
 *
 * Gera STL para produtos com imagem (HueForge e outros) sem usar OpenSCAD.
 * Para HueForge gera também o ficheiro TXT com guia de mudança de filamento.
 * Para outros produtos com imagem usa OpenSCAD normalmente (delega para gerar-stl-pro).
 */

import fsp    from 'fs/promises';
import path   from 'path';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname }       from 'path';
import Jimp from 'jimp';

import { generateHueforgeStl, generateBookmarkStl, generateLithophaneFlatStl, generateLithophaneCurvedStl } from '../app/hueforge-stl.js';
import { gerarStlPro, buildHueforgeTxt } from './gerar-stl-pro.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const BUCKET           = process.env.STORAGE_BUCKET || 'makers_pro_stl_prod';
const SIGNED_URL_TTL   = Number(process.env.SIGNED_URL_TTL_SECONDS || '3600');
const DESIGNS_TABLE    = process.env.DESIGNS_TABLE || 'prod_designs';
const TMP_DIR          = path.join(process.cwd(), 'temp');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getUser(req) {
  const auth  = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) { const e = new Error('Authorization Bearer obrigatório.'); e.status = 401; throw e; }
  const { data, error } = await supabase.auth.getUser(match[1]);
  if (error || !data?.user) { const e = new Error('Token inválido ou expirado.'); e.status = 401; throw e; }
  return data.user;
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

async function uploadFile(storagePath, buffer, mimeType) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });
  if (error) { console.error('Erro no upload:', error.message); return null; }
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}

export async function gerarStlHueforge(req, res) {
  const { id: produtoId, mode, ...rest } = req.body || {};
  if (!produtoId) return res.status(400).json({ error: 'id obrigatório.' });

  try {
    const user = await getUser(req);

    // Buscar design
    const { data: design, error: dErr } = await supabase
      .from(DESIGNS_TABLE)
      .select('id, familia, scad_template, qualidade_preview, qualidade_final')
      .eq('id', String(produtoId))
      .maybeSingle();

    if (dErr || !design) return res.status(404).json({ error: 'Design não encontrado.' });

    const familia = String(design.familia || '').toLowerCase();
    const JS_FAMILIES = ['hueforge', 'marcadores', 'portachaves', 'litofania', 'litofania-curva'];
    const isJsMode = JS_FAMILIES.includes(familia);

    // Produtos não suportados em JS delegam para gerar-stl-pro (OpenSCAD)
    if (!isJsMode) {
      return gerarStlPro(req, res);
    }

    const isHueforge = familia === 'hueforge';

    // ── HueForge: geração pura em JS ─────────────────────────────────────
    const imagePath = rest.image_path;
    if (!imagePath || !String(imagePath).startsWith('uploads/')) {
      return res.status(400).json({ error: 'image_path obrigatório para HueForge.' });
    }

    const renderMode = String(mode || 'preview').toLowerCase() === 'preview' ? 'preview' : 'final';
    const maxPx      = renderMode === 'preview' ? 60 : 120;

    const numCores     = Math.max(2, Math.min(6, Number(rest.num_cores     ?? 4)));
    const layerHeight  = Number(rest.layer_height   ?? 0.16);
    const espBase      = Number(rest.espessura_base ?? 1.0);
    const altRelevo    = Number(rest.altura_relevo  ?? 2.0);
    const larguraMm    = Number(rest.largura_mm     ?? 100);
    const alturaMm     = Number(rest.altura_mm      ?? 100);

    // Hash para cache
    const paramsKey = sha256(JSON.stringify({ imagePath, numCores, layerHeight, espBase, altRelevo, larguraMm, alturaMm, renderMode }));
    const stlFilename = `${produtoId}_hf_${paramsKey}.stl`;
    const folder      = `users/${user.id}/${renderMode}`;
    const stlStorage  = `${folder}/${stlFilename}`;

    // Cache hit?
    const { data: existing } = await supabase.storage.from(BUCKET).list(folder, { search: stlFilename, limit: 1 });
    if (Array.isArray(existing) && existing.some(f => f.name === stlFilename)) {
      const { data: urlData } = await supabase.storage.from(BUCKET).createSignedUrl(stlStorage, SIGNED_URL_TTL);
      const response = { success: true, url: urlData?.signedUrl, cached: true, mode: renderMode };

      const txtFilename = `${produtoId}_hf_${paramsKey}.txt`;
      const { data: existingTxt } = await supabase.storage.from(BUCKET).list(folder, { search: txtFilename, limit: 1 });
      if (Array.isArray(existingTxt) && existingTxt.some(f => f.name === txtFilename)) {
        const { data: td } = await supabase.storage.from(BUCKET).createSignedUrl(`${folder}/${txtFilename}`, SIGNED_URL_TTL);
        response.txtUrl = td?.signedUrl;
      }
      return res.json(response);
    }

    // Descarregar e processar imagem
    const uid      = uuid();
    const rawPath  = path.join(TMP_DIR, `hf_raw_${uid}.png`);
    const procPath = path.join(TMP_DIR, `hf_proc_${uid}.png`);

    const { data: imgData, error: imgErr } = await supabase.storage.from(BUCKET).download(imagePath);
    if (imgErr || !imgData) return res.status(400).json({ error: `Erro ao descarregar imagem: ${imgErr?.message}` });
    await fsp.writeFile(rawPath, Buffer.from(await imgData.arrayBuffer()));

    // Redimensionar e quantizar
    const img = await Jimp.read(rawPath);
    if (img.getWidth() > maxPx || img.getHeight() > maxPx) {
      img.getWidth() >= img.getHeight() ? img.resize(maxPx, Jimp.AUTO) : img.resize(Jimp.AUTO, maxPx);
    }
    img.grayscale();
    const n = numCores;
    img.scan(0, 0, img.getWidth(), img.getHeight(), function (x, y, idx) {
      const gray  = this.bitmap.data[idx];
      const level = Math.min(Math.floor(gray / 256 * n), n - 1);
      const q     = n === 1 ? 0 : Math.round(level / (n - 1) * 255);
      this.bitmap.data[idx] = this.bitmap.data[idx+1] = this.bitmap.data[idx+2] = q;
    });
    await img.writeAsync(procPath);

    // Construir heightmap (matriz de valores 0..1)
    const w = img.getWidth(), h = img.getHeight();
    const heightmap = Array.from({ length: h }, (_, r) =>
      Array.from({ length: w }, (_, c) => {
        const idx = img.getPixelIndex(c, r);
        return img.bitmap.data[idx] / 255;
      })
    );

    // Gerar STL conforme a família
    let stlBuffer;
    if (familia === 'marcadores') {
      stlBuffer = generateBookmarkStl({ heightmap, largura: larguraMm, altura: alturaMm, espBase, altRelevo,
        holeDiameter: Number(rest.hole_diameter ?? 4),
        holeMarginTop: Number(rest.hole_margin_top ?? 6) });
    } else if (familia === 'portachaves') {
      // Portachaves: usa bookmark generator — furo no topo, dimensões de portachaves
      const largura = Number(rest.largura ?? rest.largura_mm ?? 55);
      const altura  = Number(rest.altura  ?? rest.altura_mm  ?? 35);
      stlBuffer = generateBookmarkStl({
        heightmap,
        largura,
        altura,
        espBase:  Number(rest.espessura ?? rest.espessura_base ?? 3.5),
        altRelevo: Number(rest.relevo   ?? rest.altura_relevo  ?? 1.5),
        holeDiameter:  5,   // furo para argola
        holeMarginTop: 4,   // margem do furo ao topo
      });
    } else if (familia === 'litofania') {
      stlBuffer = generateLithophaneFlatStl({ heightmap, largura: larguraMm, altura: alturaMm,
        espMax: Number(rest.esp_max ?? 3.0), espMin: Number(rest.esp_min ?? 0.6) });
    } else if (familia === 'litofania-curva') {
      stlBuffer = generateLithophaneCurvedStl({ heightmap, alturaMm,
        raio: Number(rest.raio ?? 50), angulo: Number(rest.angulo ?? 270),
        espMax: Number(rest.esp_max ?? 3.0), espMin: Number(rest.esp_min ?? 0.6) });
    } else {
      stlBuffer = generateHueforgeStl({ heightmap, largura: larguraMm, altura: alturaMm, espBase, altRelevo });
    }
    const stlUrl    = await uploadFile(stlStorage, stlBuffer, 'model/stl');
    if (!stlUrl) return res.status(500).json({ error: 'Erro no upload do STL.' });

    const response = { success: true, url: stlUrl, cached: false, mode: renderMode };

    // Gerar TXT HueForge
    const txtContent  = buildHueforgeTxt({ numCores, layerHeight, espessuraBase: espBase, alturaRelevo: altRelevo, larguraMm, alturaMm });
    const txtFilename = `${produtoId}_hf_${paramsKey}.txt`;
    const txtUrl      = await uploadFile(`${folder}/${txtFilename}`, Buffer.from(txtContent, 'utf8'), 'text/plain');
    if (txtUrl) response.txtUrl = txtUrl;

    // Limpar temp
    await fsp.unlink(rawPath).catch(() => {});
    await fsp.unlink(procPath).catch(() => {});

    return res.json(response);

  } catch (err) {
    const status = err.status || 500;
    console.error('gerar-stl-hueforge error:', err.message);
    return res.status(status).json({ error: err.message || 'Erro interno.' });
  }
}
