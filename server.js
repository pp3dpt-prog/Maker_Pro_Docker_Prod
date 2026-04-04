const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

// Configuração de CORS e JSON
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

app.post('/gerar-stl-pro', async (req, res) => {
    const d = req.body;
    const designId = d.id || d.forma; 

    console.log(`🚀 A processar design: ${designId}`);

    try {
        const { data: design, error: dbError } = await supabase
            .from('prod_designs')
            .select('scad_template')
            .eq('id', designId)
            .maybeSingle();

        if (dbError || !design) return res.status(404).json({ error: "Design não encontrado" });

        // --- 1. MAPEAMENTO DE FONTES (Mantido original) ---
        const fontesPathMap = {
            'Bebas': { file: 'fonts/BebasNeue-Regular.ttf', name: 'Bebas Neue' },
            'Playfair': { file: 'fonts/PlayfairDisplay-Bold.ttf', name: 'Playfair Display' },
            'Eindhoven': { file: 'fonts/Eindhoven.ttf', name: 'Eindhoven' },
            'BADABB': { file: 'fonts/BADABB.ttf', name: 'BadaBoom BB' },
            'Open Sans': { file: 'fonts/OpenSans-Bold.ttf', name: 'Open Sans' },
            'OpenSans': { file: 'fonts/OpenSans-Bold.ttf', name: 'Open Sans' },
            'Liberation Sans': { file: 'fonts/LiberationSans-Bold.ttf', name: 'Liberation Sans' }
        };

        const selecao = fontesPathMap[d.fonte] || fontesPathMap['Open Sans'];
        const caminhoAbsolutoFonte = path.resolve(__dirname, selecao.file).replace(/\\/g, '/');
        
        let comandoFonteSCAD = "";
        if (fs.existsSync(caminhoAbsolutoFonte)) {
            comandoFonteSCAD = `use <${caminhoAbsolutoFonte}>\n`;
        }

        // --- 2. FUNÇÃO INTERNA DE RENDERIZAÇÃO ---
        const executarRender = async (prefixo, varsExtras = "") => {
            const fileId = `${prefixo}_${Date.now()}`;
            const tempDir = path.join(__dirname, 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

            const scadPath = path.join(tempDir, `${fileId}.scad`);
            const stlPath = path.join(tempDir, `${fileId}.stl`);

            // Montagem das variáveis (Mantendo a compatibilidade total com Pet Tags e Caixas)
            let variaveisSCAD = varsExtras;
            const dadosParaSCAD = {
                nome: (d.nome_pet || d.nome || "NOME").toUpperCase(),
                telefone: d.telefone || "",
                fontSize: d.fontSize || 7,
                fontSizeN: d.fontSizeN || 5,
                xPos: d.xPos || 0,
                yPos: d.yPos || 0,
                xPosN: d.xPosN || 0,
                yPosN: d.yPosN || 0,
                fonte: selecao.name,
                ...d 
            };

            Object.entries(dadosParaSCAD).forEach(([key, value]) => {
                if (['id', 'forma', 'ui_schema'].includes(key)) return;
                if (typeof value === 'string') {
                    variaveisSCAD += `${key} = "${value.replace(/"/g, "'")}";\n`;
                } else if (typeof value === 'number' || typeof value === 'boolean') {
                    variaveisSCAD += `${key} = ${value};\n`;
                }
            });

            const codigoFinal = `${comandoFonteSCAD}\n$fn=24;\n${variaveisSCAD}\n${design.scad_template}`;
            fs.writeFileSync(scadPath, codigoFinal);

            return new Promise((resolve, reject) => {
                const cmd = `openscad --render -o "${stlPath}" "${scadPath}"`;
                exec(cmd, { timeout: 45000 }, async (error) => {
                    if (error) {
                        if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
                        return reject(error);
                    }

                    try {
                        const fileBuffer = fs.readFileSync(stlPath);
                        const storagePath = `final/${fileId}.stl`;

                        await supabase.storage.from('makers_pro_stl_prod').upload(storagePath, fileBuffer, { 
                            contentType: 'model/stl', upsert: true, cacheControl: '0' 
                        });

                        const { data: urlData } = supabase.storage.from('makers_pro_stl_prod').getPublicUrl(storagePath);
                        
                        fs.unlinkSync(scadPath);
                        fs.unlinkSync(stlPath);
                        resolve(urlData.publicUrl);
                    } catch (err) {
                        reject(err);
                    }
                });
            });
        };

        // --- 3. LÓGICA DE RESPOSTA (Individual ou Múltipla) ---
        if (d.com_tampa === true) {
            console.log("📦 Gerando Caixa e Tampa separadamente...");
            const urlCaixa = await executarRender("caixa", "gerar_parte = 'corpo';\n");
            const urlTampa = await executarRender("tampa", "gerar_parte = 'tampa';\n");
            res.json({ urls: [urlCaixa, urlTampa] });
        } else {
            const urlUnica = await executarRender("render", "gerar_parte = 'tudo';\n");
            res.json({ url: urlUnica });
        }

    } catch (e) {
        console.error("❌ Erro Crítico:", e);
        res.status(500).json({ error: "Erro interno no servidor", details: e.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor MakerPro ativo na porta ${PORT}`));