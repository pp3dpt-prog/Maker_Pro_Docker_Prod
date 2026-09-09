-- Atualiza o produto esquadro-montagem — alarga o intervalo do parâmetro
-- "folga" para dar controlo real sobre a largura da calha (canal), não só um
-- ajuste fino de tolerância. Usar este UPDATE em vez de re-correr o v3. SQL
-- editor do Supabase.
--
-- v4 (2026-09-09):
--   "folga" passa de 0.1–1mm (só tolerância de encaixe) para 0–6mm — a
--   largura real da calha é espessura_chapa + folga, por isso com o
--   intervalo antigo a calha mal mudava de tamanho. Não mexe no
--   scad_template (a fórmula gap() = espessura_chapa + folga já suporta
--   qualquer valor positivo) — só no generation_schema.

UPDATE prod_designs SET
  generation_schema = jsonb_set(
    generation_schema,
    '{parameters,folga}',
    '{
      "ui": { "label": "Folga da calha (aperta/alarga o encaixe da chapa)", "widget": "slider", "step": 0.1 },
      "min": 0, "max": 6, "unit": "mm", "order": 7, "default": 0.3
    }'::jsonb
  )
WHERE id = 'esquadro-montagem';
