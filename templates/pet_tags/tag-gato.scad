altura_fixa = 3;

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
