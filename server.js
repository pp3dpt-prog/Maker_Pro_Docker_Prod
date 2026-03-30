const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const app = express();

// --- CONFIGURAÇÃO DE CORS ÚNICA E DINÂMICA ---
// 1. Remove qualquer outro app.use(cors) ou app.use que defina headers de origin
app.use((req, res, next) => {
    // Forçamos o domínio exato que aparece no teu erro
    res.header("Access-Control-Allow-Origin", "https://maker-pro-frontend.vercel.app");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    
    // IMPORTANTE: O browser envia um OPTIONS antes do POST. 
    // Se o OPTIONS não receber 200 OK com os headers acima, o POST é bloqueado.
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

app.use(express.json());

const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// --- LÓGICA DE GERAÇÃO SCAD ---
const gerarCodigoSCAD = (nome, telefone, forma, fonte) => {
    const nomeLimpo = (nome || "").replace(/[^a-z0-9 ]/gi, '').trim();
    const telLimpo = (telefone || "").replace(/[^0-9+ ]/g, '').trim();
    const formaLimpa = (forma || "circulo").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace("ç", "c");
    
    const fontSize = Math.max(3, Math.min(5, 35 / Math.max(1, nomeLimpo.length)));
    const fontSizeNome = formaLimpa === "coracao" ? fontSize * 0.4 : fontSize;
    const fontSizeNumero = formaLimpa === "coracao" ? 2.2 : 4;
    const fontSelected = fonte || "Liberation Sans:style=Bold";

    return `
difference() {
    union() {
        import("../templates/blank_${formaLimpa}.stl"); 
        translate([0, 0, 2.9]) 
        linear_extrude(height=1) 
        text("${nomeLimpo}", size=${fontSizeNome}, halign="center", valign="center", font="${fontSelected}");
    }
    translate([0, 0, -1.5]) mirror([1, 0, 0])
    linear_extrude(height=2.5) 
    text("${telLimpo}", size=${fontSizeNumero}, halign="center", valign="center", font="${fontSelected}");
}
`;
};

// --- ROTA 1: PREVIEW (PNG) ---
app.post('/api/preview-image', async (req, res) => {
    const { nome, nome_pet, telefone, forma, fonte } = req.body;
    const finalNome = nome || nome_pet || ""; // Aceita ambas as variantes do frontend
    
    const id = `pre_${Date.now()}`;
    const scadPath = path.join(tempDir, `${id}.scad`);
    const pngPath = path.join(tempDir, `${id}.png`);

    try {
        const scadCode = gerarCodigoSCAD(finalNome, telefone, forma, fonte);
        fs.writeFileSync(scadPath, scadCode);

        const comando = `openscad -o "${pngPath}" --imgsize=800,800 --render "${scadPath}"`;
        
        exec(comando, (error) => {
            if (error) return res.status(500).send("Erro no preview");
            res.sendFile(pngPath, () => {
                if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
                if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
            });
        });
    } catch (err) { res.status(500).send("Erro"); }
});

// --- ROTA 2: COMPRA (STL + CRÉDITOS) ---
app.post('/gerar-stl-pro', async (req, res) => {
    const { nome, nome_pet, telefone, forma, fonte, userId, designId } = req.body;
    const finalNome = nome || nome_pet || "";

    try {
        // 1. Verificação de Crédito
        const { data: pago, error: rpcError } = await supabase.rpc('deduzir_credito_pelo_download', { 
            user_uuid: userId, 
            design_uuid: designId 
        });

        if (rpcError || !pago) {
            return res.status(402).json({ error: "Saldo insuficiente" });
        }

        const id = `final_${Date.now()}`;
        const scadPath = path.join(tempDir, `${id}.scad`);
        const stlPath = path.join(tempDir, `${id}.stl`);

        const scadCode = gerarCodigoSCAD(finalNome, telefone, forma, fonte);
        fs.writeFileSync(scadPath, scadCode);

        exec(`openscad -o "${stlPath}" "${scadPath}"`, async (error) => {
            if (error) return res.status(500).json({ error: "Erro OpenSCAD" });

            try {
                const fileBuffer = fs.readFileSync(stlPath);
                await supabase.storage
                    .from('makers_pro_stls')
                    .upload(`final/${id}.stl`, fileBuffer);

                const { data } = supabase.storage
                    .from('makers_pro_stls')
                    .getPublicUrl(`final/${id}.stl`);

                res.json({ url: data.publicUrl });
            } finally {
                if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
                if (fs.existsSync(stlPath)) fs.unlinkSync(stlPath);
            }
        });
    } catch (err) { res.status(500).send("Erro"); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor na porta ${PORT}`));