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

import { alinharCamadasHueforge, generateHueforgeStl, generateBookmarkStl, generateLithophaneFlatStl, generateLithophaneCurvedStl, generateLithophaneSphereStl } from '../app/hueforge-stl.js';
import { frameImage, aspectForFamily, targetLongPxForFamily, heightFracBeerLambert, litoFracLuz, esferaGeometria } from '../app/image-proc.js';
import { gerarStlPro, buildHueforgeTxt } from './gerar-stl-pro.js';
import { buildLitofaniaTxt } from '../app/litofania-guia.js';
import { gerarParedesCubo } from '../app/litofaniaCubo.js';
import { tipoDesign } from '../lib/tipoDesign.js';

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
      .select('id, familia, scad_template, generation_schema, qualidade_preview, qualidade_final')
      .eq('id', String(produtoId))
      .maybeSingle();

    if (dErr || !design) return res.status(404).json({ error: 'Design não encontrado.' });

    // Tipo de gerador (engine ou, nos designs antigos, a família) — ver lib/tipoDesign.js
    const familia = tipoDesign(design);
    const JS_FAMILIES = ['hueforge', 'marcadores', 'portachaves', 'litofania', 'litofania-curva', 'litofania-esfera', 'litofania-cubo'];
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
    // Preview fica leve e fixo (só visualização no ecrã). Final escala com o
    // tamanho real da peça em mm — ver targetLongPxForFamily em image-proc.js.
    const maxPx      = renderMode === 'preview' ? 150 : targetLongPxForFamily(familia, rest);

    const numCores     = Math.max(2, Math.min(6, Number(rest.num_cores     ?? 4)));
    const isMarcador   = familia === 'marcadores';
    // Base e relevo alinhados às camadas do slicer → as trocas do guia TXT caem
    // exatamente no topo de uma camada (STL e TXT usam os mesmos valores).
    const camadas = alinharCamadasHueforge({
      espBase:        Number(rest.espessura_base ?? (isMarcador ? 0.6 : 1.0)),
      altRelevo:      Number(rest.altura_relevo  ?? (isMarcador ? 1.5 : 2.0)),
      numCores,
      layerHeight:    Number(rest.layer_height    ?? 0.12),
      primeiraCamada: Number(rest.primeira_camada ?? 0.2),
    });
    const layerHeight    = camadas.layerHeight;
    const primeiraCamada = camadas.primeiraCamada;
    const espBase        = camadas.espBase;
    const altRelevo      = camadas.altRelevo;
    const larguraMm    = Number(rest.largura_mm     ?? (isMarcador ? 20  : 100));
    const alturaMm     = Number(rest.altura_mm      ?? (isMarcador ? 150 : 100));
    const contraste    = Math.max(-1, Math.min(1, Number(rest.contraste ?? 0)));
    const brilho       = Math.max(-1, Math.min(1, Number(rest.brilho    ?? 0)));

    // Enquadramento da imagem (igual ao preview do editor)
    const ajuste  = rest.img_ajuste ?? 'Preencher';   // igual ao default da pré-visualização do editor
    const zoom    = Number(rest.img_zoom  ?? 100);
    const posX    = Number(rest.img_pos_x ?? 0);
    const posY    = Number(rest.img_pos_y ?? 0);
    const modoCor = rest.modo_cor === true || rest.modo_cor === 1 || rest.modo_cor === '1';

    // Hash para cache — inclui ajustes + modo de cor + versão. Subir "v" sempre que
    // mudar a geometria OU o guia TXT (a cache devolve os dois ficheiros antigos).
    const paramsKey = sha256(JSON.stringify({ v: 8, imagePath, numCores, layerHeight, primeiraCamada,
      esp_min: rest.esp_min, esp_max: rest.esp_max, raio: rest.raio, angulo: rest.angulo, moldura: rest.moldura_mm, diametro: rest.diametro_mm, furo_led: rest.furo_led_mm,
      fecho: rest.fecho, diametro_vela: rest.diametro_vela,
      lado: rest.lado_mm, luz: rest.luz, img2: rest.image_path_2, img3: rest.image_path_3, img4: rest.image_path_4,
      hole_diameter: rest.hole_diameter, hole_margin_top: rest.hole_margin_top, espBase, altRelevo, larguraMm, alturaMm, contraste, brilho, ajuste, zoom, posX, posY, modoCor, renderMode }));
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

    // ── Litofânia Cubo: 4 faces (até 4 imagens) — paredes + guia ─────────
    if (familia === 'litofania-cubo') {
      const baixarImagem = async (caminho) => {
        if (!caminho.startsWith(`uploads/${user.id}/`)) { const e = new Error('Imagem inválida.'); e.status = 400; throw e; }
        const { data, error } = await supabase.storage.from(BUCKET).download(caminho);
        if (error || !data) throw new Error(`Erro ao descarregar imagem: ${error?.message}`);
        return Buffer.from(await data.arrayBuffer());
      };
      const { stl, geo } = await gerarParedesCubo({ params: rest, baixarImagem, final: renderMode === 'final' });
      const url = await uploadFile(stlStorage, stl, 'model/stl');
      if (!url) return res.status(500).json({ error: 'Erro no upload do STL.' });
      const txt = buildLitofaniaTxt({ cubo: true, geoCubo: geo, espMin: geo.espMin, espMax: geo.espMax });
      const txtUrl = await uploadFile(`${folder}/${produtoId}_hf_${paramsKey}.txt`, Buffer.from(txt, 'utf8'), 'text/plain');
      return res.json({ success: true, url, txtUrl, cached: false, mode: renderMode, coresDetectadas: null });
    }

    // Descarregar e processar imagem
    const uid      = uuid();
    const rawPath  = path.join(TMP_DIR, `hf_raw_${uid}.png`);
    const procPath = path.join(TMP_DIR, `hf_proc_${uid}.png`);

    const { data: imgData, error: imgErr } = await supabase.storage.from(BUCKET).download(imagePath);
    if (imgErr || !imgData) return res.status(400).json({ error: `Erro ao descarregar imagem: ${imgErr?.message}` });
    await fsp.writeFile(rawPath, Buffer.from(await imgData.arrayBuffer()));

    // Enquadrar (igual ao preview: ajuste/zoom/posição) e ajustar tom
    const rawImg = await Jimp.read(rawPath);
    const img = await frameImage(rawImg, {
      targetLong: maxPx,
      aspect: aspectForFamily(familia, rest),
      fit: ajuste, zoom, posX, posY,
    });
    if (contraste !== 0) img.contrast(contraste);
    if (brilho    !== 0) img.brightness(brilho);

    // ── Clustering RGB ou grayscale conforme modo_cor ────────────────────
    const n = numCores;
    const w = img.getWidth(), h = img.getHeight();

    let coresDetectadas = null;

    if (modoCor) {
      // ── Modo cor: k-means RGB ─────────────────────────────────────────
      const pixels = [];
      img.scan(0, 0, w, h, function (x, y, idx) {
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
      coresDetectadas = centers.map(([r, g, b]) =>
        '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
      );
      // Altura contínua por translucidez (Beer-Lambert), não por cluster
      // discreto — as cores detetadas (coresDetectadas) dizem que filamento
      // carregar em cada banda; a luminância do próprio pixel decide a altura
      // dentro dessa banda, dando transição suave em vez de patamar plano.
      img.scan(0, 0, w, h, function (x, y, idx) {
        const r = this.bitmap.data[idx], g = this.bitmap.data[idx+1], b = this.bitmap.data[idx+2];
        const luminancia = 0.299*r + 0.587*g + 0.114*b;
        const q = Math.round(heightFracBeerLambert(luminancia, n) * 255);
        this.bitmap.data[idx] = this.bitmap.data[idx+1] = this.bitmap.data[idx+2] = q;
      });
    } else {
      // ── Modo P&B: grayscale + auto-contraste + altura contínua ─────────
      // normalize() estica a gama de tons para 0..255, para que imagens de
      // baixo contraste não saiam todas no mesmo nível (relevo plano).
      img.grayscale();
      img.normalize();
      // Litofânias: espessura pela transmissão de luz (litoFracLuz). As bandas
      // Beer-Lambert são para o HueForge (trocas de filamento por camada).
      const lito = String(familia || '').toLowerCase().startsWith('litofania');
      img.scan(0, 0, w, h, function (x, y, idx) {
        const gray = this.bitmap.data[idx];
        const q    = lito
            ? Math.round(litoFracLuz(gray, rest.esp_min ?? 0.6, rest.esp_max ?? 3.0) * 255)
            : Math.round(heightFracBeerLambert(gray, n) * 255);
        this.bitmap.data[idx] = this.bitmap.data[idx+1] = this.bitmap.data[idx+2] = q;
      });
    }
    await img.writeAsync(procPath);

    // Construir heightmap (valores 0..1)
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
        espMax: Number(rest.esp_max ?? 3.0), espMin: Number(rest.esp_min ?? 0.6),
        moldura: Number(rest.moldura_mm ?? 3) });
    } else if (familia === 'litofania-curva') {
      stlBuffer = generateLithophaneCurvedStl({ heightmap, alturaMm,
        raio: Number(rest.raio ?? 50), angulo: Number(rest.angulo ?? 270),
        espMax: Number(rest.esp_max ?? 3.0), espMin: Number(rest.esp_min ?? 0.6) });
    } else if (familia === 'litofania-esfera') {
      stlBuffer = generateLithophaneSphereStl({ heightmap, geo: esferaGeometria(rest),
        espMax: Number(rest.esp_max ?? 3.0), espMin: Number(rest.esp_min ?? 0.6) });
    } else {
      stlBuffer = generateHueforgeStl({ heightmap, largura: larguraMm, altura: alturaMm, espBase, altRelevo });
    }
    const stlUrl    = await uploadFile(stlStorage, stlBuffer, 'model/stl');
    if (!stlUrl) return res.status(500).json({ error: 'Erro no upload do STL.' });

    const response = { success: true, url: stlUrl, cached: false, mode: renderMode, coresDetectadas: familia.startsWith('litofania') ? null : coresDetectadas };

    // Gerar TXT: guia de impressão (litofânias) ou de troca de filamento (HueForge)
    const isLito = familia.startsWith('litofania');
    const txtContent = isLito
      ? buildLitofaniaTxt({
          curva: familia === 'litofania-curva', esfera: familia === 'litofania-esfera',
          geoEsfera: familia === 'litofania-esfera' ? esferaGeometria(rest) : null,
          diametro: Number(rest.diametro_mm ?? 80), furoLed: Number(rest.furo_led_mm ?? 40),
          larguraMm, alturaMm,
          espMin: Number(rest.esp_min ?? 0.6), espMax: Number(rest.esp_max ?? 3.0),
          moldura: Number(rest.moldura_mm ?? 3),
          raio: Number(rest.raio ?? 50), angulo: Number(rest.angulo ?? 270),
        })
      : buildHueforgeTxt({ numCores, layerHeight, primeiraCamada, espessuraBase: espBase, alturaRelevo: altRelevo, larguraMm, alturaMm, coresDetectadas });
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
