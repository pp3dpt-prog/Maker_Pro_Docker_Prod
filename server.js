const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

// --- CONFIGURAÇÃO DE SEGURANÇA E CORS ---
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

// --- INICIALIZAÇÃO DO SUPABASE ---
const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// --- FUNÇÃO AUXILIAR: GERAÇÃO DE CÓDIGO OPENSCAD ---
// Centralizamos aqui para garantir que o Preview e o STL final sejam idênticos
const gerarCodigoSCAD = (params) => {
    const { nome, telefone, forma, fontSizeNome, fontSizeNumero, fonte } = params;
    // Usamos a fonte passada pelo utilizador ou 'Liberation Sans:style=Bold' como fallback
    const selectedFont = fonte || "Liberation Sans:style=Bold";
    
    return `
difference() {
    union() {
        import("../templates/blank_${forma}.stl"); 
        
        // Texto na Frente (Relevo)
        translate([0, 0, 2.9]) 
        linear_extrude(height=1) 
        text("${nome}", size=${fontSizeNome}, halign="center", valign="center", font="${selectedFont}");
    }
    
    // Texto no Verso (Escavado)
    translate([0, 0, -1.5]) mirror([1, 0, 0])
    linear_extrude(height=2.5) 
    text("${telefone}", size=${fontSizeNumero}, halign="center", valign="center", font="${selectedFont}");
}
`;
};

// --- ROTA 1: PREVIEW (GERA PNG RÁPIDO) ---
// Objetivo: Estética e validação do utilizador. Não gasta créditos.
app.post('/api/preview', async (req, res) => {
    const { nome, telefone, forma, fonte } = req.body;
    
    if (!nome || !forma) return res.status(400).json({ error: "Dados incompletos" });

    const id = `pre_${Date.now()}`;
    const scadPath = path.join(tempDir, `${id}.scad`);
    const pngPath = path.join(tempDir, `${id}.png`);

    // Lógica de cálculo de tamanho (podes ajustar conforme as tuas tabelas prod_designs)
    const nomeLimpo = nome.replace(/[^a-z0-9 ]/gi, '').trim();
    const telLimpo = (telefone || "").replace(/[^0-9+ ]/g, '').trim();
    const fontSizeNome = Math.max(3, Math.min(5, 35 / Math.max(1, nomeLimpo.length)));

    const scadCode = gerarCodigoSCAD({
        nome: nomeLimpo,
        telefone: telLimpo,
        forma: forma.toLowerCase(),
        fontSizeNome: fontSizeNome,
        fontSizeNumero: 4,
        fonte: fonte
    });

    try {
        fs.writeFileSync(scadPath, scadCode);
        // Comando otimizado para imagem PNG (rápido)
        const comando = `openscad -o "${pngPath}" --imgsize=800,800 --render "${scadPath}"`;
        
        exec(comando, (error) => {
            if (error) return res.status(500).json({ error: "Erro ao gerar antevisão" });
            
            res.sendFile(pngPath, () => {
                if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
                if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
            });
        });
    } catch (err) {
        res.status(500).json({ error: "Erro interno" });
    }
});

// --- ROTA 2: GERAR STL FINAL (VENDA/CRÉDITOS) ---
// Objetivo: Venda do ficheiro. Só executa se houver saldo.
app.post('/gerar-stl-pro', async (req, res) => {
    const { nome, telefone, forma, fonte, userId, designId } = req.body;
    
    if (!userId || !designId) {
        return res.status(401).json({ error: "Autenticação necessária" });
    }

    try {
        // 1. Validar e descontar crédito via RPC no Supabase
        const { data: sucesso, error: rpcError } = await supabase.rpc('deduzir_credito_pelo_download', { 
            user_uuid: userId, 
            design_uuid: designId 
        });

        if (rpcError || !sucesso) {
            return res.status(402).json({ error: "Créditos insuficientes ou erro na conta" });
        }

        // 2. Preparar ficheiros
        const id = `final_${Date.now()}`;
        const scadPath = path.join(tempDir, `${id}.scad`);
        const stlPath = path.join(tempDir, `${id}.stl`);

        const nomeLimpo = nome.replace(/[^a-z0-9 ]/gi, '').trim();
        const telLimpo = telefone.replace(/[^0-9+ ]/g, '').trim();
        const fontSizeNome = Math.max(3, Math.min(5, 35 / Math.max(1, nomeLimpo.length)));

        const scadCode = gerarCodigoSCAD({
            nome: nomeLimpo,
            telefone: telLimpo,
            forma: forma.toLowerCase(),
            fontSizeNome: fontSizeNome,
            fontSizeNumero: 4,
            fonte: fonte
        });

        fs.writeFileSync(scadPath, scadCode);

        // 3. Executar OpenSCAD para STL
        const comando = `openscad -o "${stlPath}" "${scadPath}"`;
        
        exec(comando, async (error, stdout, stderr) => {
            if (error) {
                console.error("ERRO OPENSCAD:", stderr);
                return res.status(500).json({ error: "Erro na renderização do ficheiro 3D" });
            }

            try {
                // 4. Upload para o Storage do Supabase
                const fileBuffer = fs.readFileSync(stlPath);
                const storagePath = `downloads/${userId}/${id}.stl`;
                
                const { error: uploadError } = await supabase.storage
                    .from(process.env.STORAGE_BUCKET_NAME)
                    .upload(storagePath, fileBuffer);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from(process.env.STORAGE_BUCKET_NAME)
                    .getPublicUrl(storagePath);

                // 5. Devolver o link final
                res.json({ 
                    success: true,
                    url: data.publicUrl,
                    message: "Ficheiro gerado e crédito descontado."
                });

            } catch (upErr) {
                res.status(500).json({ error: "Erro ao guardar ficheiro" });
            } finally {
                // Limpeza
                if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
                if (fs.existsSync(stlPath)) fs.unlinkSync(stlPath);
            }
        });

    } catch (err) {
        console.error("Erro Interno:", err);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

// --- PORTA PADRÃO RENDER ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Maker Pro a correr na porta ${PORT}`);
});