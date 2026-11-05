-- Pet tags: rebordo ligado por omissão e largura até 4 mm (antes 2,5 mm; omissão 1,5 mm).
-- Aplicado em produção a 2026-11-05. Re-executável.
UPDATE prod_designs SET generation_schema =
  jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(generation_schema,
    '{parameters,rebordo,default}', 'true'),
    '{parameters,rebordo,ui,label}', '"Rebordo (borda em relevo)"'),
    '{parameters,rebordo_largura,max}', '4'),
    '{parameters,rebordo_largura,ui,label}', '"Largura do rebordo"'),
    '{parameters,rebordo_largura,default}', '1.5')
WHERE id IN ('tag-coracao','tag-hexagono','tag-osso','tag-pata','tag-redonda')
  AND generation_schema->'parameters' ? 'rebordo_largura';
