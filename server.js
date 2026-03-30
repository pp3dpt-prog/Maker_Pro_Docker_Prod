const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const app = express();

// --- CONFIGURAÇÃO DE CORS ---
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
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

// --- GERADOR DE CÓDIGO (Com proteção contra valores nulos) ---
const gerarCodigoSCAD = (d) => {
    // Definimos valores padrão caso o frontend não envie algum campo
    const nome = (d.nome_pet || "").replace(/[^a-z0-9 ]/gi, '').trim();
    const tel = (d.telefone || "").replace(/[^0-9+ ]/g, '').trim();
    const forma = (d.forma || "circulo").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace("ç", "c");
    const fonte = d.fonte || "OpenSans";
    
    // Coordenadas e Tamanhos (Proteção contra NaN ou Null)
    const sz = d.fontSize || 7;
    const x = d.xPos || 0;
    const y = d.yPos || 0;
    const szN = d.fontSizeN || 5;
    const xN = d.xPosN || 0;
    const yN = d.yPosN || 0;

    let fSelected = "Liberation Sans:style=Bold";
    if (fonte === 'Bebas') fSelected = "Bebas Neue:style=Regular";
    if (fonte === 'Playfair') fSelected = "Playfair Display:style=Bold";
    if (fonte === 'Eindhoven') fSelected = "Eindhoven:style=Regular";
    if (fonte === 'BADABB') fSelected = "Badaboom BB:style=Regular";

    return `
difference() {
    union() {
        import("../templates/blank_${forma}.stl"); 
        translate([${x}, ${y}, 2.9]) 
        linear_extrude(height=1) 
        text("${nome}", size=${sz}, halign="center", valign="center", font="${fSelected}");
    }
    translate([${xN}, ${yN}, -1.5]) mirror([1, 0, 0])
    linear_extrude(height=2.5) 
    text("${tel}", size=${szN}, halign="center", valign="center", font="${fSelected}");
}
`;
};

app.post('/gerar-stl-pro', async (req, res) => {
    try {
        const { userId, designId } = req.body;

        // Log para debug no Render (ajuda a ver o que chega)
        console.log("Recebido pedido para:", req.body.nome_pet);

        if (userId && userId !== "null" && userId !== null) {
            const { data: pago, error: rpcError } = await supabase.rpc('deduzir_credito_pelo_download', { 
                user_uuid: userId, 
                design_uuid: designId 
            });
            if (rpcError || !pago) return res.status(402).json({ error: "Saldo insuficiente" });
        }

        const id = `final_${Date.now()}`;
        const scadPath = path.join(tempDir, `${id}.scad`);
        const stlPath = path.join(tempDir, `${id}.stl`);

        fs.writeFileSync(scadPath, gerarCodigoSCAD(req.body));

        exec(`openscad -o "${stlPath}" "${scadPath}"`, async (error) => {
            if (error) {
                console.error("Erro OpenSCAD:", error);
                return res.status(500).json({ error: "Falha no OpenSCAD" });
            }

            try {
                const fileBuffer = fs.readFileSync(stlPath);
                // ATENÇÃO: Verifique se o bucket no Supabase é exatamente este:
                const bucketName = 'maker_pro_stl_prod'; 

                const { error: upErr } = await supabase.storage
                    .from(bucketName)
                    .upload(`final/${id}.stl`, fileBuffer, { contentType: 'model/stl', upsert: true });

                if (upErr) throw upErr;

                const { data } = supabase.storage.from(bucketName).getPublicUrl(`final/${id}.stl`);
                res.json({ url: data.publicUrl });

            } catch (err) {
                console.error("Erro no processamento final:", err);
                res.status(500).json({ error: "Erro ao salvar STL" });
            } finally {
                if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
                if (fs.existsSync(stlPath)) fs.unlinkSync(stlPath);
            }
        });
    } catch (err) {
        res.status(500).json({ error: "Erro crítico no servidor" });
    }
});

app.get('/', (req, res) => res.send("Servidor Online"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Porta ${PORT}`));