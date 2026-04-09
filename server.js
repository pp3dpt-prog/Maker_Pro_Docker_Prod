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
    const scadVaultPath = d.scad_vault_path; 
    const userId = d.user_id;

    try {
        let scadTemplate = "";
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
            'Bebas': 'Bebas Neue', 'Playfair': 'Playfair Display', 'Open Sans': 'Open Sans',
            'Beaver Punch': 'Beaver Punch', 'GABRWFER': 'Gabriel Weiss Friends', 'Megadeth': 'Megadeth'
        };

        const nomeFonteInterno = fontesPathMap[d.fonte] || 'Open Sans';

        const executarRender = async (prefixo, varsExtras = "") => {
            const sanitize = (str) => String(str).replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const petName = d.nome_pet ? sanitize(d.nome_pet) : 'objeto';
            const fileId = `${prefixo}_${sanitize(designId)}_${petName}_${Date.now()}`;
            
            const tempDir = path.join(__dirname, 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

            const scadPath = path.join(tempDir, `${fileId}.scad`);
            const stlPath = path.join(tempDir, `${fileId}.stl`);

            let conteudoFinalScad = "";
            let finalVaultPath = scadVaultPath;

            if (scadVaultPath) {
                const { data: scadBuffer, error: dlErr } = await supabase.storage
                    .from('makers_pro_stl_prod')
                    .download(scadVaultPath);
                if (dlErr) throw new Error("Erro ao baixar do Vault");
                conteudoFinalScad = await scadBuffer.text();
            } else {
                let conteudoVariaveis = varsExtras;
                Object.entries(d).forEach(([k, v]) => {
                    if (!['id', 'ui_schema', 'fonte', 'scad_vault_path', 'user_id', 'nome_personalizado'].includes(k)) {
                        if (typeof v === 'number') conteudoVariaveis += `${k} = ${v};\n`;
                        else if (typeof v === 'string') conteudoVariaveis += `${k} = "${v.replace(/"/g, "'")}";\n`;
                        else if (typeof v === 'boolean') conteudoVariaveis += `${k} = ${v ? "true" : "false"};\n`;
                    }
                });
                conteudoVariaveis += `fonte = "${nomeFonteInterno}";\n`;
                if (d.nome_pet) conteudoVariaveis += `nome_pet = "${d.nome_pet.toUpperCase()}";\n`;
                
                conteudoFinalScad = `$fn=24;\n${conteudoVariaveis}\n${scadTemplate}`;
                finalVaultPath = await guardarNoVault(fileId, conteudoFinalScad);
            }

            fs.writeFileSync(scadPath, conteudoFinalScad);

            return new Promise((resolve, reject) => {
                exec(`openscad --render -o "${stlPath}" "${scadPath}"`, { timeout: 80000 }, async (err, stdout, stderr) => {
                    if (err) return reject(new Error(`Erro OpenSCAD: ${stderr}`));
                    
                    const buffer = fs.readFileSync(stlPath);
                    const sPath = `final/${fileId}.stl`;

                    const { error: upErr } = await supabase.storage
                        .from('makers_pro_stl_prod')
                        .upload(sPath, buffer, { contentType: 'model/stl', upsert: true });

                    if (upErr) return reject(upErr);
                    const { data } = supabase.storage.from('makers_pro_stl_prod').getPublicUrl(sPath);
                    const publicUrl = data.publicUrl;

                    if (userId && !scadVaultPath) {
                        await supabase.from('prod_user_assets').insert([{
                            user_id: userId,
                            design_id: designId,
                            nome_personalizado: d.nome_personalizado,
                            scad_vault_path: finalVaultPath,
                            stl_url: publicUrl,
                            is_archived: false,
                            last_rendered_at: new Date().toISOString()
                        }]);
                    } else if (scadVaultPath) {
                        await supabase.from('prod_user_assets')
                            .update({ stl_url: publicUrl, is_archived: false, last_rendered_at: new Date().toISOString() })
                            .eq('scad_vault_path', scadVaultPath);
                    }

                    try { fs.unlinkSync(scadPath); fs.unlinkSync(stlPath); } catch (e) {}
                    resolve(publicUrl);
                });
            });
        };

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

app.get('/', (req, res) => res.send('Servidor Maker Pro Ativo com Vault e Custo Variável'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Porta: ${PORT}`));