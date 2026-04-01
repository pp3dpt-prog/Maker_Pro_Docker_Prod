const express = require('express');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

// Configuração de CORS para permitir pedidos do Vercel
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Inicialização do Supabase com a Service Role Key para bypassar RLS
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.post('/gerar-stl-pro', async (req, res) => {
    const d = req.body;
    
    // O ID deve ser o slug da tabela (ex: "tag-coracao") enviado pelo frontend
    const designId = d.id || d.forma; 

    console.log(`🚀 A processar pedido para o design: ${designId}`);

    try {
        // 1. Procura o design na tabela prod_designs pelo ID (slug)
        const { data: design, error: dbError } = await supabase
            .from('prod_designs')
            .select('scad_template, ui_schema, default_size_nome')
            .eq('id', designId)
            .maybeSingle();

        if (dbError) {
            console.error("❌ Erro na consulta à DB:", dbError);
            return res.status(500).json({ error: "Erro ao consultar base de dados", details: dbError.message });
        }

        if (!design) {
            console.error(`❌ Design '${designId}' não encontrado.`);
            return res.status(404).json({ error: `O modelo '${designId}' não existe na base de dados.` });
        }

        // 2. Construção dinâmica das variáveis baseada no ui_schema
        let variaveisSCAD = "";
        const esquema = design.ui_schema || [];
        
        esquema.forEach(campo => {
            // Usa o valor enviado pelo utilizador, senão usa o default do esquema
            const valorUser = d[campo.name] !== undefined ? d[campo.name] : campo.default;
            
            if (campo.type === 'text' || campo.type === 'font-select') {
                // Limpa aspas para evitar quebra de sintaxe no OpenSCAD
                const stringSegura = valorUser.toString().replace(/"/g, "'");
                variaveisSCAD += `${campo.name} = "${stringSegura}";\n`;
            } else {
                variaveisSCAD += `${campo.name} = ${valorUser};\n`;
            }
        });

        // Define a variável 'escala' (prioridade: envio do user > default da tabela > 30)
        const escalaBase = d.escala || design.default_size_nome || 30;
        variaveisSCAD += `escala = ${escalaBase};\n`;

        // 3. Montagem do código SCAD final
        const codigoFinal = `
$fn=64;
// --- Variáveis Injetadas ---
${variaveisSCAD}

// --- Código do Template ---
${design.scad_template}
`;