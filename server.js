const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

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
            .select('scad_template, ui_schema, default_size_nome')
            .eq('id', designId)
            .maybeSingle();

        if (dbError) throw dbError;
        if (!design) return res.status(404).json({ error: "Design não encontrado" });

        // --- 1. MAPEAMENTO DE FONTES ---
        // No server.js, atualiza para os nomes REAIS que o OpenSCAD reconhece após o 'use'
        const fontesPathMap = {
            'Bebas': { file: 'fonts/BebasNeue-Regular.ttf', name: 'Bebas Neue' },
            'Playfair': { file: 'fonts/PlayfairDisplay-Bold.ttf', name: 'Playfair Display' },
            'Eindhoven': { file: 'fonts/Eindhoven.ttf', name: 'Eindhoven' },
            'BADABB': { file: 'fonts/BADABB.ttf', name: 'BadaBoom BB' },
            'Open Sans': { file: 'fonts/OpenSans-Bold.ttf', name: 'Open Sans' }
        };

        const selecao = fontesPathMap[d.fonte] || { file: 'fonts/OpenSans-Bold.ttf', name: 'Open Sans' };
        const caminhoAbsolutoFonte = path.join(__dirname, selecao.file);
        const nomeRealFonte = selecao.name; // <--- Este é o segredo

        // --- 2. MAPEAMENTO DE VARIÁVEIS (CORRIGIDO PARA O TEU UI_SCHEMA) ---
        // Priorizamos 'nome_pet' que é o que está no teu JSON de schema
        const nomesPadrao = {
            nome: (d.nome_pet || d.nome || "NOME").toUpperCase(),
            telefone: d.telefone || d.numero || "",
            fontSize: d.fontSize || d.tamanho || 7,
            fontSizeN: d.fontSizeN || d.tamanho_verso || 6.5,
            xPos: d.xPos || 0,
            yPos: d.yPos || 0,
            xPosN: d.xPosN || 0,
            yPosN: d.yPosN || 0,
            fonte: nomeRealFonte 
        };

        let variaveisSCAD = "";
        Object.entries(nomesPadrao).forEach(([key, value]) => {
            if (typeof value === 'string') {
                // Escapar aspas duplas para evitar quebra de código no OpenSCAD
                const stringSegura = value.replace(/"/g, "'");
                variaveisSCAD += `${key} = "${stringSegura}";\n`;
            } else {
                variaveisSCAD += `${key} = ${value};\n`;
            }
        });

        // --- 3. MONTAGEM DO CÓDIGO FINAL ---
        // As variáveis injetadas aqui têm prioridade se o template NÃO as definir novamente
        const codigoFinal = `${comandoFonteSCAD}\n$fn=64;\n${variaveisSCAD}\n${design.scad_template}`;

        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const fileId = `render_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const scadPath = path.join(tempDir, `${fileId}.scad`);
        const stlPath = path.join(tempDir, `${fileId}.stl`);

        fs.writeFileSync(scadPath, codigoFinal);
        console.log("--- CÓDIGO GERADO ---");
        console.log(codigoFinal);
        console.log("---------------------");

        // --- 4. EXECUÇÃO OPENSCAD ---
        exec(`openscad -o "${stlPath}" "${scadPath}"`, async (error, stdout, stderr) => {
            if (error) {
                console.error("Erro OpenSCAD:", stderr);
                return res.status(500).json({ error: "Erro na renderização 3D" });
            }

            try {
                if (!fs.existsSync(stlPath)) throw new Error("Ficheiro STL não foi gerado");

                const fileBuffer = fs.readFileSync(stlPath);
                
                // Tenta mudar o caminho do upload para incluir um timestamp e evitar cache
                const { error: upError } = await supabase.storage
                    .from('makers_pro_stl_prod')
                    .upload(`final/${fileId}_${Date.now()}.stl`, 
                    fileBuffer, { contentType: 'model/stl', upsert: true });

                if (upError) throw upError;

                const { data: urlData } = supabase.storage
                    .from('makers_pro_stl_prod')
                    .getPublicUrl(`final/${fileId}.stl`);

                // Limpeza imediata dos ficheiros locais para poupar espaço
                fs.unlink(scadPath, () => {});
                fs.unlink(stlPath, () => {});

                res.json({ url: urlData.publicUrl });
            } catch (err) {
                console.error("Erro no processamento do ficheiro:", err);
                res.status(500).json({ error: "Erro ao processar/guardar o ficheiro final" });
            }
        });

    } catch (e) {
        console.error("Erro Crítico no Servidor:", e);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor MakerPro online na porta ${PORT}`);
});