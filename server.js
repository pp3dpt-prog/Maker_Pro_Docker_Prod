const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const gerarCodigoSCAD = (d) => {
    const nome = (d.nome_pet || "").replace(/"/g, "'");
    const tel = (d.telefone || "").replace(/"/g, "'");
    const forma = (d.forma || "circulo").toLowerCase().trim();
    
    // Caminho para o ficheiro .scad da forma (ex: templates/blank_circulo.scad)
    const templatePath = path.resolve(__dirname, 'templates', `blank_${forma}.scad`).replace(/\\/g, '/');

    let fSel = "Liberation Sans:style=Bold";
    if (d.fonte === 'Bebas') fSel = "Bebas Neue:style=Regular";
    if (d.fonte === 'Playfair') fSel = "Playfair Display:style=Bold";
    if (d.fonte === 'Eindhoven') fSel = "Eindhoven:style=Regular";
    if (d.fonte === 'BADABB') fSel = "Badaboom BB:style=Regular";

    // "use" carrega o ficheiro. Depois chamamos o módulo (ex: blank_circulo();)
    return `
use <${templatePath}>

union() {
    // Chamada do módulo da forma base
    blank_${forma}(); 
    
    // Texto Frente
    color("white")
    translate([${d.xPos || 0}, ${d.yPos || 0}, 2.9]) 
    linear_extrude(height=1) 
    text("${nome}", size=${d.fontSize || 7}, halign="center", valign="center", font="${fSel}");

    // Texto Verso
    color("white")
    translate([${-(d.xPosN || 0)}, ${d.yPosN || 0}, -0.5]) 
    mirror([1, 0, 0])
    linear_extrude(height=1) 
    text("${tel}", size=${d.fontSizeN || 5}, halign="center", valign="center", font="${fSel}");
}
`;
};

app.post('/gerar-stl-pro', async (req, res) => {
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const id = `final_${Date.now()}`;
    const scadPath = path.join(tempDir, `${id}.scad`);
    const stlPath = path.join(tempDir, `${id}.stl`);

    try {
        const codigo = gerarCodigoSCAD(req.body);
        fs.writeFileSync(scadPath, codigo);

        // Executa o OpenSCAD para converter o script em STL real para o Supabase
        exec(`openscad -o "${stlPath}" "${scadPath}"`, async (error) => {
            if (error) {
                console.error("Erro OpenSCAD:", error);
                return res.status(500).json({ error: "Erro ao renderizar" });
            }

            const fileBuffer = fs.readFileSync(stlPath);
            const { error: upErr } = await supabase.storage
                .from('makers_pro_stl_prod')
                .upload(`final/${id}.stl`, fileBuffer, { contentType: 'model/stl', upsert: true });

            if (upErr) throw upErr;

            const { data } = supabase.storage.from('makers_pro_stl_prod').getPublicUrl(`final/${id}.stl`);
            
            // Limpa temporários
            fs.unlinkSync(scadPath);
            fs.unlinkSync(stlPath);

            res.json({ url: data.publicUrl });
        });
    } catch (e) {
        res.status(500).json({ error: "Erro interno" });
    }
});

app.listen(10000, () => console.log("Docker Server Ready - SCAD templates mode"));