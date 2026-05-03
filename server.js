import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Importa as rotas do backend
import { downloadStl } from './routes/download.js';
// Se tiveres preview:
 import { previewRouter } from './routes/preview.js';

const app = express();

// ============================
// Middlewares base
// ============================
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ============================
// Rotas
// ============================
app.post('/download-stl', downloadStl);

// Exemplo se tiveres preview:
 app.use('/preview', previewRouter);

// ============================
// Health check (IMPORTANTE)
// ============================
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

// ============================
// Start server
// ============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Backend a correr na porta ${PORT}`);
});