const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

app.post('/gerar-stl-pro', async (req, res) => {
    const d = req.body;
    const designId = d.id; 

    try {
        const { data: design } = await supabase
            .from('prod_designs')
            .select('scad_template, ui_schema')
            .eq('id', designId)
            .maybeSingle();

        if (!design) return res.status(404).json({ error: "Design não encontrado" });

        // Mapeamento para nomes internos do sistema
        const fontesPathMap = {
            'Bebas': 'Bebas Neue',
            'Playfair': 'Playfair Display',
            'Open Sans': 'Open Sans',
            'OpenSans': 'Open Sans'
        };
        const nomeFonteInterno = fontesPathMap[d.fonte] || 'Open Sans';

        const executarRender = async (prefixo, varsExtras = "") => {
            const fileId = `${prefixo}_${Date.now()}`;
            const tempDir = path.join(__dirname, 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

            const scadPath = path.join(tempDir, `${fileId}.scad`);
            const stlPath = path.join(tempDir, `${fileId}.stl`);

            // Construção das variáveis para o OpenSCAD
            let conteudoVariaveis = varsExtras;
            
            // Injetar variáveis do UI_SCHEMA e CATCH-ALL
            Object.entries(d).forEach(([k, v]) => {
                if (!['id', 'ui_schema', 'fonte'].includes(k)) {
                    if (typeof v === 'number') conteudoVariaveis += `${k} = ${v};\n`;
                    else if (typeof v === 'boolean') conteudoVariaveis += `${k} = ${v ? "true" : "false"};\n`;
                    else if (typeof v === 'string') conteudoVariaveis += `${k} = "${v.replace(/"/g, "'")}";\n`;
                }
            });

            // Forçar variáveis de texto e fonte
            conteudoVariaveis += `fonte = "${nomeFonteInterno}";\n`;
            if (d.nome_pet) conteudoVariaveis += `nome_pet = "${d.nome_pet.toUpperCase()}";\n`;

            // Escrever ficheiro temporário (sem comando 'use', as fontes são globais)
            fs.writeFileSync(scadPath, `$fn=24;\n${conteudoVariaveis}\n${design.scad_template}`);

            return new Promise((resolve, reject) => {
                console.log(`Renderizando STL para: ${d.nome_pet || 'sem_nome'}`);
                exec(`openscad --render -o "${stlPath}" "${scadPath}"`, { timeout: 55000 }, async (err, stdout, stderr) => {
                    if (err) {
                        console.error("Erro OpenSCAD:", stderr);
                        return reject(new Error("Falha na geração 3D"));
                    }

                    const buffer = fs.readFileSync(stlPath);
                    const sPath = `final/${fileId}.stl`;
                    
                    const { error: upErr } = await supabase.storage.from('makers_pro_stl_prod').upload(sPath, buffer, { contentType: 'model/stl', upsert: true });
                    if (upErr) return reject(upErr);

                    const { data } = supabase.storage.from('makers_pro_stl_prod').getPublicUrl(sPath);
                    
                    // Limpeza
                    try { fs.unlinkSync(scadPath); fs.unlinkSync(stlPath); } catch (e) {}
                    resolve(data.publicUrl);
                });
            });
        };

        const url = await executarRender("modelo", `gerar_parte = "tudo";\n`);
        res.json({ url });

    } catch (e) { 
        console.error("Erro no processo:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Porta: ${PORT}`));