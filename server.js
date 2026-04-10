const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Service Role Key para garantir que o upload para o Storage não falhe por permissões
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

app.post('/gerar-stl-pro', async (req, res) => {
    const { user_id, id: produtoId, ...params } = req.body;

    if (!user_id || !produtoId) {
        return res.status(400).json({ error: "user_id e produtoId são obrigatórios." });
    }

    const outputName = `${produtoId}_${Date.now()}.stl`;
    const outputPath = path.join(tmpDir, outputName);
    const scadPath = path.join(__dirname, 'scads', `${produtoId}.scad`);

    // MONTAGEM DE VARIÁVEIS SEGURA
    let cmdVars = "";
    Object.entries(params).forEach(([key, val]) => {
        if (key !== 'id' && key !== 'user_id') {
            // Se for string (texto ou fonte), envolve em aspas duplas escapadas para o OpenSCAD
            const formattedVal = typeof val === 'string' ? `"${val.replace(/"/g, '\\"')}"` : val;
            cmdVars += ` -D ${key}=${formattedVal}`;
        }
    });

    console.log(`Gerando STL para ${user_id}. Comando: openscad -o "${outputName}" ${cmdVars}`);

    exec(`openscad -o "${outputPath}" ${cmdVars} "${scadPath}"`, async (err) => {
        if (err) {
            console.error("Erro no OpenSCAD:", err);
            return res.status(500).json({ error: "Falha ao processar o modelo 3D." });
        }

        try {
            const fileBuffer = fs.readFileSync(outputPath);
            const storagePath = `users/${user_id}/${outputName}`;

            const { error: upErr } = await supabase.storage
                .from('designs-vault')
                .upload(storagePath, fileBuffer, { contentType: 'application/sla', upsert: true });

            if (upErr) throw upErr;

            const { data: urlData } = supabase.storage.from('designs-vault').getPublicUrl(storagePath);

            res.json({ success: true, url: urlData.publicUrl });

            // Limpeza de ficheiro temporário
            fs.unlinkSync(outputPath);
        } catch (error) {
            console.error("Erro no processo de upload:", error.message);
            res.status(500).json({ error: "Erro ao salvar o ficheiro no Storage." });
        }
    });
});

app.listen(process.env.PORT || 10000, '0.0.0.0');