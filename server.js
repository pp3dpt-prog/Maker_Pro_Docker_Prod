const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

// Configuração de CORS para permitir comunicação com o teu Frontend na Vercel
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

// Inicialização do Cliente Supabase com variáveis de ambiente
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Garante que a pasta temporária existe
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

app.post('/gerar-stl-pro', async (req, res) => {
    // RECEBE O CÓDIGO DO MODELO E OS PARÂMETROS DA UI (ex: sliders da caixa)
    const { scad_template, parametros } = req.body;
    
    if (!scad_template || !parametros) {
        return res.status(400).json({ error: "Dados insuficientes: template ou parâmetros em falta." });
    }

    const id = `pro_${Date.now()}`;
    const scadPath = path.join(tempDir, `${id}.scad`);
    const stlPath = path.join(tempDir, `${id}.stl`);

    // 1. GERA O BLOCO DE VARIÁVEIS DINÂMICAS PARA O OPENSCAD
    const blocoVariaveis = Object.entries(parametros)
        .map(([key, val]) => {
            // Se o valor for texto, remove aspas para evitar erros; se for número, usa direto
            const safeVal = typeof val === 'string' ? `"${val.replace(/"/g, '')}"` : val;
            return `${key} = ${safeVal};`;
        })
        .join('\n');

    // 2. JUNTA AS VARIÁVEIS AO CÓDIGO SCAD QUE VEM DA BASE DE DADOS
    const codigoFinal = `${blocoVariaveis}\n${scad_template}`;

    try {
        fs.writeFileSync(scadPath, codigoFinal);

        // 3. EXECUTA O OPENSCAD PARA GERAR O STL
        const comando = `openscad -o "${stlPath}" "${scadPath}"`;
        
        exec(comando, async (error, stdout, stderr) => {
            if (error) {
                console.error("ERRO OPENSCAD:", stderr);
                return res.status(500).json({ error: "Erro na renderização: " + stderr });
            }

            try {
                // 4. LÊ O FICHEIRO GERADO E FAZ UPLOAD PARA O SUPABASE STORAGE
                const fileBuffer = fs.readFileSync(stlPath);
                const { error: uploadError } = await supabase.storage
                    .from(process.env.STORAGE_BUCKET_NAME)
                    .upload(`previews/${id}.stl`, fileBuffer);

                if (uploadError) throw uploadError;

                // 5. OBTÉM O URL PÚBLICO E ENVIA DE VOLTA PARA O FRONTEND
                const { data } = supabase.storage
                    .from(process.env.STORAGE_BUCKET_NAME)
                    .getPublicUrl(`previews/${id}.stl`);

                res.json({ url: data.publicUrl });

            } catch (upErr) {
                console.error("Erro Storage:", upErr);
                res.status(500).json({ error: "Erro no upload para o Storage" });
            } finally {
                // LIMPEZA: Apaga os ficheiros temporários para não encher o disco da Render
                if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
                if (fs.existsSync(stlPath)) fs.unlinkSync(stlPath);
            }
        });
    } catch (err) {
        console.error("Erro Interno:", err);
        res.status(500).send("Erro interno no servidor.");
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Motor dinâmico ativo na porta ${PORT}`));