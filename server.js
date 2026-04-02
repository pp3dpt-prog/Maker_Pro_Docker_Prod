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

    try {
        const { data: design, error: dbError } = await supabase
            .from('prod_designs')
            .select('scad_template, ui_schema, default_size_nome')
            .eq('id', designId)
            .maybeSingle();

        if (dbError) throw dbError;
        if (!design) return res.status(404).json({ error: "Design não encontrado" });

        // --- MAPEAMENTO INTELIGENTE (A SOLUÇÃO) ---
        // Aqui garantimos que o OpenSCAD recebe nomes consistentes
        const nomesPadrao = {
            nome: d.nome || d.nome_pet || "Sem Nome",
            telefone: d.telefone || d.numero || "",
            fontSize: d.fontSize || d.tamanho || 7,
            fontSizeN: d.fontSizeN || d.tamanho_verso || 6.5,
            xPos: d.xPos || 0,
            yPos: d.yPos || 0,
            xPosN: d.xPosN || 0,
            yPosN: d.yPosN || 0,
            fonte: d.fonte || d.fonte_escolhida || "Liberation Sans"
        };

        let variaveisSCAD = "";
        Object.entries(nomesPadrao).forEach(([key, value]) => {
            if (typeof value === 'string') {
                const stringSegura = value.replace(/"/g, "'");
                variaveisSCAD += `${key} = "${stringSegura}";\n`;
            } else {
                variaveisSCAD += `${key} = ${value};\n`;
            }
        });

        // Adiciona a escala base se necessário
        const escalaBase = d.escala || design.default_size_nome || 30;
        variaveisSCAD += `escala = ${escalaBase};\n`;

        // Código Final: Injetamos as variáveis ANTES do template
        const codigoFinal = `$fn=64;\n${variaveisSCAD}\n${design.scad_template}`;

        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const fileId = `render_${Date.now()}`;
        const scadPath = path.join(tempDir, `${fileId}.scad`);
        const stlPath = path.join(tempDir, `${fileId}.stl`);

        fs.writeFileSync(scadPath, codigoFinal);

        exec(`openscad -o "${stlPath}" "${scadPath}"`, async (error, stdout, stderr) => {
            if (error) {
                console.error("Erro OpenSCAD:", stderr);
                return res.status(500).json({ error: "Erro na renderização" });
            }

            try {
                const fileBuffer = fs.readFileSync(stlPath);
                const { error: upError } = await supabase.storage
                    .from('makers_pro_stl_prod')
                    .upload(`final/${fileId}.stl`, fileBuffer, { contentType: 'model/stl', upsert: true });

                if (upError) throw upError;

                const { data: urlData } = supabase.storage
                    .from('makers_pro_stl_prod')
                    .getPublicUrl(`final/${fileId}.stl`);

                fs.unlink(scadPath, () => {});
                fs.unlink(stlPath, () => {});

                res.json({ url: urlData.publicUrl });
            } catch (err) {
                res.status(500).json({ error: "Erro no upload" });
            }
        });

    } catch (e) {
        console.error("Erro Crítico:", e);
        res.status(500).json({ error: "Erro interno" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor online na porta ${PORT}`);
});