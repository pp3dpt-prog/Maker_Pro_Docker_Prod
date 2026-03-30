const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const app = express();

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

const gerarCodigoSCAD = (d) => {
    const nomeLimpo = (d.nome_pet || "").replace(/[^a-z0-9 ]/gi, '').trim();
    const telLimpo = (d.telefone || "").replace(/[^0-9+ ]/g, '').trim();
    const formaLimpa = (d.forma || "circulo").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace("ç", "c");
    
    // Caminho absoluto para o template dentro do container
    const templatePath = path.join(__dirname, 'templates', `blank_${formaLimpa}.stl`);

    let fontSelected = "Liberation Sans:style=Bold";
    if (d.fonte === 'Bebas') fontSelected = "Bebas Neue:style=Regular";
    if (d.fonte === 'Playfair') fontSelected = "Playfair Display:style=Bold";
    if (d.fonte === 'Eindhoven') fontSelected = "Eindhoven:style=Regular";
    if (d.fonte === 'BADABB') fontSelected = "Badaboom BB:style=Regular";

    // O comando 'union()' é essencial para fundir o texto com a forma
    return `
union() {
    import("${templatePath}"); 
    
    // Nome na frente
    translate([${d.xPos || 0}, ${d.yPos || 0}, 2.9]) 
    linear_extrude(height=1) 
    text("${nomeLimpo}", size=${d.fontSize || 7}, halign="center", valign="center", font="${fontSelected}");

    // Telefone no verso
    translate([${-(d.xPosN || 0)}, ${d.yPosN || 0}, -0.5]) 
    mirror([1, 0, 0])
    linear_extrude(height=1) 
    text("${telLimpo}", size=${d.fontSizeN || 5}, halign="center", valign="center", font="${fontSelected}");
}
`;
};

app.post('/gerar-stl-pro', async (req, res) => {
    const { userId, designId } = req.body;
    try {
        if (userId && userId !== "null") {
            const { data: pago } = await supabase.rpc('deduzir_credito_pelo_download', { user_uuid: userId, design_uuid: designId });
            if (!pago) return res.status(402).json({ error: "Saldo insuficiente" });
        }

        const id = `final_${Date.now()}`;
        const scadPath = path.join(tempDir, `${id}.scad`);
        const stlPath = path.join(tempDir, `${id}.stl`);

        fs.writeFileSync(scadPath, gerarCodigoSCAD(req.body));

        // Execução do OpenSCAD
        exec(`openscad -o "${stlPath}" "${scadPath}"`, async (error) => {
            if (error) {
                console.error("Erro OpenSCAD:", error);
                return res.status(500).json({ error: "Erro na geração 3D" });
            }

            try {
                const fileBuffer = fs.readFileSync(stlPath);
                await supabase.storage.from('maker_pro_stl_prod').upload(`final/${id}.stl`, fileBuffer, {
                    contentType: 'model/stl',
                    upsert: true
                });

                const { data } = supabase.storage.from('maker_pro_stl_prod').getPublicUrl(`final/${id}.stl`);
                res.json({ url: data.publicUrl });
            } catch (err) {
                res.status(500).json({ error: "Erro no upload" });
            } finally {
                if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
                if (fs.existsSync(stlPath)) fs.unlinkSync(stlPath);
            }
        });
    } catch (err) { res.status(500).json({ error: "Erro interno" }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor na porta ${PORT}`));