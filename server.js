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

        // --- 1. MAPEAMENTO DE FONTES (NOVA FUNCIONALIDADE) ---
        // Mapeia o nome que vem do frontend para o ficheiro real na tua pasta /fonts
        const fontesPathMap = {
            'Bebas': 'fonts/BebasNeue-Regular.ttf',
            'Playfair': 'fonts/PlayfairDisplay-Bold.ttf',
            'Eindhoven': 'fonts/Eindhoven.ttf',
            'BADABB': 'fonts/BADABB.ttf',
            'Open Sans': 'fonts/OpenSans-Bold.ttf',
            'Liberation Sans': 'fonts/LiberationSans-Bold.ttf'
        };

        const nomeFonteOriginal = d.fonte || d.fonte_escolhida || "Liberation Sans";
        const ficheiroFonte = fontesPathMap[nomeFonteOriginal] || 'fonts/OpenSans-Bold.ttf';
        const caminhoAbsolutoFonte = path.join(__dirname, ficheiroFonte);

        // Comando 'use' para o OpenSCAD carregar o ficheiro TTF físico
        const comandoFonteSCAD = `use <${caminhoAbsolutoFonte}>\n`;

        // --- 2. MAPEAMENTO DE VARIÁVEIS ---
        const nomesPadrao = {
            nome: d.nome || d.nome_pet || "Sem Nome",
            telefone: d.telefone || d.numero || "",
            fontSize: d.fontSize || d.tamanho || 7,
            fontSizeN: d.fontSizeN || d.tamanho_verso || 6.5,
            xPos: d.xPos || 0,
            yPos: d.yPos || 0,
            xPosN: d.xPosN || 0,
            yPosN: d.yPosN || 0,
            fonte: nomeFonteOriginal // Mantemos o nome para a função text()
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

        // --- 3. MONTAGEM DO CÓDIGO FINAL ---
        // Combinamos: Fonte + Variáveis + Template do Banco de Dados
        const codigoFinal = `${comandoFonteSCAD}\n$fn=64;\n${variaveisSCAD}\n${design.scad_template}`;

        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const fileId = `render_${Date.now()}`;
        const scadPath = path.join(tempDir, `${fileId}.scad`);
        const stlPath = path.join(tempDir, `${fileId}.stl`);

        fs.writeFileSync(scadPath, codigoFinal);

        // --- 4. EXECUÇÃO OPENSCAD ---
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

                // Limpeza de ficheiros temporários
                fs.unlink(scadPath, () => {});
                fs.unlink(stlPath, () => {});

                res.json({ url: urlData.publicUrl });
            } catch (err) {
                console.error("Erro Upload/Storage:", err);
                res.status(500).json({ error: "Erro ao guardar STL" });
            }
        });

    } catch (e) {
        console.error("Erro Crítico:", e);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor online na porta ${PORT}`);
});