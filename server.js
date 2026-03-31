const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors'); // Vamos usar o pacote oficial para garantir

const app = express();

// 1. CONFIGURAÇÃO DE CORS - DEVE SER A PRIMEIRA COISA NO CÓDIGO
app.use(cors({
    origin: '*', // Permite todas as origens temporariamente para teste, ou usa a tua URL da Vercel
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const gerarCodigoSCAD = (d) => {
    const nome = (d.nome_pet || "").replace(/"/g, "'");
    const tel = (d.telefone || "").replace(/"/g, "'");
    const forma = (d.forma || "circulo").toLowerCase().trim();
    
    // MUDANÇA AQUI: Usa caminho relativo para o OpenSCAD no Docker
    const templatePath = `templates/blank_${forma}.scad`; 

    let fSel = "Liberation Sans:style=Bold";
    // ... tuas lógicas de fonte ...

    return `
include <${templatePath}>

// 1. Usamos difference para o verso ESCAVAR a peça
difference() {
    // Chamada do módulo da base
    blank_${forma}(); 
    
    // Texto Verso (Telefone) - ESCAVADO
    // O translate em Z deve ser pequeno (ex: 0.5) para entrar na peça a partir do fundo
    translate([${-(d.xPosN || 0)}, ${d.yPosN || 0}, 0.5]) 
    mirror([1, 0, 0])
    linear_extrude(height=1.1) 
    text("${tel}", size=${d.fontSizeN || 5}, halign="center", valign="center", font="${fSel}");
}

// 2. Texto Frente - RELEVO (Fora do difference)
color("white")
translate([${d.xPos || 0}, ${d.yPos || 0}, 2.9]) 
linear_extrude(height=1) 
text("${nome}", size=${d.fontSize || 7}, halign="center", valign="center", font="${fSel}");
`;
};

app.post('/gerar-stl-pro', async (req, res) => {
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    exec(`openscad -o "${stlPath}" "${scadPath}"`, (error, stdout, stderr) => {
    if (error) {
        console.error("Erro OpenSCAD (Exec):", error);
        console.error("Saída de Erro (Stderr):", stderr); // ESTA LINHA É ESSENCIAL
        return res.status(500).json({ error: "Erro na renderização 3D", details: stderr });
    }
    const scadPath = path.join(tempDir, `${id}.scad`);
    const stlPath = path.join(tempDir, `${id}.stl`);

    try {
        const codigo = gerarCodigoSCAD(req.body);
        fs.writeFileSync(scadPath, codigo);

        exec(`openscad -o "${stlPath}" "${scadPath}"`, async (error) => {
            if (error) {
                console.error("Erro OpenSCAD:", error);
                return res.status(500).json({ error: "Erro na renderização 3D" });
            }

            const fileBuffer = fs.readFileSync(stlPath);
            const { error: upErr } = await supabase.storage
                .from('makers_pro_stl_prod')
                .upload(`final/${id}.stl`, fileBuffer, { contentType: 'model/stl', upsert: true });

            if (upErr) throw upErr;

            const { data } = supabase.storage.from('makers_pro_stl_prod').getPublicUrl(`final/${id}.stl`);
            
            // Limpeza
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