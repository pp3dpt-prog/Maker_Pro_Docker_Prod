const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const app = express();

// --- 1. CONFIGURAÇÃO DE CORS DINÂMICA (TOP PRIORITY) ---
app.use((req, res, next) => {
    const origin = req.headers.origin;
    // Se o pedido vier de qualquer subdomínio da vercel, aceitamos.
    // Isto evita o erro "Allow Origin Not Matching" se o URL da Vercel mudar.
    if (origin && origin.includes("vercel.app")) {
        res.header("Access-Control-Allow-Origin", origin);
    } else {
        res.header("Access-Control-Allow-Origin", "https://maker-pro-frontend.vercel.app");
    }

    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    
    // Resposta imediata para o pre-flight (IMPORTANTE para o erro XHROPTIONS)
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

// Função de geração de código SCAD
const gerarCodigoSCAD = (nome, telefone, forma, fonte) => {
    const nomeLimpo = (nome || "").replace(/[^a-z0-9 ]/gi, '').trim();
    const telLimpo = (telefone || "").replace(/[^0-9+ ]/g, '').trim();
    const formaLimpa = (forma || "circulo").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace("ç", "c");
    const fontSelected = fonte || "Liberation Sans:style=Bold";

    return `
difference() {
    union() {
        import("../templates/blank_${formaLimpa}.stl"); 
        translate([0, 0, 2.9]) 
        linear_extrude(height=1) 
        text("${nomeLimpo}", size=5, halign="center", valign="center", font="${fontSelected}");
    }
    translate([0, 0, -1.5]) mirror([1, 0, 0])
    linear_extrude(height=2.5) 
    text("${telLimpo}", size=4, halign="center", valign="center", font="${fontSelected}");
}
`;
};

// ROTA PRINCIPAL
app.post('/gerar-stl-pro', async (req, res) => {
    const { nome, nome_pet, telefone, forma, fonte, userId, designId } = req.body;
    
    // Mapeamento: usa 'nome' ou 'nome_pet' (o que vier do frontend)
    const finalNome = nome || nome_pet || "PET";

    try {
        // Se userId for null ou string "null", saltamos a dedução para não crashar o RPC
        if (userId && userId !== "null") {
            const { data: pago, error: rpcError } = await supabase.rpc('deduzir_credito_pelo_download', { 
                user_uuid: userId, 
                design_uuid: designId 
            });
            if (rpcError || !pago) return res.status(402).json({ error: "Saldo insuficiente" });
        }

        const id = `final_${Date.now()}`;
        const scadPath = path.join(tempDir, `${id}.scad`);
        const stlPath = path.join(tempDir, `${id}.stl`);

        fs.writeFileSync(scadPath, gerarCodigoSCAD(finalNome, telefone, forma, fonte));

        exec(`openscad -o "${stlPath}" "${scadPath}"`, async (error) => {
            if (error) return res.status(500).json({ error: "Erro no OpenSCAD" });

            try {
                const fileBuffer = fs.readFileSync(stlPath);
                const filePath = `final/${id}.stl`;
                
                await supabase.storage.from('makers_pro_stls').upload(filePath, fileBuffer);
                const { data } = supabase.storage.from('makers_pro_stls').getPublicUrl(filePath);

                res.json({ url: data.publicUrl });
            } finally {
                if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
                if (fs.existsSync(stlPath)) fs.unlinkSync(stlPath);
            }
        });
    } catch (err) {
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor ativo na porta ${PORT}`));