const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// CONFIGURAÇÃO COM A TUA SECRET KEY
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

app.post('/gerar-stl-pro', async (req, res) => {
    const { user_id, id: produtoId, custo, nome_personalizado, ...params } = req.body;

    // 1. LIMPEZA DO UUID (Garante que não vão aspas ou espaços extra)
    const cleanUserId = user_id?.trim();

    try {
        if (!cleanUserId) return res.status(400).json({ error: "ID de utilizador não recebido." });

        // 2. BUSCA NA TABELA prod_perfis (Coluna: creditos_disponiveis)
        const { data: perfil, error: pErr } = await supabase
            .from('prod_perfis')
            .select('creditos_disponiveis')
            .eq('id', cleanUserId)
            .single();

        if (pErr || !perfil) {
            console.error("Erro Supabase:", pErr?.message);
            return res.status(404).json({ error: "Perfil não encontrado. Verifica o ID na tabela." });
        }

        // 3. VALIDAÇÃO DE SALDO
        const custoEfetivo = custo || 1;
        if (perfil.creditos_disponiveis < custoEfetivo) {
            return res.status(400).json({ error: "Saldo insuficiente." });
        }

        // 4. PREPARAÇÃO OPENSCAD
        const outName = `${produtoId}_${Date.now()}.stl`;
        const outPath = path.join(tmpDir, outName);
        const scadPath = path.join(__dirname, 'scads', `${produtoId}.scad`);
        
        let cmdVars = "";
        for (const [key, val] of Object.entries(params)) {
            cmdVars += typeof val === 'string' ? ` -D '${key}="${val}"'` : ` -D '${key}=${val}'`;
        }

        // 5. RENDERIZAÇÃO
        exec(`openscad -o "${outPath}" ${cmdVars} "${scadPath}"`, async (err) => {
            if (err) return res.status(500).json({ error: "Erro na renderização." });

            try {
                const fileBuffer = fs.readFileSync(outPath);
                const storagePath = `users/${cleanUserId}/${outName}`;
                
                // Upload para o Bucket
                await supabase.storage.from('designs-vault').upload(storagePath, fileBuffer);
                const { data: urlData } = supabase.storage.from('designs-vault').getPublicUrl(storagePath);

                // 6. ATUALIZAÇÃO DO SALDO (Coluna: creditos_disponiveis)
                const novoSaldo = perfil.creditos_disponiveis - custoEfetivo;
                await supabase.from('prod_perfis')
                    .update({ creditos_disponiveis: novoSaldo })
                    .eq('id', cleanUserId);

                // 7. REGISTO DO ASSET
                await supabase.from('prod_user_assets').insert([{
                    user_id: cleanUserId,
                    design_id: produtoId,
                    stl_url: urlData.publicUrl,
                    nome_personalizado: nome_personalizado || outName
                }]);

                fs.unlinkSync(outPath);
                res.json({ success: true, url: urlData.publicUrl, novoSaldo });

            } catch (innerErr) {
                res.status(500).json({ error: "Erro ao processar ficheiro final." });
            }
        });
    } catch (globalErr) {
        res.status(500).json({ error: "Erro interno no servidor." });
    }
});

app.listen(process.env.PORT || 10000, '0.0.0.0');