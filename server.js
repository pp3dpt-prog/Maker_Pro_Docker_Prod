const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

// Configuração de CORS mantendo o teu domínio original
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "https://maker-pro-frontend-prod.vercel.app");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

app.post('/gerar-stl-pro', async (req, res) => {
    // Agora recebemos o template e os parâmetros dinâmicos do novo page.tsx
    const { scad_template, parametros } = req.body;
    
    if (!scad_template || !parametros) {
        return res.status(400).json({ error: "Faltam dados: template ou parâmetros" });
    }

    const id = `pro_${Date.now()}`;
    const scadPath = path.join(tempDir, `${id}.scad`);
    const stlPath = path.join(tempDir, `${id}.stl`);

    // 1. GERAR O BLOCO DE VARIÁVEIS (Injeção Dinâmica)
    // Mantém a tua lógica de limpeza de carateres para segurança
    const variaveisScad = Object.entries(parametros)
        .map(([key, val]) => {
            if (typeof val === 'string') {
                const textoLimpo = val.replace(/[^a-z0-9 ]/gi, '').trim();
                return `${key} = "${textoLimpo}";`;
            }
            return `${key} = ${val};`;
        })
        .join('\n');

    // 2. JUNTA AS VARIÁVEIS AO CÓDIGO VINDO DA BASE DE DADOS
    const finalCode = `${variaveisScad}\n${scad_template}`;

    try {
        fs.writeFileSync(scadPath, finalCode);

        // Execução do comando OpenSCAD
        const comando = `openscad -o "${stlPath}" "${scadPath}"`;
        
        exec(comando, async (error, stdout, stderr) => {
            if (error) {
                console.error("ERRO OPENSCAD:", stderr);
                return res.status(500).json({ error: "Erro na renderização" });
            }

            try {
                const fileBuffer = fs.readFileSync(stlPath);
                
                // Upload para o teu bucket original
                const { error: uploadError } = await supabase.storage
                    .from(process.env.STORAGE_BUCKET_NAME)
                    .upload(`previews/${id}.stl`, fileBuffer);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from(process.env.STORAGE_BUCKET_NAME)
                    .getPublicUrl(`previews/${id}.stl`);

                res.json({ url: data.publicUrl });

            } catch (upErr) {
                console.error("Erro Storage:", upErr);
                res.status(500).json({ error: "Erro no upload" });
            } finally {
                // Limpeza rigorosa de ficheiros temporários
                if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
                if (fs.existsSync(stlPath)) fs.unlinkSync(stlPath);
            }
        });
    } catch (err) {
        console.error("Erro Interno:", err);
        res.status(500).send("Erro interno");
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor Industrial na porta ${PORT}`));