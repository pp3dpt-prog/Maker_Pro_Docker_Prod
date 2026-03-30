const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const app = express();

// --- CONFIGURAÇÃO DE CORS PRIORITÁRIA ---
app.use((req, res, next) => {
    // Permite explicitamente o teu domínio da Vercel
    res.header("Access-Control-Allow-Origin", "https://maker-pro-frontend.vercel.app");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    
    // Responde imediatamente ao pedido OPTIONS (Pre-flight) do browser
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

// Lógica de geração OpenSCAD mantida conforme o teu ficheiro original
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

app.post('/gerar-stl-pro', async (req, res) => {
    const { nome, nome_pet, telefone, forma, fonte, userId, designId } = req.body;
    const finalNome = nome || nome_pet || ""; // Aceita ambas as variantes do frontend

    try {
        // Validação de créditos
        // Se o userId for null no frontend, esta chamada pode falhar. 
        // Para testes, podes comentar este bloco do RPC.
        const { data: pago, error: rpcError } = await supabase.rpc('deduzir_credito_pelo_download', { 
            user_uuid: userId, 
            design_uuid: designId 
        });

        if (rpcError || !pago) {
            return res.status(402).json({ error: "Saldo insuficiente ou erro de autenticação" });
        }

        const id = `final_${Date.now()}`;
        const scadPath = path.join(tempDir, `${id}.scad`);
        const stlPath = path.join(tempDir, `${id}.stl`);

        fs.writeFileSync(scadPath, gerarCodigoSCAD(finalNome, telefone, forma, fonte));

        exec(`openscad -o "${stlPath}" "${scadPath}"`, async (error) => {
            if (error) return res.status(500).json({ error: "Erro na renderização OpenSCAD" });

            try {
                const fileBuffer = fs.readFileSync(stlPath);
                await supabase.storage.from('makers_pro_stls').upload(`final/${id}.stl`, fileBuffer);
                const { data } = supabase.storage.from('makers_pro_stls').getPublicUrl(`final/${id}.stl`);

                res.json({ url: data.publicUrl });
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
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor na porta ${PORT}`));