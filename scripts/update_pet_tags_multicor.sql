-- Pet tags (tag-coracao, tag-hexagono, tag-osso, tag-pata, tag-redonda): cores por peça
-- (medalha / nome / rebordo) e 3MF multicor, como na etiqueta de mochila.
-- Requer o backend com o ramo generation_schema.multicor (routes/download.js).
--
-- Template: em vez de o substituir, aplica 3 trocas mínimas ao que está na base de dados
-- (o corpo fica igual) e acrescenta a escolha da parte (modo = base | texto | borda | tudo).
-- Só grava se o resultado tiver exactamente o MD5 testado com o OpenSCAD 2021.01
-- (os ficheiros resultantes estão em templates/pet_tags/). Não é re-executável sobre si
-- próprio: depois de aplicado, o WHERE do MD5 deixa de coincidir e não muda nada.

WITH novo AS (
  SELECT id,
    replace(replace(replace(replace(scad_template, E'\r\n', E'\n'),
      E'\nunion() {\n    difference() {', E'\nmodule _peca(p) {\n    if (p == "base") difference() {'),
      '    translate([xPos, yPos, altura_fixa])', '    if (p == "texto") translate([xPos, yPos, altura_fixa])'),
      E'\nif (rebordo)\n', E'\nmodule _rebordo() if (rebordo)\n')
    || $sel$
// --- MULTICOR (pp3d) ---
// modo: "base" (medalha + argola, com o telefone escavado no verso), "texto" (nome em
// relevo), "borda" (rebordo) ou "tudo" (omissão; "preview" = "tudo"). O backend gera cada
// parte num STL e junta-as num 3MF com uma peça por cor (generation_schema.multicor).
// O nome é recortado pelo rebordo, para as duas peças nunca ocuparem o mesmo volume.
function _modo() = is_undef(modo) ? "tudo" : modo;
function _cor(c, d) = (is_string(c) && len(c) == 7) ? c : d;
module _nome_recortado() { difference() { _peca("texto"); _rebordo(); } }
if (_modo() == "base") {
    _peca("base");
} else if (_modo() == "texto") {
    _nome_recortado();
} else if (_modo() == "borda") {
    _rebordo();
} else {
    color(_cor(is_undef(cor_base)  ? undef : cor_base,  "#FACC15")) _peca("base");
    color(_cor(is_undef(cor_texto) ? undef : cor_texto, "#111111")) _nome_recortado();
    color(_cor(is_undef(cor_borda) ? undef : cor_borda, "#111111")) _rebordo();
}
$sel$ AS tpl
  FROM prod_designs
  WHERE id IN ('tag-coracao', 'tag-hexagono', 'tag-osso', 'tag-pata', 'tag-redonda')
),
pal AS (SELECT '[{"nome": "Branco", "hex": "#FFFFFF"}, {"nome": "Preto", "hex": "#111111"}, {"nome": "Cinzento", "hex": "#9CA3AF"}, {"nome": "Vermelho", "hex": "#DC2626"}, {"nome": "Laranja", "hex": "#F97316"}, {"nome": "Amarelo", "hex": "#FACC15"}, {"nome": "Verde", "hex": "#16A34A"}, {"nome": "Azul claro", "hex": "#38BDF8"}, {"nome": "Azul", "hex": "#1E3A8A"}, {"nome": "Roxo", "hex": "#7C3AED"}, {"nome": "Rosa", "hex": "#F472B6"}]'::jsonb AS p)
UPDATE prod_designs d SET
  scad_template = novo.tpl,
  generation_schema = jsonb_set(
    d.generation_schema || jsonb_build_object('multicor', '{"param_impressao": "impressao", "troca_cor_mm": 3, "partes": [{"modo": "base", "nome": "Medalha", "cor_param": "cor_base"}, {"modo": "texto", "nome": "Nome", "cor_param": "cor_texto"}, {"modo": "borda", "nome": "Rebordo", "cor_param": "cor_borda"}]}'::jsonb),
    '{parameters}',
    (d.generation_schema->'parameters') || jsonb_build_object(
      'impressao', '{"order": 14, "default": "AMS (3MF multicor)", "ui": {"label": "Impressora", "widget": "select", "options": ["AMS (3MF multicor)", "Sem AMS (troca de cor manual)"]}}'::jsonb,
      'cor_base',  jsonb_build_object('order', 15, 'default', '#FACC15', 'ui', jsonb_build_object('label', 'Cor da medalha', 'widget', 'color', 'paleta', pal.p)),
      'cor_texto', jsonb_build_object('order', 16, 'default', '#111111', 'ui', jsonb_build_object('label', 'Cor do nome (e do rebordo, sem AMS)', 'widget', 'color', 'paleta', pal.p)),
      'cor_borda', jsonb_build_object('order', 17, 'default', '#111111', 'ui', jsonb_build_object('label', 'Cor do rebordo', 'widget', 'color', 'paleta', pal.p,
                     'visible_when', '{"rebordo": {"min": 1}, "impressao": {"ne": "Sem AMS (troca de cor manual)"}}'::jsonb))
    )
  )
FROM novo, pal
WHERE d.id = novo.id
  AND md5(novo.tpl) = CASE d.id
      WHEN 'tag-coracao' THEN 'be14aeeffe4bf8dc4ecbc00e7342ea63'
      WHEN 'tag-hexagono' THEN '654d4173df4f5c3a2a6b9d01e2c13cb8'
      WHEN 'tag-osso' THEN 'dbe49d127932488d48dffe46b447fc9a'
      WHEN 'tag-pata' THEN '89222f3aa946c78fd38ddf1f9437ac86'
      WHEN 'tag-redonda' THEN 'd28acffd2ff1b61e83f9a8ee167a9708'
    END
RETURNING d.id, md5(d.scad_template) AS md5_tpl;
