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

const gerarCodigoSCAD = (d) => {
    const nome = (d.nome_pet || "").replace(/[^a-z0-9 ]/gi, '').trim();
    const tel = (d.telefone || "").replace(/[^0-9+ ]/g, '').trim();
    const forma = (d.forma || "circulo").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace("ç", "c");
    
    // Caminho absoluto para os templates no container Docker
    const templatePath = path.join(__dirname, 'templates', `blank_${forma}.stl`);

    let fSel = "Liberation Sans:style=Bold";
    if (d.fonte === 'Bebas') fSel = "Bebas Neue:style=Regular";
    if (d.fonte === 'Playfair') fSel = "Playfair Display:style=Bold";
    if (d.fonte === 'Eindhoven') fSel = "Eindhoven:style=Regular";
    if (d.fonte === 'BADABB') fSel = "Badaboom BB:style=Regular";

    // IMPORTANTE: union() funde o STL importado com o texto gerado
    return `
union() {
    import("${templatePath}"); 
    
    // Nome na frente
    translate([${d.xPos || 0}, ${d.yPos || 0}, 2.9]) 
    linear_extrude(height=1) 
    text("${nome}", size=${d.fontSize || 7}, halign="center", valign="center", font="${fSel}");

    // Telefone no verso
    translate([${-(d.xPosN || 0)}, ${d.yPosN || 0}, -0.5]) 
    mirror([1, 0, 0])
    linear_extrude(height=1) 
    text("${tel}", size=${d.fontSizeN || 5}, halign="center", valign="center", font="${fSel}");
}
`;
};

app.post('/gerar-stl-pro', async (req, res) => {
    try {
        const { userId, designId } = req.body;
        const id = `final_${Date.now()}`;
        const scadPath = path.join(tempDir, `${id}.scad`);
        const stlPath = path.join(tempDir, `${id}.stl`);

        fs.writeFileSync(scadPath, gerarCodigoSCAD(req.body));

        exec(`openscad -o "${stlPath}" "${scadPath}"`, async (error) => {
            if (error) return res.status(500).json({ error: "Erro OpenSCAD" });

            try {
                const fileBuffer = fs.readFileSync(stlPath);
                const bucket = 'maker_pro_stl_prod';

                await supabase.storage.from(bucket).upload(`final/${id}.stl`, fileBuffer, {
                    contentType: 'model/stl',
                    upsert: true
                });

                const { data } = supabase.storage.from(bucket).getPublicUrl(`final/${id}.stl`);
                res.json({ url: data.publicUrl });

            } catch (err) {
                res.status(500).json({ error: "Erro Storage" });
            } finally {
                if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
                if (fs.existsSync(stlPath)) fs.unlinkSync(stlPath);
            }
        });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server Rodando na porta ${PORT}`));