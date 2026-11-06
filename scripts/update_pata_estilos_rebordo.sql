-- Pata: seletor "Estilo do rebordo" (aplicado em produção a 2026-11-06, com verificação por MD5).
-- O template está em templates/pet_tags/tag-pata.scad (md5 68530cfc8b31de89d53772efeec023f1).
UPDATE prod_designs SET generation_schema = jsonb_set(jsonb_set(generation_schema,
    '{parameters,rebordo_estilo}',
    '{"order": 11.5, "default": "Dedos cheios + contorno do nome", "ui": {"label": "Estilo do rebordo", "widget": "select", "options": ["Dedos cheios + contorno do nome", "Dedos cheios", "Contorno em todos"], "visible_when": {"rebordo": {"min": 1}}}}'::jsonb, true),
    '{parameters,rebordo_largura,ui,visible_when}', '{"rebordo": {"min": 1}, "rebordo_estilo": {"ne": "Dedos cheios"}}'::jsonb)
WHERE id = 'tag-pata';
