-- Pet tags novas, em RASCUNHO (2026-11-06): peixe, nuvem, coroa, casinha e barril.
-- Copiadas da tag-hexagono (schema com 15 fontes, cores, multicor, rebordo, preços, plano),
-- com template próprio (templates/pet_tags/) e a posição inicial do nome e do telefone
-- ajustada à forma. Só entram se o template tiver o MD5 testado com o OpenSCAD 2021.01.
-- Falta: miniatura (Admin → Miniaturas) e estado = 'ativo'.
BEGIN;
INSERT INTO prod_designs
SELECT (jsonb_populate_record(NULL::prod_designs, to_jsonb(d) || jsonb_build_object(
  'id', 'tag-peixe', 'nome', 'Peixe', 'estado', 'rascunho',
  'scad_template', t.tpl,
  'generation_schema', jsonb_set(jsonb_set(jsonb_set(jsonb_set(d.generation_schema,
      '{parameters,xPos,default}', '-3'), '{parameters,yPos,default}', '0'),
      '{parameters,xPosN,default}', '-3'), '{parameters,yPosN,default}', '0'),
  'stl_file_path', '/models/blank_peixe.stl', 'base_template_id', NULL,
  'thumbnail_url', NULL, 'image_url', NULL, 'descricao', NULL,
  'likes', 0, 'total_likes', 0, 'downloads', 0, 'total_downloads', 0, 'criado_em', now()
))).*
FROM prod_designs d, (SELECT $tpl$altura_fixa = 3;

// Peixe: corpo em elipse + cauda; fecho de 1 mm na ligação e pontas arredondadas (1,5 mm).
module corpo_2d() {
    offset(r = 1.5, $fn = 48) offset(delta = -1.5)
    offset(r = -1, $fn = 48) offset(r = 1, $fn = 48) union() {
        translate([-3, 0]) scale([15, 10]) circle(r = 1, $fn = 72);
        polygon([[9, 0], [19, 9], [16, 0], [19, -9]]);
    }
}

module geometria_peixe() {
    linear_extrude(height = altura_fixa) difference() {
        union() {
            corpo_2d();
            translate([-3, 12.5]) circle(r = 4.5, $fn = 72);   // argola
        }
        translate([-3, 12.5]) circle(r = 2.4, $fn = 72);       // furo da argola
    }
}

module _peca(p) {
    if (p == "base") difference() {
        geometria_peixe();
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
module rebordo_furo_2d() { translate([-3, 12.5]) circle(r = 2.4, $fn = 72); }
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
WHERE d.id = 'tag-hexagono' AND md5(t.tpl) = 'ffdb2750c3b88ef9209c89aae9b87f65'
  AND NOT EXISTS (SELECT 1 FROM prod_designs WHERE id = 'tag-peixe');
INSERT INTO prod_designs
SELECT (jsonb_populate_record(NULL::prod_designs, to_jsonb(d) || jsonb_build_object(
  'id', 'tag-nuvem', 'nome', 'Nuvem', 'estado', 'rascunho',
  'scad_template', t.tpl,
  'generation_schema', jsonb_set(jsonb_set(jsonb_set(jsonb_set(d.generation_schema,
      '{parameters,xPos,default}', '0'), '{parameters,yPos,default}', '-1'),
      '{parameters,xPosN,default}', '0'), '{parameters,yPosN,default}', '-1'),
  'stl_file_path', '/models/blank_nuvem.stl', 'base_template_id', NULL,
  'thumbnail_url', NULL, 'image_url', NULL, 'descricao', NULL,
  'likes', 0, 'total_likes', 0, 'downloads', 0, 'total_downloads', 0, 'criado_em', now()
))).*
FROM prod_designs d, (SELECT $tpl$altura_fixa = 3;

// Nuvem: 5 círculos + base direita; o fecho (1,5 mm) arredonda os encontros entre círculos.
module corpo_2d() {
    offset(r = -1.5, $fn = 48) offset(r = 1.5, $fn = 48) union() {
        translate([0, 3]) circle(r = 9, $fn = 72);
        translate([-10, -2]) circle(r = 7, $fn = 72);
        translate([10, -2]) circle(r = 7, $fn = 72);
        translate([-16, -5]) circle(r = 4.5, $fn = 72);
        translate([16, -5]) circle(r = 4.5, $fn = 72);
        polygon([[-16, -9.5], [16, -9.5], [16, -5], [-16, -5]]);
    }
}

module geometria_nuvem() {
    linear_extrude(height = altura_fixa) difference() {
        union() {
            corpo_2d();
            translate([0, 14]) circle(r = 4.5, $fn = 72);   // argola
        }
        translate([0, 14]) circle(r = 2.4, $fn = 72);       // furo da argola
    }
}

module _peca(p) {
    if (p == "base") difference() {
        geometria_nuvem();
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
module rebordo_furo_2d() { translate([0, 14]) circle(r = 2.4, $fn = 72); }
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
WHERE d.id = 'tag-hexagono' AND md5(t.tpl) = '054e35392efd24b507a6f7f4b67c5c4e'
  AND NOT EXISTS (SELECT 1 FROM prod_designs WHERE id = 'tag-nuvem');
INSERT INTO prod_designs
SELECT (jsonb_populate_record(NULL::prod_designs, to_jsonb(d) || jsonb_build_object(
  'id', 'tag-coroa', 'nome', 'Coroa', 'estado', 'rascunho',
  'scad_template', t.tpl,
  'generation_schema', jsonb_set(jsonb_set(jsonb_set(jsonb_set(d.generation_schema,
      '{parameters,xPos,default}', '0'), '{parameters,yPos,default}', '-4.5'),
      '{parameters,xPosN,default}', '0'), '{parameters,yPosN,default}', '-4.5'),
  'stl_file_path', '/models/blank_coroa.stl', 'base_template_id', NULL,
  'thumbnail_url', NULL, 'image_url', NULL, 'descricao', NULL,
  'likes', 0, 'total_likes', 0, 'downloads', 0, 'total_downloads', 0, 'criado_em', now()
))).*
FROM prod_designs d, (SELECT $tpl$altura_fixa = 3;

// Coroa: base com 3 pontas e uma bola em cada ponta (a do meio segura a argola); o fecho
// (1 mm) junta as bolas às pontas e o arredondamento (1,5 mm) suaviza os cantos.
module corpo_2d() {
    offset(r = 1.5, $fn = 48) offset(delta = -1.5)
    offset(r = -1, $fn = 48) offset(r = 1, $fn = 48) union() {
        polygon([[-15, -10], [15, -10], [15, 8], [8, 0], [0, 9], [-8, 0], [-15, 8]]);
        translate([-13.5, 8]) circle(r = 2.8, $fn = 72);
        translate([13.5, 8]) circle(r = 2.8, $fn = 72);
        translate([0, 9]) circle(r = 4, $fn = 72);
    }
}

module geometria_coroa() {
    linear_extrude(height = altura_fixa) difference() {
        union() {
            corpo_2d();
            translate([0, 14]) circle(r = 4.5, $fn = 72);   // argola
        }
        translate([0, 14]) circle(r = 2.4, $fn = 72);       // furo da argola
    }
}

module _peca(p) {
    if (p == "base") difference() {
        geometria_coroa();
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
module rebordo_furo_2d() { translate([0, 14]) circle(r = 2.4, $fn = 72); }
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
WHERE d.id = 'tag-hexagono' AND md5(t.tpl) = '33516b7990242f335ec9035ad25f9f0a'
  AND NOT EXISTS (SELECT 1 FROM prod_designs WHERE id = 'tag-coroa');
INSERT INTO prod_designs
SELECT (jsonb_populate_record(NULL::prod_designs, to_jsonb(d) || jsonb_build_object(
  'id', 'tag-casinha', 'nome', 'Casinha', 'estado', 'rascunho',
  'scad_template', t.tpl,
  'generation_schema', jsonb_set(jsonb_set(jsonb_set(jsonb_set(d.generation_schema,
      '{parameters,xPos,default}', '0'), '{parameters,yPos,default}', '-5.5'),
      '{parameters,xPosN,default}', '0'), '{parameters,yPosN,default}', '-5.5'),
  'stl_file_path', '/models/blank_casinha.stl', 'base_template_id', NULL,
  'thumbnail_url', NULL, 'image_url', NULL, 'descricao', NULL,
  'likes', 0, 'total_likes', 0, 'downloads', 0, 'total_downloads', 0, 'criado_em', now()
))).*
FROM prod_designs d, (SELECT $tpl$altura_fixa = 3;

// Casinha: paredes + telhado; argola no topo do telhado; cantos arredondados (1,5 mm).
module corpo_2d() {
    offset(r = 1.5, $fn = 48) offset(delta = -1.5) union() {
        polygon([[-13, -14], [13, -14], [13, 2], [-13, 2]]);
        polygon([[-17, 1], [17, 1], [0, 16]]);
    }
}

module geometria_casinha() {
    linear_extrude(height = altura_fixa) difference() {
        union() {
            corpo_2d();
            translate([0, 15]) circle(r = 4.5, $fn = 72);   // argola
        }
        translate([0, 15]) circle(r = 2.4, $fn = 72);       // furo da argola
    }
}

module _peca(p) {
    if (p == "base") difference() {
        geometria_casinha();
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
module rebordo_furo_2d() { translate([0, 15]) circle(r = 2.4, $fn = 72); }
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
WHERE d.id = 'tag-hexagono' AND md5(t.tpl) = 'bcdec8e487326c10a716e8981d2eace8'
  AND NOT EXISTS (SELECT 1 FROM prod_designs WHERE id = 'tag-casinha');
INSERT INTO prod_designs
SELECT (jsonb_populate_record(NULL::prod_designs, to_jsonb(d) || jsonb_build_object(
  'id', 'tag-barril', 'nome', 'Barril', 'estado', 'rascunho',
  'scad_template', t.tpl,
  'generation_schema', jsonb_set(jsonb_set(jsonb_set(jsonb_set(d.generation_schema,
      '{parameters,xPos,default}', '0'), '{parameters,yPos,default}', '0'),
      '{parameters,xPosN,default}', '0'), '{parameters,yPosN,default}', '0'),
  'stl_file_path', '/models/blank_barril.stl', 'base_template_id', NULL,
  'thumbnail_url', NULL, 'image_url', NULL, 'descricao', NULL,
  'likes', 0, 'total_likes', 0, 'downloads', 0, 'total_downloads', 0, 'criado_em', now()
))).*
FROM prod_designs d, (SELECT $tpl$altura_fixa = 3;

// Barril: laterais em arco (elipse 13 × 16 mm cortada a ±13 mm), topo e fundo direitos.
module corpo_2d() {
    offset(r = 1.5, $fn = 48) offset(delta = -1.5)
        polygon([for (i = [0:26]) let(y = -13 + i) [13 * sqrt(1 - pow(y / 16, 2)), y], for (i = [0:26]) let(y = 13 - i) [-13 * sqrt(1 - pow(y / 16, 2)), y]]);
}

module geometria_barril() {
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
        geometria_barril();
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
WHERE d.id = 'tag-hexagono' AND md5(t.tpl) = 'c28a30f2ff3b62289f7d61152a4642f2'
  AND NOT EXISTS (SELECT 1 FROM prod_designs WHERE id = 'tag-barril');
COMMIT;

SELECT id, estado, md5(scad_template) AS md5_tpl,
  generation_schema->'parameters'->'xPos'->'default' AS x, generation_schema->'parameters'->'yPos'->'default' AS y
FROM prod_designs WHERE id IN ('tag-peixe', 'tag-nuvem', 'tag-coroa', 'tag-casinha', 'tag-barril') ORDER BY id;
