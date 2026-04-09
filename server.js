const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração simples com Service Role para o Storage
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

app.post('/gerar-stl-pro', async (req, res) => {
    const { user_id, id: produtoId, nome_personalizado, ...params } = req.body;

    if (!user_id || !produtoId) {
        return res.status(400).json({ error: "Dados insuficientes (user_id ou produtoId)." });
    }

    // Nome único para o ficheiro
    const outputName = `${produtoId}_${Date.now()}.stl`;
    const outputPath = path.join(tmpDir, outputName);
    const scadPath = path.join(__dirname, 'scads', `${produtoId}.scad`);

    // Montar variáveis para o OpenSCAD
    let cmdVars = "";
    for (const [key, val] of Object.entries(params)) {
        if (key !== 'id' && key !== 'user_id' && key !== 'nome_personalizado') {
            cmdVars += typeof val === 'string' ? ` -D '${key}="${val}"'` : ` -D '${key}=${val}'`;
        }
    }

    // Execução do OpenSCAD
    exec(`openscad -o "${outputPath}" ${cmdVars} "${scadPath}"`, async (err) => {
        if (err) {
            console.error("Erro OpenSCAD:", err);
            return res.status(500).json({ error: "Erro na renderização do ficheiro." });
        }

        try {
            const fileBuffer = fs.readFileSync(outputPath);
            const storagePath = `users/${user_id}/${outputName}`;

            // Upload para o Bucket
            const { error: upErr } = await supabase.storage.from('designs-vault').upload(storagePath, fileBuffer);
            if (upErr) throw upErr;

            const { data: urlData } = supabase.storage.from('designs-vault').getPublicUrl(storagePath);

            // IMPORTANTE: Não alteramos créditos aqui. Apenas respondemos com a URL.
            res.json({ success: true, url: urlData.publicUrl });

            // Limpeza
            fs.unlinkSync(outputPath);
        } catch (dbErr) {
            console.error("Erro Storage:", dbErr.message);
            res.status(500).json({ error: "Erro ao guardar o ficheiro gerado." });
        }
    });
});

app.listen(process.env.PORT || 10000, '0.0.0.0');