const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

app.post('/gerar-stl-pro', async (req, res) => {
    const d = req.body;
    const userId = d.user_id; 
    const produtoId = d.id;
    const custo = d.custo || 1;
    const outputFileName = `${produtoId}_${Date.now()}.stl`;
    const outputPath = path.join(tmpDir, outputFileName);
    const scadPath = path.join(__dirname, 'scads', `${produtoId}.scad`);

    try {
        // 1. Validar Utilizador (Resolve o erro "Perfil não encontrado")
        if (!userId) return res.status(400).json({ error: "ID de utilizador ausente." });

        const { data: perfil, error: perfilErr } = await supabase
            .from('prod_perfis')
            .select('creditos_disponiveis')
            .eq('id', userId)
            .single();

        if (perfilErr || !perfil) return res.status(404).json({ error: "Perfil não encontrado no Supabase." });
        if (perfil.creditos_disponiveis < custo) return res.status(400).json({ error: "Saldo insuficiente." });

        // 2. Mapear Parâmetros para OpenSCAD
        let vars = "";
        Object.keys(d).forEach(k => {
            if (!['id', 'user_id', 'custo', 'nome_personalizado'].includes(k)) {
                vars += typeof d[k] === 'string' ? ` -D '${k}="${d[k]}"'` : ` -D '${k}=${d[k]}'`;
            }
        });

        // 3. Executar OpenSCAD
        const cmd = `openscad -o "${outputPath}" ${vars} "${scadPath}"`;
        exec(cmd, async (err) => {
            if (err) return res.status(500).json({ error: "Falha na renderização 3D." });

            try {
                // 4. Upload para Storage
                const fileBuffer = fs.readFileSync(outputPath);
                const vaultPath = `users/${userId}/${outputFileName}`;
                await supabase.storage.from('designs-vault').upload(vaultPath, fileBuffer, { contentType: 'application/sla' });
                const { data: urlData } = supabase.storage.from('designs-vault').getPublicUrl(vaultPath);

                // 5. Atualizar Saldo e Registar Asset
                const novoSaldo = perfil.creditos_disponiveis - custo;
                await supabase.from('prod_perfis').update({ creditos_disponiveis: novoSaldo }).eq('id', userId);
                await supabase.from('prod_user_assets').insert([{
                    user_id: userId,
                    design_id: produtoId,
                    nome_personalizado: d.nome_personalizado,
                    stl_url: urlData.publicUrl,
                    custo_pago: custo,
                    last_rendered_at: new Date().toISOString()
                }]);

                fs.unlinkSync(outputPath);
                res.json({ url: urlData.publicUrl, novoSaldo });

            } catch (e) {
                res.status(500).json({ error: "Erro ao salvar ficheiro final." });
            }
        });
    } catch (err) {
        res.status(500).json({ error: "Erro interno no servidor." });
    }
});

app.listen(process.env.PORT || 10000, '0.0.0.0', () => console.log("Servidor Maker Pro Online"));