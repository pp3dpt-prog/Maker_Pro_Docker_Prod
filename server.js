const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const app = express();

// --- CONFIGURAÇÃO DE CORS DINÂMICO ---
// Isto resolve o erro "Allow Origin Not Matching Origin"
const allowedOrigins = [
    "https://maker-pro-frontend-prod.vercel.app",
    "https://maker-pro-frontend.vercel.app"
];

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

app.use(express.json());

// --- CONFIGURAÇÃO SUPABASE ---
const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// --- LÓGICA DE GERAÇÃO SCAD ---
const gerarCodigoSCAD = (nome, telefone, forma, fontSizeNome, fontSizeNumero, fonte) => {
    const fontSelected = fonte || "Liberation Sans:style=Bold";
    return `
difference() {
    union() {
        import("../templates/blank_${forma}.stl"); 
        translate([0, 0, 2.9]) 
        linear_extrude(height=1) 
        text("${nome}", size=${fontSizeNome}, halign="center", valign="center", font="${fontSelected}");
    }
    translate([0, 0, -1.5]) mirror([1, 0, 0])
    linear_extrude(height=2.5) 
    text("${telefone}", size=${fontSizeNumero}, halign="center", valign="center", font="${fontSelected}");
}
`;
};

// --- ROTA 1: PREVIEW (PNG RÁPIDO - GRÁTIS) ---
app.post('/api/preview', async (req, res) => {
    const { nome, telefone, forma, fonte } = req.body;
    const id = `pre_${Date.now()}`;
    const scadPath = path.join(tempDir, `${id}.scad`);
    const pngPath = path.join(tempDir, `${id}.png`);

    const nomeLimpo = nome.replace(/[^a-z0-9 ]/gi, '').trim();
    const telLimpo = (telefone || "").replace(/[^0-9+ ]/g, '').trim();
    const formaLimpa = forma.toLowerCase();
    const fontSizeNome = Math.max(3, Math.min(5, 35 / Math.max(1, nomeLimpo.length)));

    try {
        const scadCode = gerarCodigoSCAD(nomeLimpo, telLimpo, formaLimpa, fontSizeNome, 4, fonte);
        fs.writeFileSync(scadPath, scadCode);

        // Gera imagem PNG para visualização rápida e estética
        const comando = `openscad -o "${pngPath}" --imgsize=800,800 --render "${scadPath}"`;
        
        exec(comando, (error) => {
            if (error) return res.status(500).json({ error: "Erro no preview" });
            res.sendFile(pngPath, () => {
                if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
                if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
            });
        });
    } catch (err) {
        res.status(500).send("Erro interno");
    }
});

// --- ROTA 2: GERAR STL (VENDA - CONSOME CRÉDITO) ---
app.post('/gerar-stl-pro', async (req, res) => {
    const { nome, telefone, forma, fonte, userId, designId } = req.body;
    
    if (!userId || !designId) return res.status(401).json({ error: "Faltam dados de utilizador" });

    try {
        // Chamada à RPC do Supabase para garantir o pagamento antes do render
        const { data: pago, error: rpcError } = await supabase.rpc('deduzir_credito_pelo_download', { 
            user_uuid: userId, 
            design_uuid: designId 
        });

        if (rpcError || !pago) return res.status(402).json({ error: "Saldo insuficiente" });

        const id = `pro_${Date.now()}`;
        const scadPath = path.join(tempDir, `${id}.scad`);
        const stlPath = path.join(tempDir, `${id}.stl`);

        const nomeLimpo = nome.replace(/[^a-z0-9 ]/gi, '').trim();
        const telLimpo = telefone.replace(/[^0-9+ ]/g, '').trim();
        const fontSizeNome = Math.max(3, Math.min(5, 35 / Math.max(1, nomeLimpo.length)));

        const scadCode = gerarCodigoSCAD(nomeLimpo, telLimpo, forma.toLowerCase(), fontSizeNome, 4, fonte);
        fs.writeFileSync(scadPath, scadCode);

        const comando = `openscad -o "${stlPath}" "${scadPath}"`;
        
        exec(comando, async (error) => {
            if (error) return res.status(500).json({ error: "Erro OpenSCAD" });

            try {
                const fileBuffer = fs.readFileSync(stlPath);
                await supabase.storage.from(process.env.STORAGE_BUCKET_NAME).upload(`final/${id}.stl`, fileBuffer);
                const { data } = supabase.storage.from(process.env.STORAGE_BUCKET_NAME).getPublicUrl(`final/${id}.stl`);

                res.json({ url: data.publicUrl });
            } finally {
                if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
                if (fs.existsSync(stlPath)) fs.unlinkSync(stlPath);
            }
        });
    } catch (err) {
        res.status(500).send("Erro interno");
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor ativo na porta ${PORT}`));