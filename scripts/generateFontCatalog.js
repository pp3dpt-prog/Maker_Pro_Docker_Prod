const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const fontsDir = '/usr/share/fonts'; // Pasta padrão no Linux/Docker
const outputDir = path.join(__dirname, '../public/font_previews');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Função que extrai as fontes do sistema e gera um PNG de exemplo
const generateCatalog = () => {
    try {
        // Comando para listar fontes instaladas no Docker
        const fontsLog = execSync('fc-list : family').toString();
        const fontFamilies = [...new Set(fontsLog.split('\n').map(f => f.split(',')[0].trim()))].filter(f => f);

        fontFamilies.slice(0, 20).forEach(font => { // Limitamos a 20 para teste
            const safeName = font.replace(/\s+/g, '_');
            const outputPath = path.join(outputDir, `${safeName}.png`);
            
            // Criamos um mini ficheiro .scad temporário apenas para o exemplo da fonte
            const tempScad = `text("${font}", font="${font}", size=10, halign="center");`;
            const scadPath = path.join(__dirname, 'temp_font.scad');
            fs.writeFileSync(scadPath, tempScad);

            const cmd = `openscad -o ${outputPath} --imgsize=400,100 --render ${scadPath}`;
            try {
                execSync(cmd);
                console.log(`Gerada pré-visualização para: ${font}`);
            } catch (e) {
                console.log(`Erro na fonte ${font}: ${e.message}`);
            }
        });
    } catch (err) {
        console.error("Erro ao ler fontes do sistema:", err);
    }
};

module.exports = { generateCatalog };