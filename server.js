const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

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

        // --- 1. MAPEAMENTO DE FONTES ---
        const fontesPathMap = {
            'Bebas': { file: 'fonts/BebasNeue-Regular.ttf', name: 'Bebas Neue' },
            'Playfair': { file: 'fonts/PlayfairDisplay-Bold.ttf', name: 'Playfair Display' },
            'Eindhoven': { file: 'fonts/Eindhoven.ttf', name: 'Eindhoven' },
            'BADABB': { file: 'fonts/BADABB.ttf', name: 'BadaBoom BB' },
            'Open Sans': { file: 'fonts/OpenSans-Bold.ttf', name: 'Open Sans' },
            'Liberation Sans': { file: 'fonts/LiberationSans-Bold.ttf', name: 'Liberation Sans' }
        };

        const selecao = fontesPathMap[d.fonte] || fontesPathMap['Open Sans'];
        const caminhoAbsolutoFonte = path.resolve(__dirname, selecao.file).replace(/\\/g, '/');
        
        let comandoFonteSCAD = "";
        if (fs.existsSync(caminhoAbsolutoFonte)) {
            // IMPORTANTE: Usamos o caminho absoluto e garantimos que o OpenSCAD o regista
            comandoFonteSCAD = `use <${caminhoAbsolutoFonte}>\n`;
        }

        // --- 2. VARIÁVEIS ---
        const nomesPadrao = {
            nome: (d.nome_pet || d.nome || "NOME").toUpperCase(),
            telefone: d.telefone || "",
            fontSize: d.fontSize || 7,
            fontSizeN: d.fontSizeN || 5,
            xPos: d.xPos || 0,
            yPos: d.yPos || 0,
            xPosN: d.xPosN || 0,
            yPosN: d.yPosN || 0,
            fonte: selecao.name 
        };

        let variaveisSCAD = "";
        Object.entries(nomesPadrao).forEach(([key, value]) => {
            if (typeof value === 'string') {
                variaveisSCAD += `${key} = "${value.replace(/"/g, "'")}";\n`;
            } else {
                variaveisSCAD += `${key} = ${value};\n`;
            }
        });

        // --- 3. MONTAGEM OTIMIZADA ---
        // Reduzimos o $fn drasticamente para 24 para garantir que o Render aguenta a renderização
        const codigoFinal = `${comandoFonteSCAD}\n$fn=24;\n${variaveisSCAD}\n${design.scad_template}`;

        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const fileId = `render_${Date.now()}`;
        const scadPath = path.join(tempDir, `${fileId}.scad`);
        const stlPath = path.join(tempDir, `${fileId}.stl`);

        fs.writeFileSync(scadPath, codigoFinal);

        // --- 4. EXECUÇÃO ---
        // Adicionamos flags de memória para o OpenSCAD ser mais conservador
        const cmd = `openscad --render -o "${stlPath}" "${scadPath}"`;
        
        exec(cmd, { timeout: 45000 }, async (error, stdout, stderr) => {
            if (error) {
                console.error("❌ Erro OpenSCAD Detalhado:", stderr || error.message);
                // Se der erro, tentamos apagar os ficheiros para não ocupar espaço
                try { fs.unlinkSync(scadPath); } catch(e){}
                return res.status(500).json({ error: "Erro na renderização", details: stderr });
            }

            try {
                if (!fs.existsSync(stlPath)) throw new Error("STL não gerado");

                const fileBuffer = fs.readFileSync(stlPath);
                const storagePath = `final/${fileId}.stl`;

                const { error: upError } = await supabase.storage
                    .from('makers_pro_stl_prod')
                    .upload(storagePath, fileBuffer, { 
                        contentType: 'model/stl', 
                        upsert: true,
                        cacheControl: '0' 
                    });

                if (upError) throw upError;

                const { data: urlData } = supabase.storage
                    .from('makers_pro_stl_prod')
                    .getPublicUrl(storagePath);

                // Limpeza
                fs.unlink(scadPath, () => {});
                fs.unlink(stlPath, () => {});

                console.log(`✅ Sucesso: ${urlData.publicUrl}`);
                res.json({ url: urlData.publicUrl });

            } catch (err) {
                console.error("❌ Erro Final:", err);
                res.status(500).json({ error: "Erro no processamento final" });
            }
        });

    } catch (e) {
        console.error("❌ Erro Crítico:", e);
        res.status(500).json({ error: "Erro interno" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor MakerPro porta ${PORT}`));