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
    const { user_id, id: produtoId, custo, ...params } = req.body;

    try {
        // 1. BUSCA PERFIL (Nomes exatos da tua tabela image_b8606b.png)
        const { data: perfil, error: pErr } = await supabase
            .from('prod_perfis')
            .select('creditos_disponiveis')
            .eq('id', user_id)
            .single();

        if (pErr || !perfil) {
            return res.status(404).json({ error: "Perfil não encontrado no Supabase." });
        }

        // 2. RENDERIZAÇÃO OPENSCAD
        const outPath = path.join(__dirname, 'tmp', `${Date.now()}.stl`);
        const scadPath = path.join(__dirname, 'scads', `${produtoId}.scad`);
        
        let vars = "";
        Object.entries(params).forEach(([k, v]) => {
            vars += typeof v === 'string' ? ` -D '${k}="${v}"'` : ` -D '${k}=${v}'`;
        });

        exec(`openscad -o "${outPath}" ${vars} "${scadPath}"`, async (err) => {
            if (err) return res.status(500).json({ error: "Erro OpenSCAD." });

            const fileBuffer = fs.readFileSync(outPath);
            const storagePath = `users/${user_id}/${Date.now()}.stl`;
            
            await supabase.storage.from('designs-vault').upload(storagePath, fileBuffer);
            const { data: urlData } = supabase.storage.from('designs-vault').getPublicUrl(storagePath);

            // 3. ATUALIZAÇÃO DE SALDO (creditos_disponiveis)
            const novoSaldo = perfil.creditos_disponiveis - (custo || 1);
            await supabase.from('prod_perfis').update({ creditos_disponiveis: novoSaldo }).eq('id', user_id);

            fs.unlinkSync(outPath);
            res.json({ url: urlData.publicUrl, novoSaldo });
        });
    } catch (e) {
        res.status(500).json({ error: "Erro interno." });
    }
});

app.listen(process.env.PORT || 10000, '0.0.0.0');