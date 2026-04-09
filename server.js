const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// CONFIGURAÇÃO SUPABASE COM SERVICE ROLE (IGNORA RLS)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

app.post('/gerar-stl-pro', async (req, res) => {
    const d = req.body;
    const userId = d.user_id;
    const produtoId = d.id;
    const custo = d.custo || 1;
    const nomePersonalizado = d.nome_personalizado || `design_${Date.now()}`;

    // Nomes de ficheiros
    const outputFileName = `${produtoId}_${Date.now()}.stl`;
    const outputPath = path.join(tmpDir, outputFileName);
    const scadPath = path.join(__dirname, 'scads', `${produtoId}.scad`);

    console.log(`>>> Processando: User ${userId} | Produto ${produtoId}`);

    try {
        // 1. VALIDAÇÃO DE UTILIZADOR
        if (!userId) return res.status(400).json({ error: "ID de utilizador ausente." });

        const { data: perfil, error: pErr } = await supabase
            .from('prod_perfis')
            .select('creditos_disponiveis')
            .eq('id', userId)
            .single();

        if (pErr || !perfil) {
            console.error("Erro ao buscar perfil:", pErr);
            return res.status(404).json({ error: "Perfil não encontrado no sistema." });
        }

        if (perfil.creditos_disponiveis < custo) {
            return res.status(400).json({ error: "Saldo insuficiente." });
        }

        // 2. MONTAGEM DE PARÂMETROS OPENSCAD
        let vars = "";
        Object.keys(d).forEach(k => {
            if (!['id', 'user_id', 'custo', 'nome_personalizado'].includes(k)) {
                vars += typeof d[k] === 'string' ? ` -D '${k}="${d[k]}"'` : ` -D '${k}=${d[k]}'`;
            }
        });

        // 3. EXECUÇÃO DO OPENSCAD
        const cmd = `openscad -o "${outputPath}" ${vars} "${scadPath}"`;
        exec(cmd, async (err) => {
            if (err) {
                console.error("Erro OpenSCAD:", err);
                return res.status(500).json({ error: "Falha na renderização 3D." });
            }

            try {
                // 4. UPLOAD PARA STORAGE
                const fileBuffer = fs.readFileSync(outputPath);
                const storagePath = `users/${userId}/${outputFileName}`;
                
                const { error: upErr } = await supabase.storage
                    .from('designs-vault')
                    .upload(storagePath, fileBuffer, { contentType: 'application/sla' });

                if (upErr) throw upErr;

                const { data: urlData } = supabase.storage.from('designs-vault').getPublicUrl(storagePath);

                // 5. DEDUÇÃO DE CRÉDITOS
                const novoSaldo = perfil.creditos_disponiveis - custo;
                await supabase.from('prod_perfis').update({ creditos_disponiveis: novoSaldo }).eq('id', userId);

                // 6. REGISTO NO COFRE (ASSETS)
                await supabase.from('prod_user_assets').insert([{
                    user_id: userId,
                    design_id: produtoId,
                    nome_personalizado: nomePersonalizado,
                    stl_url: urlData.publicUrl,
                    custo_pago: custo,
                    last_rendered_at: new Date().toISOString()
                }]);

                // Limpeza e Resposta
                fs.unlinkSync(outputPath);
                res.json({ url: urlData.publicUrl, novoSaldo });

            } catch (innerErr) {
                console.error("Erro pós-renderização:", innerErr);
                res.status(500).json({ error: "Erro ao salvar design." });
            }
        });
    } catch (err) {
        res.status(500).json({ error: "Erro interno no servidor." });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor a correr na porta ${PORT}`));