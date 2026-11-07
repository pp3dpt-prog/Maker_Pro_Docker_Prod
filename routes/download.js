import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import archiver from 'archiver';
import { v4 as uuid } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { PassThrough } from 'stream';
import Jimp from 'jimp';
import { alinharCamadasHueforge, generateHueforgeStl, generateBookmarkStl, generateLithophaneFlatStl, generateLithophaneCurvedStl, generateLithophaneSphereStl } from '../app/hueforge-stl.js';
import { frameImage, aspectForFamily, targetLongPxForFamily, heightFracBeerLambert, litoFracLuz, esferaGeometria } from '../app/image-proc.js';
import { buildHueforgeTxt }   from './gerar-stl-pro.js';
import { buildLitofaniaTxt } from '../app/litofania-guia.js';
import { gerarParedesCubo, cuboBaseScad, cuboTampaScad } from '../app/litofaniaCubo.js';
import { caixaLuzGeometria, caixaLuzBaseScad, guiaCaixaLuz } from '../app/litofaniaCaixaLuz.js';
import { gerarTermoformagem, guiaTermoformagem } from '../app/termoformagem.js';
import { tipoDesign } from '../lib/tipoDesign.js';
import { GERADORES_ILUMINARIA, gerarIluminaria, trisParaStl } from '../app/iluminarias.js';
import { scadVars }           from '../lib/scad.js';
import { aplicarAjusteTexto } from '../lib/textFit.js';
import { aplicarLogo } from '../lib/logo.js';
import { ENGINE_VETOR, gerarFicheirosVetor, validarCaminhoImagem, obterVetor } from '../app/vetorPortachaves.js';
import { tresMf, lerStl, stlBinario } from '../app/ficheiros3d.js';
import { fatiasParaTriangulos } from '../app/vetorGeom.js';
import { construirCaixaLuzLogo, guiaCaixaLuzLogo } from '../app/caixaLuzLogo.js';

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

  // scadVars escapa aspas/barras e valida as chaves (antes, um nome com `"`
  // partia o ficheiro ou permitia injectar código SCAD).
  const vars = scadVars(params);

  // Template primeiro, vars depois — "last wins" no OpenSCAD garante que o modo injetado prevalece
  fs.writeFileSync(scadFile, `${scadTemplate}\n\n${vars}\n`);

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

/**
 * Modelos multicor (generation_schema.multicor), p.ex. a etiqueta de mochila:
 *
 *   "multicor": {
 *     "param_impressao": "impressao",       // param do select AMS / Sem AMS
 *     "troca_cor_mm": 3.5,                  // altura da troca de cor sem AMS (ou "troca_cor_param")
 *     "partes": [ { "modo": "base",  "nome": "Placa", "cor_param": "cor_base"  }, ... ]
 *   }
 *
 * Com AMS: o template corre uma vez por parte (modo = parte.modo) e as malhas vão
 * para um 3MF com uma peça por cor (Bambu Studio / Orca atribuem um filamento a cada).
 * Sem AMS: um STL único (modo = "tudo") + LEIA-ME com a camada da troca de cor.
 * Partes vazias (p.ex. sem texto) não geram ficheiro e são saltadas; a 1.ª é obrigatória.
 */
export function semAms(cfg, params) {
  const v = String(params?.[cfg.param_impressao || 'impressao'] ?? '');
  return /^sem/i.test(v.trim());
}

export async function gerarMulticor({ design, params, base, nomeBase }) {
  const cfg = design.generation_schema.multicor;
  const partesCfg = Array.isArray(cfg.partes) ? cfg.partes : [];

  if (semAms(cfg, params)) {
    const stlPath = `${base}.stl`;
    await gerarSTL({ scadTemplate: design.scad_template, params: { ...params, modo: 'tudo' }, outFile: stlPath });
    // altura da troca de cor: fixa (troca_cor_mm) ou lida de um parâmetro (troca_cor_param, p.ex. a espessura da base)
    const z = Number(cfg.troca_cor_param ? params[cfg.troca_cor_param] : cfg.troca_cor_mm);
    const cores = partesCfg.map(p => `  • ${p.nome}: ${String(params[p.cor_param] ?? '').toUpperCase()}`);
    // cfg.texto_sem_ams (opcional): linhas próprias do modelo, quando não há troca de cor por
    // altura (p.ex. nome flexível: as cores são por letra, não por camada).
    const proprias = Array.isArray(cfg.texto_sem_ams) ? cfg.texto_sem_ams.map(String) : null;
    const guia = [
      `pp3d.pt — ${design.nome}`,
      '',
      ...(proprias ?? ['Impressão sem AMS (uma cor de cada vez):']),
      ...(!proprias && Number.isFinite(z) ? [
        `  1. Começa com a cor da ${partesCfg[0]?.nome?.toLowerCase() || 'base'}.`,
        `  2. No slicer, adiciona uma troca de cor (Color Change / Pause / M600) na camada dos ${z.toFixed(2)} mm.`,
        '  3. Troca o filamento: tudo o que está em relevo acima dessa altura sai na 2.ª cor.',
        ...(partesCfg.length > 2 ? ['     (sem AMS, as partes em relevo — ' + partesCfg.slice(1).map(p => p.nome.toLowerCase()).join(' e ') + ' — ficam na mesma cor)'] : []),
      ] : []),
      '',
      'Cores escolhidas:',
      ...cores,
      '',
      'Dica: com AMS / multi-material escolhe "AMS" e recebes um 3MF com uma peça por cor.',
      '',
    ].join('\r\n');
    const txtPath = `${base}_leia-me.txt`;
    await fsp.writeFile(txtPath, guia, 'utf8');
    return [{ name: `${nomeBase}.stl`, path: stlPath }, { name: 'LEIA-ME_impressao.txt', path: txtPath }];
  }

  const partes = [];
  for (const [i, p] of partesCfg.entries()) {
    const stlPath = `${base}_${p.modo}.stl`;
    try {
      await gerarSTL({ scadTemplate: design.scad_template, params: { ...params, modo: p.modo }, outFile: stlPath });
    } catch (e) {
      if (i === 0) throw e;           // sem base não há etiqueta
      console.log(`Multicor: parte "${p.modo}" vazia, saltada`);
      continue;
    }
    const tri = lerStl(await fsp.readFile(stlPath));
    fsp.unlink(stlPath).catch(() => {});
    fsp.unlink(stlPath.replace('.stl', '.scad')).catch(() => {});
    if (!tri.length) continue;
    const cor = /^#[0-9a-f]{6}$/i.test(String(params[p.cor_param])) ? String(params[p.cor_param]) : '#FFFFFF';
    partes.push({ nome: p.nome, cor, tri });
  }
  const p3mf = `${base}.3mf`;
  await fsp.writeFile(p3mf, await tresMf(partes, nomeBase));
  return [{ name: `${nomeBase}.3mf`, path: p3mf }];
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
      .select('scad_template, generation_schema, nome, familia, acesso_maker, requer_licenca_comercial')
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

    // Factores esc_* de ajuste do texto (só designs com generation_schema.ajuste_texto)
    aplicarAjusteTexto(design.generation_schema, paramsNormalizados);
    // Logótipo (generation_schema.logo): o caminho tem de ser do próprio utilizador
    await aplicarLogo(design.generation_schema, paramsNormalizados, user.id);

    // Porta-chaves de imagem a cores (SVG/PNG → cores vetoriais; STL/ZIP/3MF)
    const isVetor = design.generation_schema?.engine === ENGINE_VETOR;
    if (isVetor) validarCaminhoImagem(paramsNormalizados.image_path, user.id);

    // Processar imagem se existir (HueForge e portachaves com imagem)
    const tempImageFiles = [];
    let coresDetectadas = null; // preenchido abaixo em modo_cor; usado no .txt do HueForge mais à frente
    // Tipo de gerador (engine ou família) — a família é só a categoria da loja
    const tipo = tipoDesign(design);
    const isCubo = tipo === 'litofania-cubo';
    const isCaixaLuzLito = tipo === 'litofania-caixa-luz';
    const isTermo = tipo === 'termoformagem-molde';
    const isCaixaLuzLogo = tipo === 'caixa-luz-logo';
    if (!isVetor && !isCubo && !isCaixaLuzLito && !isTermo && !isCaixaLuzLogo && typeof paramsNormalizados.image_path === 'string' && paramsNormalizados.image_path.startsWith('uploads/')) {
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

      // Enquadrar (igual ao preview: ajuste/zoom/posição). Ficheiro de
      // download real — grelha escala com o tamanho físico da peça (mm),
      // ver targetLongPxForFamily em image-proc.js.
      const familiaImg = tipo;
      const rawImg = await Jimp.read(rawPath);
      const img = await frameImage(rawImg, {
        targetLong: targetLongPxForFamily(familiaImg, paramsNormalizados),
        aspect: aspectForFamily(familiaImg, paramsNormalizados),
        fit: paramsNormalizados.img_ajuste ?? 'Preencher',   // igual à pré-visualização
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
        coresDetectadas = centers.map(([r, g, b]) =>
          '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
        );
        // Altura contínua por translucidez (Beer-Lambert), não por cluster
        // discreto — coresDetectadas diz que filamento carregar em cada
        // banda; a luminância do próprio pixel decide a altura dentro da
        // banda, dando transição suave em vez de patamar plano.
        img.scan(0, 0, iw, ih, function (x, y, idx) {
          const r = this.bitmap.data[idx], g = this.bitmap.data[idx+1], b = this.bitmap.data[idx+2];
          const luminancia = 0.299*r + 0.587*g + 0.114*b;
          const q = Math.round(heightFracBeerLambert(luminancia, n) * 255);
          this.bitmap.data[idx] = this.bitmap.data[idx+1] = this.bitmap.data[idx+2] = q;
        });
      } else {
        // grayscale + auto-contraste + altura contínua: imagens de baixo
        // contraste deixam de sair todas no mesmo nível (relevo plano).
        img.grayscale();
        img.normalize();
        // Litofânias: espessura pela transmissão de luz (litoFracLuz). As bandas
        // Beer-Lambert são para o HueForge (trocas de filamento por camada).
        const lito = familiaImg.startsWith('litofania');
        img.scan(0, 0, iw, ih, function (x, y, idx) {
          const gray = this.bitmap.data[idx];
          const q    = lito
            ? Math.round(litoFracLuz(gray, paramsNormalizados.esp_min ?? 0.6, paramsNormalizados.esp_max ?? 3.0) * 255)
            : Math.round(heightFracBeerLambert(gray, n) * 255);
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

    const JS_FAMILIES_DL = ['hueforge', 'marcadores', 'portachaves', 'litofania', 'litofania-curva', 'litofania-esfera'];
    const isHueforgeFamily = JS_FAMILIES_DL.includes(tipo);
    const isCaixa = tipo === 'caixas';
    const isLetras = tipo === 'letras-decorativas';
    const isCaixaLuz = tipo === 'letras-caixa-luz';

    if (GERADORES_ILUMINARIA.includes(tipo)) {
      // Iluminárias: peça (JS) + base (OpenSCAD) + guia
      const { stl, scad, txt } = gerarIluminaria(tipo, paramsNormalizados, { final: true });
      const pecaPath = `${base}_iluminaria.stl`;
      await fsp.writeFile(pecaPath, stl);
      files.push({ name: 'iluminaria.stl', path: pecaPath });
      const basePath = `${base}_base.stl`;
      await gerarSTL({ scadTemplate: scad, params: {}, outFile: basePath });
      files.push({ name: 'base.stl', path: basePath });
      const guiaPath = `${base}_guia.txt`;
      await fsp.writeFile(guiaPath, txt, 'utf8');
      files.push({ name: 'guia_iluminaria.txt', path: guiaPath });
    } else if (isCubo) {
      // Litofânia Cubo: paredes (JS) + base e tampa (OpenSCAD) + guia
      const baixarImagem = async (caminho) => {
        if (!caminho.startsWith(`uploads/${user.id}/`)) throw new Error('Imagem inválida.');
        const { data, error } = await supabase.storage.from('makers_pro_stl_prod').download(caminho);
        if (error || !data) throw new Error(`Erro ao descarregar imagem: ${error?.message}`);
        return Buffer.from(await data.arrayBuffer());
      };
      const { stl, geo } = await gerarParedesCubo({ params: paramsNormalizados, baixarImagem, final: true });
      const paredesPath = `${base}_paredes.stl`;
      await fsp.writeFile(paredesPath, stl);
      files.push({ name: 'cubo_paredes_litofania.stl', path: paredesPath });
      const basePath = `${base}_base.stl`;
      await gerarSTL({ scadTemplate: cuboBaseScad(geo), params: {}, outFile: basePath });
      files.push({ name: 'cubo_base.stl', path: basePath });
      const tampaPath = `${base}_tampa.stl`;
      await gerarSTL({ scadTemplate: cuboTampaScad(geo), params: {}, outFile: tampaPath });
      files.push({ name: 'cubo_tampa.stl', path: tampaPath });
      const guiaPath = `${base}_guia.txt`;
      await fsp.writeFile(guiaPath, buildLitofaniaTxt({ cubo: true, geoCubo: geo, espMin: geo.espMin, espMax: geo.espMax }), 'ascii');
      files.push({ name: 'guia_cubo_litofania.txt', path: guiaPath });
    } else if (isCaixaLuzLito) {
      // Litofânia Caixa de Luz: painel (JS, igual à litofania plana) + base com luz (OpenSCAD) + guia
      if (typeof paramsNormalizados.image_path !== 'string' || !paramsNormalizados.image_path.startsWith('uploads/')) {
        throw new Error('Carrega uma imagem.');
      }
      const { data: imgData, error: imgErr } = await supabase.storage
        .from('makers_pro_stl_prod')
        .download(paramsNormalizados.image_path);
      if (imgErr || !imgData) throw new Error(`Erro ao descarregar imagem: ${imgErr?.message}`);
      const rawImg = await Jimp.read(Buffer.from(await imgData.arrayBuffer()));

      const geoCaixa = caixaLuzGeometria(paramsNormalizados);
      const imgCaixa = await frameImage(rawImg, {
        targetLong: targetLongPxForFamily('litofania', paramsNormalizados),
        aspect: aspectForFamily('litofania', paramsNormalizados),
        fit: paramsNormalizados.img_ajuste ?? 'Preencher',
        zoom: paramsNormalizados.img_zoom,
        posX: paramsNormalizados.img_pos_x,
        posY: paramsNormalizados.img_pos_y,
      });
      imgCaixa.grayscale();
      imgCaixa.normalize();
      const icw = imgCaixa.getWidth(), ich = imgCaixa.getHeight();
      imgCaixa.scan(0, 0, icw, ich, function (x, y, idx) {
        const gray = this.bitmap.data[idx];
        const q = Math.round(litoFracLuz(gray, geoCaixa.espMin, geoCaixa.espMax) * 255);
        this.bitmap.data[idx] = this.bitmap.data[idx + 1] = this.bitmap.data[idx + 2] = q;
      });
      const heightmapCaixa = Array.from({ length: ich }, (_, r) =>
        Array.from({ length: icw }, (_, c) => imgCaixa.bitmap.data[imgCaixa.getPixelIndex(c, r)] / 255));

      const painelBuffer = generateLithophaneFlatStl({
        heightmap: heightmapCaixa,
        largura: geoCaixa.larguraMm, altura: geoCaixa.alturaMm,
        espMax: geoCaixa.espMax, espMin: geoCaixa.espMin, moldura: geoCaixa.molduraMm,
      });
      const painelPath = `${base}_painel.stl`;
      await fsp.writeFile(painelPath, painelBuffer);
      files.push({ name: 'painel_litofania.stl', path: painelPath });

      const basePath = `${base}_base.stl`;
      await gerarSTL({ scadTemplate: caixaLuzBaseScad(geoCaixa), params: {}, outFile: basePath });
      files.push({ name: 'base_caixa_luz.stl', path: basePath });

      const guiaPath = `${base}_guia.txt`;
      await fsp.writeFile(guiaPath, guiaCaixaLuz(geoCaixa), 'ascii');
      files.push({ name: 'guia_caixa_luz.txt', path: guiaPath });
    } else if (isTermo) {
      // Termoformagem/Prensagem: macho + fêmea (JS, igual vetorização do
      // porta-chaves de imagem) + moldura (JS) + guia
      if (typeof paramsNormalizados.image_path !== 'string' || !paramsNormalizados.image_path.startsWith(`uploads/${user.id}/`)) {
        throw new Error('Carrega uma imagem/SVG.');
      }
      const vetor = await obterVetor(paramsNormalizados.image_path, paramsNormalizados);
      const rt = gerarTermoformagem(vetor, paramsNormalizados, { final: true });

      const machoPath = `${base}_macho.stl`;
      await fsp.writeFile(machoPath, trisParaStl(rt.macho));
      files.push({ name: 'macho.stl', path: machoPath });

      const femeaPath = `${base}_femea.stl`;
      await fsp.writeFile(femeaPath, trisParaStl(rt.femea));
      files.push({ name: 'femea.stl', path: femeaPath });

      const moldPath = `${base}_moldura.stl`;
      await fsp.writeFile(moldPath, trisParaStl(rt.moldura));
      files.push({ name: 'moldura.stl', path: moldPath });

      const guiaPath = `${base}_guia.txt`;
      await fsp.writeFile(guiaPath, guiaTermoformagem(rt.g), 'ascii');
      files.push({ name: 'guia_termoformagem.txt', path: guiaPath });
    } else if (isCaixaLuzLogo) {
      // Caixa de Luz — logótipo/texto: corpo (novo, paredes ocas) + frente/cores
      // (igual ao porta-chaves de imagem, ver construirPecas) + guia
      if (typeof paramsNormalizados.image_path !== 'string' || !paramsNormalizados.image_path.startsWith(`uploads/${user.id}/`)) {
        throw new Error('Carrega uma imagem/SVG.');
      }
      const vetorCL = await obterVetor(paramsNormalizados.image_path, paramsNormalizados);
      const { r: rCL, geo: geoCL, corpoTris } = construirCaixaLuzLogo(vetorCL, paramsNormalizados);

      const corpoPath = `${base}_corpo.stl`;
      await fsp.writeFile(corpoPath, stlBinario(corpoTris, 'corpo'));
      files.push({ name: 'corpo.stl', path: corpoPath });

      if (rCL.parametros.modo === 'ams') {
        const partes = rCL.pecas.map(pc => ({ nome: pc.nome, cor: pc.cor, tri: fatiasParaTriangulos(pc.fatias) }));
        const mfPath = `${base}_frente.3mf`;
        await fsp.writeFile(mfPath, await tresMf(partes, 'frente'));
        files.push({ name: 'frente.3mf', path: mfPath });
      } else {
        for (const pc of rCL.pecas) {
          const nomeF = rCL.pecas.length === 1 ? 'frente' : `frente_${pc.nome.replace(/\s+/g, '_')}${pc.solta ? `_${pc.cor.slice(1)}` : ''}`;
          const p = `${base}_${nomeF}.stl`;
          await fsp.writeFile(p, stlBinario(fatiasParaTriangulos(pc.fatias), pc.nome));
          files.push({ name: `${nomeF}.stl`, path: p });
        }
      }

      const guiaPath = `${base}_guia.txt`;
      await fsp.writeFile(guiaPath, guiaCaixaLuzLogo(rCL, geoCL), 'ascii');
      files.push({ name: 'guia_caixa_luz_logo.txt', path: guiaPath });
    } else if (isVetor) {
      const nomeBase = String(design.nome || 'porta-chaves').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase() || 'porta-chaves';
      for (const f of await gerarFicheirosVetor(paramsNormalizados.image_path, paramsNormalizados, nomeBase)) {
        const p = `${base}_${f.name}`;
        await fsp.writeFile(p, f.buffer);
        files.push({ name: f.name, path: p });
      }
    } else if (isHueforgeFamily && typeof paramsNormalizados.image_path === 'string' && paramsNormalizados.image_path.startsWith('/')) {
      // HueForge: gerar STL com JS puro (imagem já processada acima)
      const img = await Jimp.read(paramsNormalizados.image_path);
      const w = img.getWidth(), h = img.getHeight();
      const heightmap = Array.from({ length: h }, (_, r) =>
        Array.from({ length: w }, (_, c) => {
          const idx = img.getPixelIndex(c, r);
          return img.bitmap.data[idx] / 255;
        })
      );
      const familiaLower = tipo;
      // Base/relevo alinhados às camadas do slicer (mesmos valores no STL e no TXT)
      const isMarcadorDl = familiaLower === 'marcadores';
      const camadasHf = alinharCamadasHueforge({
        espBase:        Number(paramsNormalizados.espessura_base ?? (isMarcadorDl ? 0.6 : 1.0)),
        altRelevo:      Number(paramsNormalizados.altura_relevo  ?? (isMarcadorDl ? 1.5 : 2.0)),
        numCores:       Math.max(2, Math.min(6, Number(paramsNormalizados.num_cores ?? 4))),
        layerHeight:    Number(paramsNormalizados.layer_height    ?? 0.12),
        primeiraCamada: Number(paramsNormalizados.primeira_camada ?? 0.2),
      });
      let stlBuffer;
      if (familiaLower === 'marcadores' || familiaLower === 'portachaves') {
        const largura = Number(paramsNormalizados.largura ?? paramsNormalizados.largura_mm ?? (familiaLower === 'portachaves' ? 55 : 20));
        const altura  = Number(paramsNormalizados.altura  ?? paramsNormalizados.altura_mm  ?? (familiaLower === 'portachaves' ? 35 : 150));
        stlBuffer = generateBookmarkStl({
          heightmap, largura, altura,
          espBase:   familiaLower === 'portachaves' ? Number(paramsNormalizados.espessura ?? paramsNormalizados.espessura_base ?? 3.5) : camadasHf.espBase,
          altRelevo: familiaLower === 'portachaves' ? Number(paramsNormalizados.relevo    ?? paramsNormalizados.altura_relevo  ?? 1.5) : camadasHf.altRelevo,
          holeDiameter:  familiaLower === 'portachaves' ? 5 : Number(paramsNormalizados.hole_diameter ?? 4),
          holeMarginTop: familiaLower === 'portachaves' ? 4 : Number(paramsNormalizados.hole_margin_top ?? 6),
        });
      } else if (familiaLower === 'litofania') {
        stlBuffer = generateLithophaneFlatStl({ heightmap,
          largura: Number(paramsNormalizados.largura_mm ?? 150),
          altura:  Number(paramsNormalizados.altura_mm  ?? 150),
          espMax:  Number(paramsNormalizados.esp_max ?? 3.0),
          espMin:  Number(paramsNormalizados.esp_min ?? 0.6),
          moldura: Number(paramsNormalizados.moldura_mm ?? 3) });
      } else if (familiaLower === 'litofania-esfera') {
        stlBuffer = generateLithophaneSphereStl({ heightmap,
          geo:    esferaGeometria(paramsNormalizados),
          espMax: Number(paramsNormalizados.esp_max ?? 3.0),
          espMin: Number(paramsNormalizados.esp_min ?? 0.6) });
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
          espBase:   camadasHf.espBase,
          altRelevo: camadasHf.altRelevo,
        });
      }
      const stlPath = `${base}.stl`;
      await fsp.writeFile(stlPath, stlBuffer);
      files.push({ name: `${design_id}.stl`, path: stlPath });

      // Litofânias: guia de impressão no ZIP
      if (familiaLower.startsWith('litofania')) {
        const litoTxt = buildLitofaniaTxt({
          curva: familiaLower === 'litofania-curva',
          esfera: familiaLower === 'litofania-esfera',
          diametro: Number(paramsNormalizados.diametro_mm ?? 80),
          furoLed:  Number(paramsNormalizados.furo_led_mm ?? 40),
          larguraMm: Number(paramsNormalizados.largura_mm ?? 150),
          alturaMm:  Number(paramsNormalizados.altura_mm  ?? 150),
          espMin:    Number(paramsNormalizados.esp_min ?? 0.6),
          espMax:    Number(paramsNormalizados.esp_max ?? 3.0),
          moldura:   Number(paramsNormalizados.moldura_mm ?? 3),
          raio:      Number(paramsNormalizados.raio   ?? 50),
          angulo:    Number(paramsNormalizados.angulo ?? 270),
        });
        const litoTxtPath = `${base}_litofania.txt`;
        await fsp.writeFile(litoTxtPath, litoTxt, 'ascii');
        files.push({ name: 'guia_litofania.txt', path: litoTxtPath });
      }

      // Gerar TXT (guia de cores do HueForge) e incluir no ZIP — não se aplica às litofânias
      if (!familiaLower.startsWith('litofania')) {
      const txtContent = buildHueforgeTxt({
        numCores    : Number(paramsNormalizados.num_cores      ?? 4),
        layerHeight   : camadasHf.layerHeight,
        primeiraCamada: camadasHf.primeiraCamada,
        espessuraBase : camadasHf.espBase,
        alturaRelevo  : camadasHf.altRelevo,
        larguraMm   : Number(paramsNormalizados.largura_mm     ?? (isMarcadorDl ? 20  : 100)),
        alturaMm    : Number(paramsNormalizados.altura_mm      ?? (isMarcadorDl ? 150 : 100)),
        coresDetectadas,
      });
      const txtPath = `${base}_hueforge.txt`;
      await fsp.writeFile(txtPath, txtContent, 'ascii');
      files.push({ name: 'hueforge_cores.txt', path: txtPath });
      }
    } else if (design.generation_schema?.multicor && design.scad_template) {
      const nomeBase = String(design.nome || design_id).normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase() || 'pp3d';
      files.push(...await gerarMulticor({ design, params: paramsNormalizados, base, nomeBase }));
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
    // ficheiros grandes (litofânias/HueForge ~36 MB) vão em ZIP: ~5× menos para enviar e guardar
    const isZip = files.length > 1 || files.some(f => fs.statSync(f.path).size > 5e6);
    const timestamp = `${Date.now()}`; // milissegundos — sempre único
    const extUnico = (files[0]?.name.split('.').pop() || 'stl').toLowerCase();
    const MIME = { stl: 'model/stl', '3mf': 'model/3mf' };
    const fileName = isZip
      ? `${design_id}_${timestamp}.zip`
      : `${design_id}_${timestamp}.${extUnico}`;
    const storagePath = `${user.id}/${fileName}`;

    let fileUrl = null;

    if (isZip) {
      // Criar ZIP em disco para upload
      const zipPath = `${base}_upload.zip`;
      await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        // nível 6: mesmo tamanho que o 9 em STL, ~5× mais rápido (Render Free = 0,1 CPU)
        const arc = archiver('zip', { zlib: { level: 6 } });
        arc.pipe(output);
        files.forEach(f => arc.file(f.path, { name: f.name }));
        arc.finalize();
        output.on('close', resolve);
        arc.on('error', reject);
      });
      console.log('✅ ZIP para upload criado:', fs.existsSync(zipPath), fs.statSync(zipPath).size, 'bytes');
      fileUrl = await uploadToStorage(zipPath, storagePath, 'application/zip');
      // o mesmo ZIP segue para o browser (antes era comprimido uma 2.ª vez)
      files.zipPronto = zipPath;
    } else {
      fileUrl = await uploadToStorage(files[0].path, storagePath, MIME[extUnico] ?? 'application/octet-stream');
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

    // ZIP para o browser: o mesmo que foi guardado no Storage
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${isVetor ? 'porta-chaves' : design_id}.zip"`);
    const zipPronto = files.zipPronto;
    fs.createReadStream(zipPronto).pipe(res);
    res.on('finish', () => { fs.unlink(zipPronto, () => {}); cleanupFiles(files); tempImageFiles.forEach(f => fsp.unlink(f).catch(() => {})); const txtTmp = `${base}_hueforge.txt`; fsp.unlink(txtTmp).catch(() => {}); });

  } catch (err) {
    console.error('DOWNLOAD_FAILED', err);
    res.status(500).send('DOWNLOAD_FAILED');
  }
}
