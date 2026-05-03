import express from 'express';
import { runOpenSCAD } from '../utils/scadProcessor.js';
import path from 'path';

const router = express.Router();

// POST /api/preview
router.post('/', async (req, res) => {
  try {
    const { text, font, size, designId } = req.body;

    // Validação básica
    if (!text || text.length > 20) {
      return res.status(400).json({
        error: 'Texto inválido ou muito longo'
      });
    }

    const tempId = `${designId}_${Date.now()}`;

    const imagePath = await runOpenSCAD(
      { text, font, size, id: tempId },
      'png'
    );

    res.sendFile(path.resolve(imagePath));
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Erro ao gerar antevisão'
    });
  }
});

export default router;