const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Função auxiliar para guardar o DNA do design no Vault
async function guardarNoVault(fileId, conteudoScad) {
    const sPath = `vault/${fileId}.scad`;
    const { error } = await supabase.storage
        .from('makers_pro_stl_prod')
        .upload(sPath, conteudoScad, { contentType: 'text/x-openscad', upsert: true });
    return error ? null : sPath;
}

app.post('/gerar-stl-pro', async (req, res) => {
    const d = req.body;
    let designId = d.id || d.forma; 
    
    // Novo parâmetro para identificar se estamos a recuperar um ficheiro arquivado
    const scadVaultPath = d.scad_vault_path; 

    try {
        let scadTemplate = "";
        
        // Se não for ressurreição, precisamos de buscar o template original
        if (!scadVaultPath) {
            const { data: design } = await supabase
                .from('prod_designs')
                .select('scad_template')
                .eq('id', designId)
                .maybeSingle();

            if (!design) return res.status(404).json({ error: "Design não encontrado" });
            scadTemplate = design.scad_template;
        }

        const fontesPathMap = {
            'Bebas': 'Bebas Neue',
            'Playfair': 'Playfair Display',
            'Open Sans': 'Open Sans',
            'Beaver Punch': 'Beaver Punch',
            'GABRWFER': 'Gabriel Weiss Friends',
            'Megadeth': 'Megadeth'
        };

        const nomeFonteInterno = fontesPathMap[d.fonte] || 'Open Sans';

        const executarRender = async (prefixo, varsExtras = "") => {
            const fileId = `${prefixo}_${Date.now()}`;
            const tempDir = path.join(__dirname, 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

            const scadPath = path.join(tempDir, `${fileId}.scad`);
            const stlPath = path.join(tempDir, `${fileId}.stl`);

            let conteudoFinalScad = "";

            // CENÁRIO A: Recuperar do Vault (Arquivo)
            if (scadVaultPath) {
                const { data: scadBuffer, error: dlErr } = await supabase.storage
                    .from('makers_pro_stl_prod')
                    .download(scadVaultPath);
                
                if (dlErr) throw new Error("Não foi possível recuperar o ficheiro do Vault");
                conteudoFinalScad = await scadBuffer.text();
            } 
            // CENÁRIO B: Novo Design (Lógica original mantida)
            else {
                let conteudoVariaveis = varsExtras;
                Object.entries(d).forEach(([k, v]) => {
                    if (!['id', 'ui_schema', 'fonte', 'scad_vault_path'].includes(k)) {
                        if (typeof v === 'number') conteudoVariaveis += `${k} = ${v};\n`;
                        else if (typeof v === 'string') conteudoVariaveis += `${k} = "${v.replace(/"/g, "'")}";\n`;
                        else if (typeof v === 'boolean') conteudoVariaveis += `${k} = ${v ? "true" : "false"};\n`;
                    }
                });

                conteudoVariaveis += `fonte = "${nomeFonteInterno}";\n`;
                if (d.nome_pet) conteudoVariaveis += `nome_pet = "${d.nome_pet.toUpperCase()}";\n`;
                
                conteudoFinalScad = `$fn=24;\n${conteudoVariaveis}\n${scadTemplate}`;
                
                // Guardar no Vault para o futuro
                await guardarNoVault(fileId, conteudoFinalScad);
            }

            fs.writeFileSync(scadPath, conteudoFinalScad);

            return new Promise((resolve, reject) => {
                // Aumentado timeout para 80s para garantir ressurreição
                exec(`openscad --render -o "${stlPath}" "${scadPath}"`, { timeout: 80000 }, async (err, stdout, stderr) => {
                    if (err) return reject(new Error(`Falha na renderização: ${stderr}`));
                    if (!fs.existsSync(stlPath)) return reject(new Error("Ficheiro STL não gerado"));

                    const buffer = fs.readFileSync(stlPath);
                    const sPath = `final/${fileId}.stl`;

                    const { error: upErr } = await supabase.storage
                        .from('makers_pro_stl_prod')
                        .upload(sPath, buffer, { contentType: 'model/stl', upsert: true });

                    if (upErr) return reject(upErr);
                    const { data } = supabase.storage.from('makers_pro_stl_prod').getPublicUrl(sPath);
                    
                    try { fs.unlinkSync(scadPath); fs.unlinkSync(stlPath); } catch (e) {}
                    resolve(data.publicUrl);
                });
            });
        };

        // Mantém funcionalidade de Tampa/Corpo
        if (d.com_tampa === true && !scadVaultPath) {
            const urlCorpo = await executarRender("corpo", 'gerar_parte = "corpo";\n');
            const urlTampa = await executarRender("tampa", 'gerar_parte = "tampa";\n');
            res.json({ urls: [urlCorpo, urlTampa] });
        } else {
            const url = await executarRender("modelo", 'gerar_parte = "tudo";\n');
            res.json({ url });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/', (req, res) => res.send('Servidor Maker Pro Ativo'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor a correr na porta: ${PORT}`));