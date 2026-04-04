const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

app.post('/gerar-stl-pro', async (req, res) => {
    const d = req.body;
    const designId = d.id || d.forma; 

    try {
        const { data: design } = await supabase
            .from('prod_designs')
            .select('scad_template, ui_schema')
            .eq('id', designId)
            .maybeSingle();

        if (!design) return res.status(404).json({ error: "Design não encontrado" });

        const fontesPathMap = {
            'Bebas': { file: 'fonts/BebasNeue-Regular.ttf', name: 'Bebas Neue' },
            'Playfair': { file: 'fonts/PlayfairDisplay-Bold.ttf', name: 'Playfair Display' },
            'Open Sans': { file: 'fonts/OpenSans-Bold.ttf', name: 'Open Sans' },
            'OpenSans': { file: 'fonts/OpenSans-Bold.ttf', name: 'Open Sans' }
        };
        const selecao = fontesPathMap[d.fonte] || fontesPathMap['Open Sans'];
        const caminhoFonte = path.resolve(__dirname, selecao.file).replace(/\\/g, '/');
        let headerSCAD = fs.existsSync(caminhoFonte) ? `use <${caminhoFonte}>\n` : "";

        const executarRender = async (prefixo, varsExtras = "") => {
            const fileId = `${prefixo}_${Date.now()}`;
            const tempDir = path.join(__dirname, 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

            const scadPath = path.join(tempDir, `${fileId}.scad`);
            const stlPath = path.join(tempDir, `${fileId}.stl`);

            // --- CONSTRUÇÃO DINÂMICA DE VARIÁVEIS ---
            let conteudoVariaveis = varsExtras;

            // Percorre o ui_schema para injetar variáveis do banco
            if (design.ui_schema) {
                design.ui_schema.forEach(campo => {
                    const valor = d[campo.name] !== undefined ? d[campo.name] : campo.default;
                    if (typeof valor === 'string') {
                        conteudoVariaveis += `${campo.name} = "${valor.replace(/"/g, "'")}";\n`;
                    } else if (typeof valor === 'boolean') {
                        conteudoVariaveis += `${campo.name} = ${valor ? "true" : "false"};\n`;
                    } else {
                        conteudoVariaveis += `${campo.name} = ${valor};\n`;
                    }
                });
            }

            // Variáveis de Legado e globais
            const addVar = (k, v, isStr = true) => {
                if (!conteudoVariaveis.includes(`${k} =`)) {
                    conteudoVariaveis += isStr ? `${k} = "${v}";\n` : `${k} = ${v};\n`;
                }
            };

            addVar("fonte", selecao.name);
            if (d.nome_pet) addVar("nome_pet", d.nome_pet.toUpperCase());
            if (d.telefone) addVar("telefone", d.telefone);
            
            // Catch-all para sliders de posição das medalhas
            Object.entries(d).forEach(([k, v]) => {
                if (!conteudoVariaveis.includes(`${k} =`) && !['id', 'ui_schema', 'forma'].includes(k)) {
                    if (typeof v === 'number') conteudoVariaveis += `${k} = ${v};\n`;
                }
            });

            fs.writeFileSync(scadPath, `${headerSCAD}\n$fn=24;\n${conteudoVariaveis}\n${design.scad_template}`);

            return new Promise((resolve, reject) => {
                exec(`openscad --render -o "${stlPath}" "${scadPath}"`, { timeout: 60000 }, async (err, stdout, stderr) => {
                    if (err) {
                        console.error("Erro no SCAD:", fs.readFileSync(scadPath, 'utf8'));
                        return reject(new Error(stderr || err.message));
                    }
                    const buffer = fs.readFileSync(stlPath);
                    const sPath = `final/${fileId}.stl`;
                    await supabase.storage.from('makers_pro_stl_prod').upload(sPath, buffer, { contentType: 'model/stl', upsert: true });
                    const { data } = supabase.storage.from('makers_pro_stl_prod').getPublicUrl(sPath);
                    fs.unlinkSync(scadPath); fs.unlinkSync(stlPath);
                    resolve(data.publicUrl);
                });
            });
        };

        // CORREÇÃO DAS ASPAS: gerar_parte agora usa aspas duplas escapadas \"
        if (d.com_tampa === true) {
            const urlCorpo = await executarRender("corpo", "gerar_parte = \"corpo\";\n");
            const urlTampa = await executarRender("tampa", "gerar_parte = \"tampa\";\n");
            res.json({ urls: [urlCorpo, urlTampa] });
        } else {
            const urlUnica = await executarRender("modelo", "gerar_parte = \"tudo\";\n");
            res.json({ url: urlUnica });
        }

    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(process.env.PORT || 10000, '0.0.0.0');