const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

// 1. CONFIGURAÇÃO DE CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// --- FUNÇÃO GERADORA CORRIGIDA ---
const gerarCodigoSCAD = (d) => {
    const nome = (d.nome_pet || "PET").replace(/"/g, "'");
    const tel = (d.telefone || "").replace(/"/g, "'");
    
    // Identificar a forma (lê 'base' ou 'forma' do frontend)
    const forma = (d.base || d.forma || "circulo").toLowerCase().trim();
    
    // Caminho para o template - Ajustado para a estrutura da tua imagem 
    // Se no Docker o WORKDIR for /app, o __dirname já aponta para lá.
    const templatePath = path.join(__dirname, 'templates', `blank_${forma}.scad`);
    let codigoInjetado = "";

    try {
        if (fs.existsSync(templatePath)) {
            codigoInjetado = fs.readFileSync(templatePath, 'utf8');
            console.log(`✅ Template ${forma} carregado com sucesso.`);
        } else {
            console.error(`❌ Erro: Ficheiro não encontrado em ${templatePath}`);
            // Fallback visual para saberes que o ficheiro falhou
            codigoInjetado = `module blank_${forma}() { cube([20,20,2], center=true); }`;
        }
    } catch (err) {
        console.error("❌ Erro ao ler o template:", err);
        codigoInjetado = `module blank_${forma}() { sphere(r=10); }`;
    }

    // Seleção de Fontes
    let fSel = "Liberation Sans:style=Bold";
    if (d.fonte === 'Bebas') fSel = "Bebas Neue:style=Regular";
    if (d.fonte === 'Playfair') fSel = "Playfair Display:style=Bold";
    if (d.fonte === 'Eindhoven') fSel = "Eindhoven:style=Regular";
    if (d.fonte === 'BADABB') fSel = "Badaboom BB:style=Regular";

    // RETORNO DO CÓDIGO (Injetando a variável correta: codigoInjetado)
    return `
// Código do template injetado manualmente para evitar erros de include no Docker
${codigoInjetado}

union() {
    // Chama o módulo definido no ficheiro injetado
    blank_${forma}(); 
    
    // Texto Frente (Nome) - Relevo
    color("white")
    translate([${d.xPos || 0}, ${d.yPos || 0}, 2.9]) 
    linear_extrude(height=1) 
    text("${nome}", size=${d.fontSize || 7}, halign="center", valign="center", font="${fSel}");

    // Texto Verso (Telefone) - Espelhado para leitura correta após virar a peça
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

        // Execução do OpenSCAD com log de diagnóstico
        exec(`openscad -o "${stlPath}" "${scadPath}"`, async (error, stdout, stderr) => {
            if (stderr) console.log("DIAGNÓSTICO OPENSCAD:", stderr); 

            if (error) {
                console.error("ERRO NA RENDERIZAÇÃO:", stderr);
                return res.status(500).json({ error: "Erro na renderização", details: stderr });
            }

            try {
                const fileBuffer = fs.readFileSync(stlPath);
                const { error: upErr } = await supabase.storage
                    .from('makers_pro_stl_prod')
                    .upload(`final/${id}.stl`, fileBuffer, { contentType: 'model/stl', upsert: true });

                if (upErr) throw upErr;

                const { data } = supabase.storage.from('makers_pro_stl_prod').getPublicUrl(`final/${id}.stl`);
                
                // Limpeza assíncrona para não travar a resposta
                fs.unlink(scadPath, () => {});
                fs.unlink(stlPath, () => {});

                res.json({ url: data.publicUrl });
            } catch (uploadError) {
                console.error("Erro no Supabase:", uploadError);
                res.status(500).json({ error: "Erro ao guardar o ficheiro" });
            }
        });
    } catch (e) {
        console.error("Erro Interno no Servidor:", e);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Docker pronto na porta ${PORT}`));