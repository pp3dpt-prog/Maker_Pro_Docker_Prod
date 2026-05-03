import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { downloadStl } from './routes/download.js';
import previewRouter from './routes/preview.js';

const app = express();

// ============================
// Middlewares base
// ============================
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ============================
// Rotas
// ============================

// Download final do STL (com login / créditos)
app.post('/download-stl', downloadStl);

// Preview (PNG) — sem créditos
app.use('/api/preview', previewRouter);

// ============================
// Health check (Render)
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