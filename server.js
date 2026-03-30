const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const app = express();

// --- CONFIGURAÇÃO DE CORS ---
app.use((req, res, next) => {
    // Forçamos o domínio exato do teu frontend na Vercel
    res.header("Access-Control-Allow-Origin", "https://maker-pro-frontend.vercel.app");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    
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

app.post('/gerar-stl-pro', async (req, res) => {
    // Aceita 'nome' ou 'nome_pet' para evitar erros de mapeamento do frontend
    const { nome, nome_pet, telefone, forma, fonte, userId, designId } = req.body;
    const finalNome = nome || nome_pet || "";

    try {
        // Validação de créditos via RPC no Supabase
        const { data: pago, error: rpcError } = await supabase.rpc('deduzir_credito_pelo_download', { 
            user_uuid: userId, 
            design_uuid: designId 
        });

        if (rpcError || !pago) {
            return res.status(402).json({ error: "Saldo insuficiente ou erro na conta" });
        }

        const id = `final_${Date.now()}`;
        const scadPath = path.join(tempDir, `${id}.scad`);
        const stlPath = path.join(tempDir, `${id}.stl`);

        const scadCode = gerarCodigoSCAD(finalNome, telefone, forma, fonte);
        fs.writeFileSync(scadPath, scadCode);

        exec(`openscad -o "${stlPath}" "${scadPath}"`, async (error) => {
            if (error) return res.status(500).json({ error: "Erro na renderização OpenSCAD" });

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
    } catch (err) {
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor na porta ${PORT}`));