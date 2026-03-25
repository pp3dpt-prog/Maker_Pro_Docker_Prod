const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || origin.includes('.vercel.app') || origin.includes('localhost')) {
            callback(null, true);
        } else {
            callback(new Error('CORS não permitido'));
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

app.post('/gerar-stl-pro', async (req, res) => {
    const { scad_template, parametros } = req.body;
    
    if (!scad_template || !parametros) {
        return res.status(400).json({ error: "Faltam dados" });
    }

    const id = `pro_${Date.now()}`;
    const scadPath = path.join(tempDir, `${id}.scad`);
    const stlPath = path.join(tempDir, `${id}.stl`);

    const blocoVariaveis = Object.entries(parametros)
        .map(([key, val]) => {
            const safeVal = typeof val === 'string' ? `"${val.replace(/"/g, '')}"` : val;
            return `${key} = ${safeVal};`;
        })
        .join('\n');

    const codigoFinal = `${blocoVariaveis}\n${scad_template}`;

    try {
        fs.writeFileSync(scadPath, codigoFinal);
        const comando = `openscad -o "${stlPath}" "${scadPath}"`;
        
        exec(comando, async (error, stdout, stderr) => {
            if (error) return res.status(500).json({ error: "Erro OpenSCAD: " + stderr });

            try {
                const fileBuffer = fs.readFileSync(stlPath);
                await supabase.storage.from(process.env.STORAGE_BUCKET_NAME).upload(`previews/${id}.stl`, fileBuffer);
                const { data } = supabase.storage.from(process.env.STORAGE_BUCKET_NAME).getPublicUrl(`previews/${id}.stl`);
                
                res.json({ url: data.publicUrl });
            } catch (upErr) {
                res.status(500).json({ error: "Erro no upload" });
            } finally {
                if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
                if (fs.existsSync(stlPath)) fs.unlinkSync(stlPath);
            }
        });
    } catch (err) {
        res.status(500).json({ error: "Erro interno" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Motor dinâmico na porta ${PORT}`));