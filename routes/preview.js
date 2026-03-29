const express = require('express');
const router = express.Router();
const { runOpenSCAD } = require('../utils/scadProcessor');
const path = require('path');

// Rota: POST http://teu-backend.render.com:10000/api/preview
router.post('/', async (req, res) => {
    try {
        const { text, font, size, designId } = req.body;

        // Validação básica de segurança
        if (!text || text.length > 20) {
            return res.status(400).json({ error: "Texto inválido ou muito longo" });
        }

        // Chamamos o processador para gerar um PNG
        // O ID aqui serve para nomear o ficheiro temporário
        const tempId = `${designId}_${Date.now()}`;
        const imagePath = await runOpenSCAD({ 
            text, 
            font, 
            size, 
            id: tempId 
        }, 'png');

        // Enviamos o ficheiro para o cliente
        res.sendFile(path.resolve(imagePath));
        
        // Sugestão: Implementar uma lógica para apagar o ficheiro após 1 minuto
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao gerar antevisão" });
    }
});

module.exports = router;