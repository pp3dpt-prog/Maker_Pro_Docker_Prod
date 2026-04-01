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

    try {
        // 1. Procurar o design e o seu esquema de UI na tabela
        const { data: design, error } = await supabase
            .from('prod_designs')
            .select('scad_template, ui_schema, default_size_nome')
            .eq('id', designId)
            .single();

        if (error || !design) {
            return res.status(404).json({ error: "Design não encontrado" });
        }

        // 2. Mapear dinamicamente as variáveis baseadas no ui_schema
        // O ui_schema diz-nos que campos esperar: nome_pet, telefone, etc.
        let variaveisSCAD = "";
        const campos = design.ui_schema || [];
        
        campos.forEach(campo => {
            const valorUser = d[campo.name] || campo.default;
            if (campo.type === 'text' || campo.type === 'font-select') {
                // Injeta como string
                variaveisSCAD += `${campo.name} = "${valorUser.toString().replace(/"/g, "'")}";\n`;
            } else {
                // Injeta como número
                variaveisSCAD += `${campo.name} = ${valorUser};\n`;
            }
        });

        // Adiciona a escala (usando o valor do user ou o default da tabela)
        const escala = d.escala || design.default_size_nome || 30;
        variaveisSCAD += `escala = ${escala};\n`;

        // 3. Construção do código final
        const codigoFinal = `
$fn=64;
${variaveisSCAD}
${design.scad_template}
`;

        // 4. Renderização e Upload
        const id = `final_${Date.now()}`;
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        
        const scadPath = path.join(tempDir, `${id}.scad`);
        const stlPath = path.join(tempDir, `${id}.stl`);
        
        fs.writeFileSync(scadPath, codigoFinal);

        exec(`openscad -o "${stlPath}" "${scadPath}"`, async (err, stdout, stderr) => {
            if (err) {
                console.error("Erro OpenSCAD:", stderr);
                return res.status(500).json({ error: "Erro na renderização" });
            }

            const fileBuffer = fs.readFileSync(stlPath);
            await supabase.storage.from('makers_pro_stl_prod').upload(`final/${id}.stl`, fileBuffer);
            
            const { data: urlData } = supabase.storage.from('makers_pro_stl_prod').getPublicUrl(`final/${id}.stl`);
            
            fs.unlink(scadPath, () => {});
            fs.unlink(stlPath, () => {});

            res.json({ url: urlData.publicUrl });
        });

    } catch (e) {
        console.error("Erro Geral:", e);
        res.status(500).json({ error: "Erro interno" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Motor ativo na porta ${PORT}`));