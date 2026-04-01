const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // <--- USA ESTA!

if (!supabaseServiceKey) {
    console.error("ERRO: SUPABASE_SERVICE_ROLE_KEY não definida nas variáveis de ambiente!");
}

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

app.post('/gerar-stl-pro', async (req, res) => {
    const d = req.body;
    // O ID deve corresponder ao UUID na tabela prod_designs
    const designId = d.id || d.forma; 

    try {
        // 1. Procurar o design e as suas configurações na tabela
        const { data: design, error } = await supabase
            .from('prod_designs')
            .select('scad_template, ui_schema, default_size_nome')
            .eq('id', designId)
            .single();

        if (error || !design) {
            console.error("❌ Design não encontrado:", error);
            return res.status(404).json({ error: "Design não encontrado na base de dados" });
        }

        // 2. Mapear variáveis dinamicamente usando o ui_schema
        let variaveisInjetadas = "";
        const esquema = design.ui_schema || [];
        
        esquema.forEach(campo => {
            // Obtém o valor enviado pelo utilizador ou usa o padrão do esquema
            const valorUser = d[campo.name] !== undefined ? d[campo.name] : campo.default;
            
            if (campo.type === 'text' || campo.type === 'font-select') {
                // Injeção segura de strings para o OpenSCAD
                const stringSegura = valorUser.toString().replace(/"/g, "'");
                variaveisInjetadas += `${campo.name} = "${stringSegura}";\n`;
            } else {
                // Injeção de valores numéricos
                variaveisInjetadas += `${campo.name} = ${valorUser};\n`;
            }
        });

        // Adiciona a variável 'escala' que o teu SCAD utiliza
        const escalaBase = d.escala || design.default_size_nome || 30;
        variaveisInjetadas += `escala = ${escalaBase};\n`;

        // 3. Montar o código SCAD final (Variáveis + Template da DB)
        const codigoFinal = `
$fn=64;
// --- Variáveis Injetadas pelo Servidor ---
${variaveisInjetadas}

// --- Template Base do Design ---
${design.scad_template}
`;

        // 4. Processamento da Renderização
        const idUnico = `final_${Date.now()}`;
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        
        const scadPath = path.join(tempDir, `${idUnico}.scad`);
        const stlPath = path.join(tempDir, `${idUnico}.stl`);
        
        fs.writeFileSync(scadPath, codigoFinal);

        exec(`openscad -o "${stlPath}" "${scadPath}"`, async (err, stdout, stderr) => {
            if (err) {
                console.error("ERRO OPENSCAD:", stderr);
                return res.status(500).json({ error: "Falha na renderização 3D", details: stderr });
            }

            try {
                const fileBuffer = fs.readFileSync(stlPath);
                // Upload para o bucket final
                const { error: upErr } = await supabase.storage
                    .from('makers_pro_stl_prod')
                    .upload(`final/${idUnico}.stl`, fileBuffer, { contentType: 'model/stl', upsert: true });

                if (upErr) throw upErr;

                const { data: urlPublica } = supabase.storage
                    .from('makers_pro_stl_prod')
                    .getPublicUrl(`final/${idUnico}.stl`);
                
                // Limpeza assíncrona
                fs.unlink(scadPath, () => {});
                fs.unlink(stlPath, () => {});

                res.json({ url: urlPublica.publicUrl });
            } catch (storageError) {
                console.error("ERRO STORAGE:", storageError);
                res.status(500).json({ error: "Erro ao guardar o modelo gerado" });
            }
        });

    } catch (e) {
        console.error("ERRO SERVIDOR:", e);
        res.status(500).json({ error: "Erro interno no processamento" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Motor Maker Pro pronto na porta ${PORT}`));