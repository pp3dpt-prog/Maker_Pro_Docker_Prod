const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

// Configuração de CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Inicialização do Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.post('/gerar-stl-pro', async (req, res) => {
    const d = req.body;
    const designId = d.id || d.forma; 

    console.log(`🚀 A processar design: ${designId}`);

    try {
        // 1. Procura o design na tabela
        const { data: design, error: dbError } = await supabase
            .from('prod_designs')
            .select('scad_template, ui_schema, default_size_nome')
            .eq('id', designId)
            .maybeSingle();

        if (dbError) throw dbError;
        if (!design) return res.status(404).json({ error: "Design não encontrado" });

        // 2. Montagem das variáveis
        let variaveisSCAD = "";
        const esquema = design.ui_schema || [];
        
        esquema.forEach(campo => {
            const valorUser = d[campo.name] !== undefined ? d[campo.name] : campo.default;
            if (campo.type === 'text' || campo.type === 'font-select') {
                const stringSegura = valorUser.toString().replace(/"/g, "'");
                variaveisSCAD += `${campo.name} = "${stringSegura}";\n`;
            } else {
                variaveisSCAD += `${campo.name} = ${valorUser};\n`;
            }
        });

        const escalaBase = d.escala || design.default_size_nome || 30;
        variaveisSCAD += `escala = ${escalaBase};\n`;

        // 3. Código Final
        const codigoFinal = `$fn=64;\n${variaveisSCAD}\n${design.scad_template}`;

        // 4. Ficheiros Temporários
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const fileId = `render_${Date.now()}`;
        const scadPath = path.join(tempDir, `${fileId}.scad`);
        const stlPath = path.join(tempDir, `${fileId}.stl`);

        fs.writeFileSync(scadPath, codigoFinal);

        // 5. Execução OpenSCAD
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

                // Limpeza
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