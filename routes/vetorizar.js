/**
 * POST /vetorizar
 *
 * Pré-visualização do porta-chaves de imagem a cores: devolve os contornos de
 * cada cor (em píxeis) para o browser montar a peça em 3D com vetorGeom.js —
 * o mesmo código que gera o ficheiro final no download.
 *
 * Corpo: { image_path, num_cores?, remover_fundo?, tolerancia? }
 */
import { createClient } from '@supabase/supabase-js';
import { obterVetor, validarCaminhoImagem } from '../app/vetorPortachaves.js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function vetorizar(req, res) {
  try {
    const m = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ error: 'Authorization Bearer obrigatório.' });
    const { data, error } = await supabase.auth.getUser(m[1]);
    if (error || !data?.user) return res.status(401).json({ error: 'Sessão inválida ou expirada.' });

    const { image_path, ...params } = req.body || {};
    validarCaminhoImagem(image_path, data.user.id);

    const vetor = await obterVetor(image_path, params);
    return res.json({ ok: true, vetor });
  } catch (err) {
    console.error('vetorizar error:', err.message);
    return res.status(err.status || 500).json({ error: err.message || 'Erro ao processar a imagem.' });
  }
}
