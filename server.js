const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const app = express();

// --- 1. CONFIGURAÇÃO DE CORS DINÂMICA ---
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (origin.includes("vercel.app") || origin.includes("localhost"))) {
        res.header("Access-Control-Allow-Origin", origin);
    } else {
        res.header("Access-Control-Allow-Origin", "https://maker-pro-frontend-prod.vercel.app");
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

// Inicialização do Supabase
const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// --- 2. FUNÇÃO GERADORA DE OPENSCAD (COORDENADAS DINÂMICAS) ---
const gerarCodigoSCAD = (dados) => {
    const { 
        nome_pet, telefone, forma, fonte, 
        fontSize, xPos, yPos, 
        fontSizeN, xPosN, yPosN 
    } = dados;

    const nomeLimpo = (nome_pet || "").replace(/[^a-z0-9 ]/gi, '').trim();
    const telLimpo = (telefone || "").replace(/[^0-9+ ]/g, '').trim();
    const formaLimpa = (forma || "circulo").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace("ç", "c");
    
    // Mapeamento de fontes para o sistema Linux/OpenSCAD
    let fontSelected = "Liberation Sans:style=Bold";
    if (fonte === 'Bebas') fontSelected = "Bebas Neue:style=Regular";
    if (fonte === 'Playfair') fontSelected = "Playfair Display:style=Bold";
    if (fonte === 'Eindhoven') fontSelected = "Eindhoven:style=Regular";
    if (fonte === 'BADABB') fontSelected = "Badaboom BB:style=Regular";

    return `
difference() {
    union() {
        import("../templates/blank_${formaLimpa}.stl"); 
        // Texto Frontal (Nome)
        translate([${xPos || 0}, ${yPos || 0}, 2.9]) 
        linear_extrude(height=1) 
        text("${nomeLimpo}", size=${fontSize || 7}, halign="center", valign="center", font="${fontSelected}");
    }
    // Texto Verso (Telefone) - Espelhado para leitura correta por trás
    translate([${xPosN || 0}, ${yPosN || 0}, -1.5]) mirror([1, 0, 0])
    linear_extrude(height=2.5) 
    text("${telLimpo}", size=${fontSizeN || 5}, halign="center", valign="center", font="${fontSelected}");
}
`;
};

// --- 3. ROTA DE GERAÇÃO STL ---
app.post('/gerar-stl-pro', async (req, res) => {
    const { userId, designId } = req.body;

    try {
        // Validação de créditos (Opcional se userId for null)
        if (userId && userId !== "null") {
            const { data: pago, error: rpcError } = await supabase.rpc('deduzir_credito_pelo_download', { 
                user_uuid: userId, 
                design_uuid: designId 
            });
            if (rpcError || !pago) return res.status(402).json({ error: "Saldo insuficiente ou erro no contrato" });
        }

        const id = `final_${Date.now()}`;
        const scadPath = path.join(tempDir, `${id}.scad`);
        const stlPath = path.join(tempDir, `${id}.stl`);

        // Escreve o ficheiro SCAD com todos os parâmetros de posição e tamanho
        fs.writeFileSync(scadPath, gerarCodigoSCAD(req.body));

        // Executa o OpenSCAD no Docker
        exec(`openscad -o "${stlPath}" "${scadPath}"`, async (error) => {
            if (error) {
                console.error("Erro OpenSCAD:", error);
                return res.status(500).json({ error: "Erro no processamento 3D" });
            }

            try {
                const fileBuffer = fs.readFileSync(stlPath);
                const fileName = `final/${id}.stl`;

                // Upload para o Bucket Correto
                const { error: uploadError } = await supabase.storage
                    .from('maker_pro_stl_prod') 
                    .upload(fileName, fileBuffer, {
                        contentType: 'model/stl',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from('maker_pro_stl_prod')
                    .getPublicUrl(fileName);

                // Envia o link final para o Frontend
                res.json({ url: data.publicUrl });

            } catch (err) {
                console.error("Erro Storage:", err);
                res.status(500).json({ error: "Erro ao guardar no Supabase" });
            } finally {
                // Limpeza de ficheiros temporários
                if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
                if (fs.existsSync(stlPath)) fs.unlinkSync(stlPath);
            }
        });

    } catch (err) {
        console.error("Erro Interno:", err);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

// Rota de teste simples
app.get('/', (req, res) => res.send("Servidor Maker Pro Docker Prod Ativo"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend rodando na porta ${PORT}`));