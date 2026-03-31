const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// --- FUNÇÃO GERADORA COM INCLUDE (SEM INJEÇÃO) ---
const gerarCodigoSCAD = (d) => {
    const nome = (d.nome_pet || "PET").replace(/"/g, "'");
    const tel = (d.telefone || "").replace(/"/g, "'");
    
    // 1. Garantir que a variável 'forma' é uma string simples para o include
    const forma = (d.base || d.forma || "circulo").toLowerCase().trim();
    
    // 2. No Docker, o caminho mais seguro para o include é o absoluto
    // O WORKDIR é /app, portanto o include deve apontar para /app/templates/
    const includePath = `templates/blank_${forma}.scad`;

    let fSel = "Liberation Sans:style=Bold";
    if (d.fonte === 'Bebas') fSel = "Bebas Neue:style=Regular";
    if (d.fonte === 'Playfair') fSel = "Playfair Display:style=Bold";
    if (d.fonte === 'Eindhoven') fSel = "Eindhoven:style=Regular";
    if (d.fonte === 'BADABB') fSel = "Badaboom BB:style=Regular";

    // O retorno usa template literals (crases) para injetar o valor de 'includePath' e 'forma'
    return `
include <${includePath}>

union() {
    blank_${forma}(); 
    
    color("white")
    translate([${d.xPos || 0}, ${d.yPos || 0}, 2.9]) 
    linear_extrude(height=1) 
    text("${nome}", size=${d.fontSize || 7}, halign="center", valign="center", font="${fSel}");

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

        exec(`openscad -o "${stlPath}" "${scadPath}"`, async (error, stdout, stderr) => {
            if (stderr) console.log("DIAGNÓSTICO OPENSCAD:", stderr); 

            if (error) {
                console.error("ERRO CRÍTICO:", stderr);
                return res.status(500).json({ error: "Erro na renderização", details: stderr });
            }

            const fileBuffer = fs.readFileSync(stlPath);
            const { error: upErr } = await supabase.storage
                .from('makers_pro_stl_prod')
                .upload(`final/${id}.stl`, fileBuffer, { contentType: 'model/stl', upsert: true });

            if (upErr) throw upErr;

            const { data } = supabase.storage.from('makers_pro_stl_prod').getPublicUrl(`final/${id}.stl`);
            
            if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
            if (fs.existsSync(stlPath)) fs.unlinkSync(stlPath);

            res.json({ url: data.publicUrl });
        });
    } catch (e) {
        console.error("Erro Interno:", e);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Docker pronto na porta ${PORT}`));