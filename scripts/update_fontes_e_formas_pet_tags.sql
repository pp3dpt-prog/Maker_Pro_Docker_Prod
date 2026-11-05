-- Fontes e formas novas (2026-11-05).
--  1. Pet tags (5): offset(delta = 0.01) no nome e no telefone — a Press Start 2P dava
--     malha não fechada — e as 15 fontes do servidor (antes 4).
--  2. Pet tags novas, em RASCUNHO (só o admin as vê): tag-estrela, tag-gato, tag-escudo,
--     copiadas da tag-hexagono (schema, preços, plano) com template próprio.
--     Sem base_template_id (prod_scad_templates só tem as 4 formas originais; não é usada).
--     Templates em templates/pet_tags/. Falta: miniatura (Admin → Miniaturas) e estado = 'ativo'.
--  3. Porta-chaves com patamares, copo dos dentes e etiqueta de cabide: 15 fontes
--     ("Baloo2" → "Baloo 2"); a etiqueta de cabide leva também o offset na Press Start 2P.
-- Cada template só é gravado se tiver o MD5 testado com o OpenSCAD 2021.01.

-- 1.
UPDATE prod_designs d SET
  scad_template = n.tpl,
  generation_schema = jsonb_set(d.generation_schema, '{parameters,fonte,ui,options}', '["Open Sans", "Aladin", "Amarante", "Anton", "Baloo 2", "Benne", "Chewy", "Gloria Hallelujah", "Lobster", "Luckiest Guy", "Oswald", "Pacifico", "Press Start 2P", "Racing Sans One", "Sigmar One"]'::jsonb)
FROM (
  SELECT id, replace(replace(replace(scad_template, E'\r\n', E'\n'),
           'text(nome_pet,', 'offset(delta = 0.01) text(nome_pet,'),
           'text(telefone,', 'offset(delta = 0.01) text(telefone,') AS tpl
  FROM prod_designs WHERE id IN ('tag-coracao','tag-hexagono','tag-osso','tag-pata','tag-redonda')
) n
WHERE d.id = n.id AND md5(n.tpl) = CASE d.id
      WHEN 'tag-coracao' THEN '4637ef0e2f637c4fe2712d374b7029d1'
      WHEN 'tag-hexagono' THEN '8bb8a82a7bd215d9bc021abd9056e941'
      WHEN 'tag-osso' THEN 'cd9c35bf28d8614be8e9acc30ad4c077'
      WHEN 'tag-pata' THEN '01c243461671cde4477032c6f03e330c'
      WHEN 'tag-redonda' THEN '8413d2bce3b8f6b09a4fce4f70eaf4c9'
    END;

-- 2.
INSERT INTO prod_designs
SELECT (jsonb_populate_record(NULL::prod_designs, to_jsonb(d) || jsonb_build_object(
  'id', 'tag-estrela', 'nome', 'Estrela', 'estado', 'rascunho',
  'scad_template', t.tpl,
  'stl_file_path', '/models/blank_estrela.stl', 'base_template_id', NULL,
  'thumbnail_url', NULL, 'image_url', NULL, 'descricao', NULL,
  'likes', 0, 'total_likes', 0, 'downloads', 0, 'total_downloads', 0, 'criado_em', now()
))).*
FROM prod_designs d, (SELECT $tpl$altura_fixa = 3;

// Estrela de 5 pontas com as pontas arredondadas (raio 2 mm); argola na ponta de cima.
module corpo_2d() {
    offset(r = 2, $fn = 48) offset(delta = -2)
        polygon([for (i = [0:9]) let(a = 90 + i * 36, r = (i % 2 == 0) ? 19 : 9) [r * cos(a), r * sin(a)]]);
}

module geometria_estrela() {
    linear_extrude(height = altura_fixa) difference() {
        union() {
            corpo_2d();
            translate([0, 15.5]) circle(r = 4.5, $fn = 72);   // argola
        }
        translate([0, 15.5]) circle(r = 2.4, $fn = 72);       // furo da argola
    }
}

module _peca(p) {
    if (p == "base") difference() {
        geometria_estrela();
        translate([xPosN, yPosN, -0.1]) 
            mirror([1,0,0])
            linear_extrude(height = 1.1) 
                offset(delta = 0.01) text(telefone, size = fontSizeN, font = fonte, halign = "center", valign = "center");
    }
    if (p == "texto") translate([xPos, yPos, altura_fixa]) 
        linear_extrude(height = 1) 
            offset(delta = 0.01) text(nome_pet, size = fontSize, font = fonte, halign = "center", valign = "center");
}

// --- REBORDO (opcional) ---
rebordo = false;
rebordo_largura = 1.2;
rebordo_altura = 1;
module rebordo_corpo_2d() { corpo_2d(); }
module rebordo_furo_2d() { translate([0, 15.5]) circle(r = 2.4, $fn = 72); }
module _rebordo() if (rebordo)
    translate([0, 0, altura_fixa]) linear_extrude(height = rebordo_altura)
        difference() { rebordo_corpo_2d(); offset(delta = -rebordo_largura) rebordo_corpo_2d(); rebordo_furo_2d(); }

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
$tpl$ AS tpl) t
WHERE d.id = 'tag-hexagono' AND md5(t.tpl) = '7c5755e47f20e89a0f29f99831d7f10c'
  AND NOT EXISTS (SELECT 1 FROM prod_designs WHERE id = 'tag-estrela');
INSERT INTO prod_designs
SELECT (jsonb_populate_record(NULL::prod_designs, to_jsonb(d) || jsonb_build_object(
  'id', 'tag-gato', 'nome', 'Gato', 'estado', 'rascunho',
  'scad_template', t.tpl,
  'stl_file_path', '/models/blank_gato.stl', 'base_template_id', NULL,
  'thumbnail_url', NULL, 'image_url', NULL, 'descricao', NULL,
  'likes', 0, 'total_likes', 0, 'downloads', 0, 'total_downloads', 0, 'criado_em', now()
))).*
FROM prod_designs d, (SELECT $tpl$altura_fixa = 3;

// Cabeça de gato: círculo + duas orelhas; o fecho (offset +1 / -1) suaviza a ligação
// orelha-cabeça e o arredondamento (raio 1,5 mm) as pontas das orelhas.
module corpo_2d() {
    offset(r = 1.5, $fn = 48) offset(delta = -1.5)
    offset(r = -1, $fn = 48) offset(r = 1, $fn = 48) union() {
        circle(r = 14, $fn = 96);
        polygon([[-13.5, 4.5], [-5, 12.8], [-11, 21]]);
        polygon([[13.5, 4.5], [5, 12.8], [11, 21]]);
    }
}

module geometria_gato() {
    linear_extrude(height = altura_fixa) difference() {
        union() {
            corpo_2d();
            translate([0, 15.5]) circle(r = 4.5, $fn = 72);   // argola
        }
        translate([0, 15.5]) circle(r = 2.4, $fn = 72);       // furo da argola
    }
}

module _peca(p) {
    if (p == "base") difference() {
        geometria_gato();
        translate([xPosN, yPosN, -0.1]) 
            mirror([1,0,0])
            linear_extrude(height = 1.1) 
                offset(delta = 0.01) text(telefone, size = fontSizeN, font = fonte, halign = "center", valign = "center");
    }
    if (p == "texto") translate([xPos, yPos, altura_fixa]) 
        linear_extrude(height = 1) 
            offset(delta = 0.01) text(nome_pet, size = fontSize, font = fonte, halign = "center", valign = "center");
}

// --- REBORDO (opcional) ---
rebordo = false;
rebordo_largura = 1.2;
rebordo_altura = 1;
module rebordo_corpo_2d() { corpo_2d(); }
module rebordo_furo_2d() { translate([0, 15.5]) circle(r = 2.4, $fn = 72); }
module _rebordo() if (rebordo)
    translate([0, 0, altura_fixa]) linear_extrude(height = rebordo_altura)
        difference() { rebordo_corpo_2d(); offset(delta = -rebordo_largura) rebordo_corpo_2d(); rebordo_furo_2d(); }

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
$tpl$ AS tpl) t
WHERE d.id = 'tag-hexagono' AND md5(t.tpl) = '518f571f21790e78bca7b6ed532ffd42'
  AND NOT EXISTS (SELECT 1 FROM prod_designs WHERE id = 'tag-gato');
INSERT INTO prod_designs
SELECT (jsonb_populate_record(NULL::prod_designs, to_jsonb(d) || jsonb_build_object(
  'id', 'tag-escudo', 'nome', 'Escudo', 'estado', 'rascunho',
  'scad_template', t.tpl,
  'stl_file_path', '/models/blank_escudo.stl', 'base_template_id', NULL,
  'thumbnail_url', NULL, 'image_url', NULL, 'descricao', NULL,
  'likes', 0, 'total_likes', 0, 'downloads', 0, 'total_downloads', 0, 'criado_em', now()
))).*
FROM prod_designs d, (SELECT $tpl$altura_fixa = 3;

// Escudo: topo direito, laterais a descer até uma ponta; cantos arredondados (raio 2 mm).
module corpo_2d() {
    offset(r = 2, $fn = 48) offset(delta = -2)
        polygon([[-14, 12], [14, 12], [14, 1], [9, -9], [0, -17], [-9, -9], [-14, 1]]);
}

module geometria_escudo() {
    linear_extrude(height = altura_fixa) difference() {
        union() {
            corpo_2d();
            translate([0, 15]) circle(r = 5, $fn = 72);   // argola
        }
        translate([0, 15]) circle(r = 2.5, $fn = 72);       // furo da argola
    }
}

module _peca(p) {
    if (p == "base") difference() {
        geometria_escudo();
        translate([xPosN, yPosN, -0.1]) 
            mirror([1,0,0])
            linear_extrude(height = 1.1) 
                offset(delta = 0.01) text(telefone, size = fontSizeN, font = fonte, halign = "center", valign = "center");
    }
    if (p == "texto") translate([xPos, yPos, altura_fixa]) 
        linear_extrude(height = 1) 
            offset(delta = 0.01) text(nome_pet, size = fontSize, font = fonte, halign = "center", valign = "center");
}

// --- REBORDO (opcional) ---
rebordo = false;
rebordo_largura = 1.2;
rebordo_altura = 1;
module rebordo_corpo_2d() { corpo_2d(); }
module rebordo_furo_2d() { translate([0, 15]) circle(r = 2.5, $fn = 72); }
module _rebordo() if (rebordo)
    translate([0, 0, altura_fixa]) linear_extrude(height = rebordo_altura)
        difference() { rebordo_corpo_2d(); offset(delta = -rebordo_largura) rebordo_corpo_2d(); rebordo_furo_2d(); }

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
$tpl$ AS tpl) t
WHERE d.id = 'tag-hexagono' AND md5(t.tpl) = '919a541405081ed95cac3a63f6c7d34f'
  AND NOT EXISTS (SELECT 1 FROM prod_designs WHERE id = 'tag-escudo');

-- 3.
UPDATE prod_designs SET generation_schema =
  jsonb_set(generation_schema, '{parameters,fonte,ui,options}', '["Open Sans", "Aladin", "Amarante", "Anton", "Baloo 2", "Benne", "Chewy", "Gloria Hallelujah", "Lobster", "Luckiest Guy", "Oswald", "Pacifico", "Press Start 2P", "Racing Sans One", "Sigmar One"]'::jsonb)
WHERE id IN ('360e9918-4890-435f-888e-bba65bc8d764', 'copo_dentes');

UPDATE prod_designs SET
  scad_template = replace(replace(scad_template, E'\r\n', E'\n'), '            text(', '            offset(delta = 0.01) text('),
  generation_schema = jsonb_set(generation_schema, '{parameters,fonte,ui,options}', '["Open Sans", "Aladin", "Amarante", "Anton", "Baloo 2", "Benne", "Chewy", "Gloria Hallelujah", "Lobster", "Luckiest Guy", "Oswald", "Pacifico", "Press Start 2P", "Racing Sans One", "Sigmar One"]'::jsonb)
WHERE id = 'etiqueta_cabide'
  AND md5(replace(replace(scad_template, E'\r\n', E'\n'), '            text(', '            offset(delta = 0.01) text(')) = 'c6aa6b79b4db2c67b7c9fd281b45730c';

-- Confirmar
SELECT id, estado, md5(scad_template) AS md5_tpl, jsonb_array_length(generation_schema->'parameters'->'fonte'->'ui'->'options') AS n_fontes
FROM prod_designs
WHERE id IN ('tag-coracao','tag-hexagono','tag-osso','tag-pata','tag-redonda','tag-estrela','tag-gato','tag-escudo',
             '360e9918-4890-435f-888e-bba65bc8d764','copo_dentes','etiqueta_cabide')
ORDER BY id;
