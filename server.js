const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

app.post('/gerar-stl-pro', async (req, res) => {
    const { user_id, id: produtoId, custo, nome_personalizado, ...params } = req.body;

    try {
        // Busca do perfil usando a coluna correta
        const { data: perfil, error: pErr } = await supabase
            .from('prod_perfis')
            .select('creditos_disponiveis')
            .eq('id', user_id)
            .single();

        if (pErr || !perfil) {
            return res.status(404).json({ error: "Perfil não encontrado." });
        }

        const outputName = `${produtoId}_${Date.now()}.stl`;
        const outputPath = path.join(__dirname, 'tmp', outputName);
        const scadPath = path.join(__dirname, 'scads', `${produtoId}.scad`);
        
        let vars = "";
        Object.entries(params).forEach(([k, v]) => {
            vars += typeof v === 'string' ? ` -D '${k}="${v}"'` : ` -D '${k}=${v}'`;
        });

        exec(`openscad -o "${outputPath}" ${vars} "${scadPath}"`, async (err) => {
            if (err) return res.status(500).json({ error: "Erro OpenSCAD." });

            const fileBuffer = fs.readFileSync(outputPath);
            const storagePath = `users/${user_id}/${outputName}`;
            
            await supabase.storage.from('designs-vault').upload(storagePath, fileBuffer);
            const { data: urlData } = supabase.storage.from('designs-vault').getPublicUrl(storagePath);

            const novoSaldo = perfil.creditos_disponiveis - (custo || 1);
            await supabase.from('prod_perfis').update({ creditos_disponiveis: novoSaldo }).eq('id', user_id);

            await supabase.from('prod_user_assets').insert([{
                user_id,
                design_id: produtoId,
                stl_url: urlData.publicUrl,
                nome_personalizado: nome_personalizado || outputName
            }]);

            fs.unlinkSync(outputPath);
            res.json({ url: urlData.publicUrl, novoSaldo });
        });
    } catch (e) {
        res.status(500).json({ error: "Erro interno." });
    }
});

app.listen(process.env.PORT || 10000, '0.0.0.0');