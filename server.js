const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

// Configuração de CORS para permitir o teu frontend
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.post('/gerar-stl-pro', async (req, res) => {
    const d = req.body;
    const designId = d.id || d.forma; 

    console.log(`🚀 A processar design: ${designId}`);
    console.log(`📦 Dados recebidos:`, d);

    try {
        const { data: design, error: dbError } = await supabase
            .from('prod_designs')
            .select('scad_template')
            .eq('id', designId)
            .maybeSingle();

        if (dbError || !design) return res.status(404).json({ error: "Design não encontrado" });

        // --- 1. MAPEAMENTO DE FONTES (NOMES REAIS PARA O OPENSCAD) ---
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
        
        // Definição da variável de carregamento de fonte
        let comandoFonteSCAD = "";
        if (fs.existsSync(caminhoAbsolutoFonte)) {
            comandoFonteSCAD = `use <${caminhoAbsolutoFonte}>\n`;
            console.log(`✅ Fonte carregada: ${selecao.name}`);
        } else {
            console.warn(`⚠️ Ficheiro de fonte não encontrado: ${caminhoAbsolutoFonte}`);
        }

        // --- 2. MAPEAMENTO DE VARIÁVEIS (RESPEITANDO O UI_SCHEMA) ---
        const nomesPadrao = {
            nome: (d.nome_pet || d.nome || "NOME").toUpperCase(),
            telefone: d.telefone || "",
            fontSize: d.fontSize || d.tamanho || 7,
            fontSizeN: d.fontSizeN || d.tamanho_verso || 5,
            xPos: d.xPos || 0,
            yPos: d.yPos || 0,
            xPosN: d.xPosN || 0,
            yPosN: d.yPosN || 0,
            fonte: selecao.name // Nome interno que o OpenSCAD entende
        };

        let variaveisSCAD = "";
        Object.entries(nomesPadrao).forEach(([key, value]) => {
            if (typeof value === 'string') {
                variaveisSCAD += `${key} = "${value.replace(/"/g, "'")}";\n`;
            } else {
                variaveisSCAD += `${key} = ${value};\n`;
            }
        });

        // --- 3. MONTAGEM DO CÓDIGO FINAL ---
        const codigoFinal = `${comandoFonteSCAD}\n$fn=64;\n${variaveisSCAD}\n${design.scad_template}`;

        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const fileId = `render_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const scadPath = path.join(tempDir, `${fileId}.scad`);
        const stlPath = path.join(tempDir, `${fileId}.stl`);

        fs.writeFileSync(scadPath, codigoFinal);

        // --- 4. EXECUÇÃO OPENSCAD (COM TIMEOUT) ---
        exec(`openscad -o "${stlPath}" "${scadPath}"`, { timeout: 35000 }, async (error, stdout, stderr) => {
            if (error) {
                console.error("❌ Erro OpenSCAD:", stderr);
                return res.status(500).json({ error: "Erro na renderização 3D", details: stderr });
            }

            try {
                if (!fs.existsSync(stlPath)) throw new Error("STL não gerado pelo OpenSCAD");

                const fileBuffer = fs.readFileSync(stlPath);
                
                const { error: upError } = await supabase.storage
                    .from('makers_pro_stl_prod')
                    .upload(`final/${fileId}.stl`, fileBuffer, { 
                        contentType: 'model/stl', 
                        upsert: true,
                        cacheControl: '0' 
                    });

                if (upError) throw upError;

                const { data: urlData } = supabase.storage
                    .from('makers_pro_stl_prod')
                    .getPublicUrl(`final/${fileId}.stl`);

                // Limpeza de ficheiros temporários
                fs.unlink(scadPath, () => {});
                fs.unlink(stlPath, () => {});

                console.log(`✅ STL Gerado com sucesso: ${urlData.publicUrl}`);
                res.json({ url: urlData.publicUrl });

            } catch (err) {
                console.error("❌ Erro no Processamento Final:", err);
                res.status(500).json({ error: "Erro ao processar/guardar o ficheiro" });
            }
        });

    } catch (e) {
        console.error("❌ Erro Crítico:", e);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor MakerPro online na porta ${PORT}`);
});