-- Imagem com as cores próprias nos 4 suportes de telemóvel personalizados (2026-11-12).
-- Por zona: cores_imagem_<zona> ("Uma cor" / "Cores da imagem"), num_cores_<zona> (2–6) e
-- cor_<zona>_<i> (vazia = cor detetada na imagem; ui.auto no GeneratedEditor). logo[] ganha
-- cores_param / num_cores_param (lib/logo.js + lib/imagemCores.js); multicor.partes "<zona>_c<i>"
-- com so_quando / min_param / cor_auto_param (lib/partes.js); multicor.agrupar_por_cor (as partes
-- com a mesma cor juntam-se numa peça); sem_ams_ficheiros com uma peça para colar por cor.
-- Os templates (modos "<zona>_c<i>" e "<zona>_c<i>_solta") foram aplicados à parte, com
-- UPDATE ... SET scad_template e verificação por MD5:
--   suporte_telemovel_personalizado              1144a0d0eee51f48f0640a68bbbf0de4
--   suporte_telemovel_secretaria_personalizado   e0000c1d9e3c22bf3d2d56d0013bbf37
--   suporte_telemovel_dock_personalizado         6b2c3924b675139e4112d8886556ff36
--   suporte_telemovel_dobravel_personalizado     c170d0638d25538085be6509e47b84fc

WITH z(id, zona, rot, base) AS (VALUES
  ('suporte_telemovel_personalizado', 'rampa', 'rampa', 40),
  ('suporte_telemovel_personalizado', 'labio', 'lábio', 50),
  ('suporte_telemovel_secretaria_personalizado', 'encosto', 'encosto', 40),
  ('suporte_telemovel_secretaria_personalizado', 'labio', 'lábio', 50),
  ('suporte_telemovel_dock_personalizado', 'frente', 'frente', 40),
  ('suporte_telemovel_dock_personalizado', 'inclinada', 'face inclinada', 50),
  ('suporte_telemovel_dobravel_personalizado', 'frente', 'travessa da frente', 40),
  ('suporte_telemovel_dobravel_personalizado', 'lados', 'laterais', 50)),
zi AS (
  SELECT z.*, i,
    jsonb_build_object('conteudo_' || zona, 'Imagem', 'cores_imagem_' || zona, 'Cores da imagem') AS so,
    jsonb_build_object('num_cores_' || zona, i) AS mp,
    jsonb_build_object('conteudo_' || zona, '{"eq": "Imagem"}'::jsonb, 'cores_imagem_' || zona, '{"eq": "Cores da imagem"}'::jsonb) AS vis
  FROM z CROSS JOIN generate_series(1, 6) AS i),
params AS (
  SELECT id, jsonb_object_agg(k, v) AS j FROM (
    SELECT id, 'cores_imagem_' || zona AS k, jsonb_build_object(
      'ui', jsonb_build_object('label', 'Cores da imagem (' || rot || ')', 'widget', 'select',
        'options', '["Uma cor", "Cores da imagem"]'::jsonb,
        'visible_when', jsonb_build_object('conteudo_' || zona, '{"eq": "Imagem"}'::jsonb)),
      'order', base + 3.5, 'default', 'Uma cor') AS v FROM z
    UNION ALL
    SELECT id, 'num_cores_' || zona, jsonb_build_object(
      'ui', jsonb_build_object('step', 1, 'label', 'Número de cores da imagem (' || rot || ')', 'widget', 'slider',
        'visible_when', jsonb_build_object('conteudo_' || zona, '{"eq": "Imagem"}'::jsonb, 'cores_imagem_' || zona, '{"eq": "Cores da imagem"}'::jsonb)),
      'min', 2, 'max', 6, 'type', 'number', 'order', base + 3.6, 'default', 3) FROM z
    UNION ALL
    SELECT zi.id, 'cor_' || zona || '_' || i, jsonb_build_object(
      'ui', jsonb_build_object('label', 'Cor ' || i || ' da imagem (' || rot || ')', 'widget', 'color', 'auto', 'Cor da imagem',
        'paleta', d.generation_schema->'parameters'->('cor_' || zona)->'ui'->'paleta',
        'visible_when', vis || jsonb_build_object('num_cores_' || zona, jsonb_build_object('min', i))),
      'order', base + 6 + i / 100.0, 'default', '')
    FROM zi JOIN prod_designs d ON d.id = zi.id
  ) t GROUP BY id),
partes AS (
  SELECT id, jsonb_agg(jsonb_build_object('modo', zona || '_c' || i,
      'nome', upper(left(rot, 1)) || substr(rot, 2) || ' — cor ' || i,
      'cor_param', 'cor_' || zona || '_' || i, 'cor_auto_param', zona || '_c' || i || '_hex',
      'so_quando', so, 'min_param', mp) ORDER BY base, i) AS j
  FROM zi GROUP BY id),
sem AS (
  SELECT id, jsonb_agg(jsonb_build_object('nome', zona || '_cor' || i || '_peca_para_colar.stl',
      'params', jsonb_build_object('modo', zona || '_c' || i || '_solta'),
      'so_quando', so, 'min_param', mp) ORDER BY base, i) AS j
  FROM zi GROUP BY id)
UPDATE prod_designs d SET generation_schema =
  jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(d.generation_schema,
    '{parameters}', (d.generation_schema->'parameters') || params.j),
    '{multicor,partes}', (d.generation_schema->'multicor'->'partes') || partes.j),
    '{multicor,sem_ams_ficheiros}', (d.generation_schema->'multicor'->'sem_ams_ficheiros') || sem.j),
    '{multicor,agrupar_por_cor}', 'true'::jsonb),
    '{multicor,texto_sem_ams}', (d.generation_schema->'multicor'->'texto_sem_ams')
      || '["", "Imagem a cores: uma peça para colar por cada cor (<zona>_cor<n>_peca_para_colar.stl)."]'::jsonb),
    '{logo}', (SELECT jsonb_agg(e || jsonb_build_object('cores_param', 'cores_imagem_' || (e->>'prefixo'),
                                                        'num_cores_param', 'num_cores_' || (e->>'prefixo')))
               FROM jsonb_array_elements(d.generation_schema->'logo') e)),
    '{parameters,info_suporte,ui,text}', to_jsonb((d.generation_schema->'parameters'->'info_suporte'->'ui'->>'text')
      || ' 🎨 Imagens com as cores próprias: escolhe "Cores da imagem" e o número de cores (até 6) — cada cor sai numa peça própria do 3MF, com a cor detetada na imagem; podes trocar a cor de cada uma, e as que ficarem com a mesma cor juntam-se numa só peça (um filamento do AMS). Sem AMS sai uma peça para colar por cada cor.'))
FROM params, partes, sem
WHERE d.id = params.id AND d.id = partes.id AND d.id = sem.id
RETURNING d.id, jsonb_array_length(d.generation_schema->'multicor'->'partes') AS partes;

-- a cor única da zona (cor_<zona>) esconde-se quando a imagem é a cores (uma zona de cada vez:
-- um UPDATE ... FROM só aplica uma linha por design)
UPDATE prod_designs d SET generation_schema = jsonb_set(d.generation_schema,
    ARRAY['parameters', 'cor_' || z.zona, 'ui', 'visible_when', 'cores_imagem_' || z.zona], '{"ne": "Cores da imagem"}'::jsonb)
FROM (VALUES ('suporte_telemovel_personalizado', 'rampa'), ('suporte_telemovel_secretaria_personalizado', 'encosto'),
             ('suporte_telemovel_dock_personalizado', 'frente'), ('suporte_telemovel_dobravel_personalizado', 'frente')) AS z(id, zona)
WHERE d.id = z.id;
UPDATE prod_designs d SET generation_schema = jsonb_set(d.generation_schema,
    ARRAY['parameters', 'cor_' || z.zona, 'ui', 'visible_when', 'cores_imagem_' || z.zona], '{"ne": "Cores da imagem"}'::jsonb)
FROM (VALUES ('suporte_telemovel_personalizado', 'labio'), ('suporte_telemovel_secretaria_personalizado', 'labio'),
             ('suporte_telemovel_dock_personalizado', 'inclinada'), ('suporte_telemovel_dobravel_personalizado', 'lados')) AS z(id, zona)
WHERE d.id = z.id;
