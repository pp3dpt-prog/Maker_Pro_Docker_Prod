const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const app = express();

// --- CORREÇÃO DEFINITIVA DE CORS ---
app.use((req, res, next) => {
    const origin = req.headers.origin;

    // Se a origem vier da Vercel (qualquer subdomínio teu), nós aceitamos
    if (origin && origin.includes("vercel.app")) {
        res.header("Access-Control-Allow-Origin", origin);
    }
    
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    
    // Resposta imediata para o pre-flight (IMPORTANTE para o erro que mostraste)
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

// Lógica de geração SCAD (Mantida conforme o teu padrão)
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

// ROTA DE TESTE (Para verificares no browser se o servidor está vivo)
app.get('/api/health', (req, res) => {
    res.json({ status: "ok", origin_received: req.headers.origin });
});

// ROTA DE PREVIEW (A que o teu frontend deve chamar para testar a ligação)
app.post('/api/preview', async (req, res) => {
    const { nome, telefone, forma, fonte } = req.body;
    const id = `pre_${Date.now()}`;
    const scadPath = path.join(tempDir, `${id}.scad`);
    const pngPath = path.join(tempDir, `${id}.png`);

    try {
        const nomeLimpo = (nome || "PET").replace(/[^a-z0-9 ]/gi, '').trim();
        const scadCode = gerarCodigoSCAD(nomeLimpo, telefone || "", forma || "circulo", 4, 3, fonte);
        fs.writeFileSync(scadPath, scadCode);

        const comando = `openscad -o "${pngPath}" --imgsize=800,800 --render "${scadPath}"`;
        
        exec(comando, (error) => {
            if (error) return res.status(500).json({ error: "Erro OpenSCAD" });
            res.sendFile(pngPath, () => {
                if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
                if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
            });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ROTA DE DOWNLOAD (Consome crédito via RPC)
app.post('/gerar-stl-pro', async (req, res) => {
    const { nome, telefone, forma, fonte, userId, designId } = req.body;
    
    try {
        const { data: pago, error: rpcError } = await supabase.rpc('deduzir_credito_pelo_download', { 
            user_uuid: userId, 
            design_uuid: designId 
        });

        if (rpcError || !pago) return res.status(402).json({ error: "Sem créditos" });

        const id = `pro_${Date.now()}`;
        const scadPath = path.join(tempDir, `${id}.scad`);
        const stlPath = path.join(tempDir, `${id}.stl`);

        const scadCode = gerarCodigoSCAD(nome, telefone, forma, 4, 3, fonte);
        fs.writeFileSync(scadPath, scadCode);

        exec(`openscad -o "${stlPath}" "${scadPath}"`, async (error) => {
            if (error) return res.status(500).send("Erro Render");

            const fileBuffer = fs.readFileSync(stlPath);
            await supabase.storage.from(process.env.STORAGE_BUCKET_NAME).upload(`final/${id}.stl`, fileBuffer);
            const { data } = supabase.storage.from(process.env.STORAGE_BUCKET_NAME).getPublicUrl(`final/${id}.stl`);

            res.json({ url: data.publicUrl });
        });
    } catch (err) {
        res.status(500).send("Erro");
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor na porta ${PORT}`));