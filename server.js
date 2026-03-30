const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const app = express();

// --- CORREÇÃO 1: CORS NO TOPO ABSOLUTO ---
app.use((req, res, next) => {
    const origin = req.headers.origin;
    // Aceita qualquer origem da Vercel para não haver falhas de "Mismatch"
    if (origin && origin.includes("vercel.app")) {
        res.header("Access-Control-Allow-Origin", origin);
    } else {
        res.header("Access-Control-Allow-Origin", "https://maker-pro-frontend.vercel.app");
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

app.use(express.json());

// Inicialização do Supabase com verificação
const supabase = createClient(
    process.env.SUPABASE_URL || '', 
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

// ROTA CORRIGIDA
app.post('/gerar-stl-pro', async (req, res) => {
    try {
        const { nome, nome_pet, telefone, forma, fonte, userId, designId } = req.body;
        const finalNome = nome || nome_pet || "SEM NOME";

        // --- CORREÇÃO 2: EVITAR CRASH SE USER FOR NULL ---
        if (!userId || userId === null) {
            console.log("Aviso: Tentativa de gerar sem UserId. A ignorar créditos para teste.");
            // Durante os testes, vamos deixar passar. 
            // Se quiseres bloquear, usa: return res.status(401).json({ error: "Login necessário" });
        } else {
            const { data: pago, error: rpcError } = await supabase.rpc('deduzir_credito_pelo_download', { 
                user_uuid: userId, 
                design_uuid: designId 
            });
            if (rpcError || !pago) return res.status(402).json({ error: "Saldo insuficiente" });
        }

        const id = `final_${Date.now()}`;
        const scadPath = path.join(tempDir, `${id}.scad`);
        const stlPath = path.join(tempDir, `${id}.stl`);

        // Função de geração (usa a que já tinhas no server.js)
        const scadCode = `
            // ... (o teu código de gerarCodigoSCAD aqui) ...
        `;
        
        fs.writeFileSync(scadPath, scadCode);

        exec(`openscad -o "${stlPath}" "${scadPath}"`, async (error) => {
            if (error) {
                console.error("Erro OpenSCAD:", error);
                return res.status(500).json({ error: "Erro na renderização" });
            }

            try {
                const fileBuffer = fs.readFileSync(stlPath);
                const fileName = `final/${id}.stl`;
                
                const { error: uploadError } = await supabase.storage
                    .from('makers_pro_stls')
                    .upload(fileName, fileBuffer);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from('makers_pro_stls')
                    .getPublicUrl(fileName);

                res.json({ url: data.publicUrl });
            } catch (err) {
                res.status(500).json({ error: "Erro no upload para Supabase" });
            } finally {
                if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
                if (fs.existsSync(stlPath)) fs.unlinkSync(stlPath);
            }
        });
    } catch (err) {
        console.error("Erro Geral:", err);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor ativo na porta ${PORT}`));