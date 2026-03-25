const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

// 1. CONFIGURAÇÃO CORS FLEXÍVEL
// Permite que qualquer URL da tua Vercel comunique com o Docker
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || origin.includes('.vercel.app') || origin.includes('localhost')) {
            callback(null, true);
        } else {
            callback(new Error('Acesso não permitido pelo CORS'));
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// 2. INICIALIZAÇÃO SUPABASE
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Garante que a pasta temporária existe para processar os ficheiros 
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

app.post('/gerar-stl-pro', async (req, res) => {
    const { scad_template, parametros } = req.body;
    
    if (!scad_template || !parametros) {
        return res.status(400).json({ error: "Faltam dados: template ou parâmetros." });
    }

    const id = `pro_${Date.now()}`;
    const scadPath = path.join(tempDir, `${id}.scad`);
    const stlPath = path.join(tempDir, `${id}.stl`);

    // 3. INJEÇÃO DINÂMICA DE VARIÁVEIS
    // Transforma o objeto de parâmetros em variáveis para o OpenSCAD 
    const blocoVariaveis = Object.entries(parametros)
        .map(([key, val]) => {
            const safeVal = typeof val === 'string' ? `"${val.replace(/"/g, '')}"` : val;
            return `${key} = ${safeVal};`;
        })
        .join('\n');

    const codigoFinal = `${blocoVariaveis}\n${scad_template}`;

    try {
        fs.writeFileSync(scadPath, codigoFinal);
        
        // 4. EXECUÇÃO DO OPENSCAD 
        const comando = `openscad -o "${stlPath}" "${scadPath}"`;
        
        exec(comando, async (error, stdout, stderr) => {
            if (error) {
                console.error("Erro OpenSCAD:", stderr);
                return res.status(500).json({ error: "Erro na renderização 3D." });
            }

            try {
                const fileBuffer = fs.readFileSync(stlPath);
                const bucket = process.env.STORAGE_BUCKET_NAME || 'makers_pro_stl_prod';
                const filePath = `previews/${id}.stl`;

                // 5. UPLOAD PARA BUCKET PRIVADO 
                const { error: uploadError } = await supabase.storage
                    .from(bucket)
                    .upload(filePath, fileBuffer, { 
                        contentType: 'model/stl',
                        upsert: true 
                    });

                if (uploadError) throw uploadError;

                // 6. GERAR LINK ASSINADO (Necessário para Buckets Privados)
                // Cria um link temporário de 10 minutos para o visualizador
                const { data, error: signedError } = await supabase.storage
                    .from(bucket)
                    .createSignedUrl(filePath, 600); 

                if (signedError) throw signedError;

                // Envia o URL seguro para o Frontend
                res.json({ url: data.signedUrl });

            } catch (upErr) {
                console.error("Erro Supabase:", upErr);
                res.status(500).json({ error: "Erro no processamento do ficheiro." });
            } finally {
                // Limpeza de ficheiros temporários para poupar disco no Render 
                if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
                if (fs.existsSync(stlPath)) fs.unlinkSync(stlPath);
            }
        });
    } catch (err) {
        console.error("Erro Interno:", err);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Motor dinâmico ativo na porta ${PORT}`));