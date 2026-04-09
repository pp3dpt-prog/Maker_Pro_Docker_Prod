const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// CONFIGURAÇÃO - Usa as variáveis do teu Docker
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

app.post('/gerar-stl-pro', async (req, res) => {
    // Extraímos exatamente o que o frontend envia
    const { user_id, id: produtoId, custo, nome_personalizado, ...params } = req.body;

    try {
        // BUSCA DO PERFIL - Coluna exata: creditos_disponiveis
        const { data: perfil, error: pErr } = await supabase
            .from('prod_perfis')
            .select('creditos_disponiveis')
            .eq('id', user_id)
            .single();

        if (pErr || !perfil) {
            // Se falhar aqui, o log do Docker dirá o porquê (Ex: Tabela não existe ou ID não bate)
            console.error("Erro Supabase:", pErr?.message);
            return res.status(404).json({ error: "Perfil não encontrado na tabela prod_perfis." });
        }

        // VALIDAÇÃO DE SALDO
        if (perfil.creditos_disponiveis < (custo || 1)) {
            return res.status(400).json({ error: "Saldo insuficiente." });
        }

        // RENDERIZAÇÃO OPENSCAD
        const outputName = `${produtoId}_${Date.now()}.stl`;
        const outputPath = path.join(tmpDir, outputName);
        const scadPath = path.join(__dirname, 'scads', `${produtoId}.scad`);
        
        let cmdVars = "";
        for (const [key, val] of Object.entries(params)) {
            cmdVars += typeof val === 'string' ? ` -D '${key}="${val}"'` : ` -D '${key}=${val}'`;
        }

        exec(`openscad -o "${outputPath}" ${cmdVars} "${scadPath}"`, async (err) => {
            if (err) return res.status(500).json({ error: "Erro na renderização OpenSCAD." });

            try {
                const fileBuffer = fs.readFileSync(outputPath);
                const storagePath = `users/${user_id}/${outputName}`;
                
                // Upload para o Bucket designs-vault
                await supabase.storage.from('designs-vault').upload(storagePath, fileBuffer);
                const { data: urlData } = supabase.storage.from('designs-vault').getPublicUrl(storagePath);

                // ATUALIZAÇÃO DO SALDO
                const novoSaldo = perfil.creditos_disponiveis - (custo || 1);
                await supabase.from('prod_perfis').update({ creditos_disponiveis: novoSaldo }).eq('id', user_id);

                // REGISTO DO ASSET
                await supabase.from('prod_user_assets').insert([{
                    user_id,
                    design_id: produtoId,
                    stl_url: urlData.publicUrl,
                    nome_personalizado: nome_personalizado || outputName
                }]);

                fs.unlinkSync(outputPath);
                res.json({ success: true, url: urlData.publicUrl, novoSaldo });

            } catch (innerErr) {
                res.status(500).json({ error: "Erro ao finalizar processo de ficheiros." });
            }
        });
    } catch (globalErr) {
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});

app.listen(process.env.PORT || 10000, '0.0.0.0');