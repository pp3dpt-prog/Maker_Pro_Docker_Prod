const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// IMPORTANTE: Usar SERVICE_ROLE_KEY no Docker para ignorar o RLS
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

app.post('/gerar-stl-pro', async (req, res) => {
    const { user_id, id: produtoId, custo, ...params } = req.body;

    try {
        // Busca usando o nome exato da tua coluna: creditos_disponiveis
        const { data: perfil, error: pErr } = await supabase
            .from('prod_perfis')
            .select('creditos_disponiveis')
            .eq('id', user_id)
            .single();

        if (pErr || !perfil) {
            console.error("User ID não encontrado:", user_id);
            return res.status(404).json({ error: "Perfil não encontrado na tabela prod_perfis." });
        }

        if (perfil.creditos_disponiveis < (custo || 1)) {
            return res.status(400).json({ error: "Saldo insuficiente." });
        }

        // Lógica de Renderização OpenSCAD
        const outPath = path.join(__dirname, 'tmp', `${Date.now()}.stl`);
        const scadPath = path.join(__dirname, 'scads', `${produtoId}.scad`);
        let vars = "";
        Object.entries(params).forEach(([k, v]) => {
            vars += typeof v === 'string' ? ` -D '${k}="${v}"'` : ` -D '${k}=${v}'`;
        });

        exec(`openscad -o "${outPath}" ${vars} "${scadPath}"`, async (err) => {
            if (err) return res.status(500).json({ error: "Erro de renderização." });

            const fileBuffer = fs.readFileSync(outPath);
            const storagePath = `users/${user_id}/${Date.now()}.stl`;
            
            await supabase.storage.from('designs-vault').upload(storagePath, fileBuffer);
            const { data: urlData } = supabase.storage.from('designs-vault').getPublicUrl(storagePath);

            // Atualiza a coluna correta: creditos_disponiveis
            const novoSaldo = perfil.creditos_disponiveis - (custo || 1);
            await supabase.from('prod_perfis').update({ creditos_disponiveis: novoSaldo }).eq('id', user_id);

            fs.unlinkSync(outPath);
            res.json({ url: urlData.publicUrl, novoSaldo });
        });
    } catch (e) {
        res.status(500).json({ error: "Erro interno no servidor." });
    }
});

app.listen(process.env.PORT || 10000, '0.0.0.0');