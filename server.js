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
    const nome = (d.nome_pet || "").replace(/[^a-z0-9 ]/gi, '').trim();
    const tel = (d.telefone || "").replace(/[^0-9+ ]/g, '').trim();
    const forma = (d.forma || "circulo").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace("ç", "c");
    const templatePath = path.join(__dirname, 'templates', `blank_${forma}.stl`);

    let fSel = "Liberation Sans:style=Bold";
    if (d.fonte === 'Bebas') fSel = "Bebas Neue:style=Regular";
    if (d.fonte === 'Playfair') fSel = "Playfair Display:style=Bold";
    if (d.fonte === 'Eindhoven') fSel = "Eindhoven:style=Regular";
    if (d.fonte === 'BADABB') fSel = "Badaboom BB:style=Regular";

    return `
union() {
    import("${templatePath}"); 
    translate([${d.xPos || 0}, ${d.yPos || 0}, 2.9]) 
    linear_extrude(height=1) 
    text("${nome}", size=${d.fontSize || 7}, halign="center", valign="center", font="${fSel}");

    translate([${-(d.xPosN || 0)}, ${d.yPosN || 0}, -0.5]) mirror([1, 0, 0])
    linear_extrude(height=1) 
    text("${tel}", size=${d.fontSizeN || 5}, halign="center", valign="center", font="${fSel}");
}
`;
};

app.post('/gerar-stl-pro', async (req, res) => {
    const { userId, designId } = req.body;
    try {
        if (userId && userId !== "null") {
            const { data: pago } = await supabase.rpc('deduzir_credito_pelo_download', { 
                user_uuid: userId, design_uuid: designId 
            });
            if (!pago) return res.status(402).json({ error: "Saldo insuficiente" });
        }

        const id = `final_${Date.now()}`;
        const scadPath = path.join(tempDir, `${id}.scad`);
        const stlPath = path.join(tempDir, `${id}.stl`);

        fs.writeFileSync(scadPath, gerarCodigoSCAD(req.body));

        exec(`openscad -o "${stlPath}" "${scadPath}"`, async (error) => {
            if (error) return res.status(500).json({ error: "Erro OpenSCAD" });
            try {
                const fileBuffer = fs.readFileSync(stlPath);
                
                // NOME DO BUCKET CORRIGIDO PARA: makers_pro_stl_prod
                const { error: upErr } = await supabase.storage
                    .from('makers_pro_stl_prod')
                    .upload(`final/${id}.stl`, fileBuffer, { contentType: 'model/stl', upsert: true });

                if (upErr) throw upErr;

                const { data } = supabase.storage.from('makers_pro_stl_prod').getPublicUrl(`final/${id}.stl`);
                res.json({ url: data.publicUrl });
            } catch (err) {
                res.status(500).json({ error: "Erro upload Supabase" });
            } finally {
                if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
                if (fs.existsSync(stlPath)) fs.unlinkSync(stlPath);
            }
        });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log("Servidor Docker Online"));