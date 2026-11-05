
// --- QUALIDADE (injetável pelo backend) ---

altura_fixa = 3; 


module base() {
    union() {
        translate([-9, 9, 0]) cylinder(h = altura_fixa, r = 12);
        translate([9, 9, 0]) cylinder(h = altura_fixa, r = 12);
        translate([0, -17, 0]) rotate([0, 0, 45]) cube([25, 25, altura_fixa]);
        translate([0, 22, 0]) difference() {
            cylinder(h = altura_fixa, r = 7);
            translate([0, 0, -1]) cylinder(h = altura_fixa + 2, r = 3.5);
        }
    }
}

module _peca(p) {
    if (p == "base") difference() {
        base();
        // Verso (Telefone) - Usa as variáveis do server.js
        translate([xPosN, yPosN, -0.1]) mirror([1,0,0]) linear_extrude(1.1)
            offset(delta = 0.01) text(telefone, size = fontSizeN, font = fonte, halign = "center", valign = "center");
    }
    // Frente (Nome) - Usa as variáveis do server.js
    if (p == "texto") translate([xPos, yPos, altura_fixa]) linear_extrude(1)
        offset(delta = 0.01) text(nome_pet, size = fontSize, font = fonte, halign = "center", valign = "center");
}

// --- REBORDO (opcional) ---
rebordo = false;
rebordo_largura = 1.2;
rebordo_altura = 1;
module rebordo_corpo_2d() {
    union() {
        translate([-9, 9]) circle(r = 12);
        translate([9, 9]) circle(r = 12);
        translate([0, -17]) rotate(45) square([25, 25]);
    }
}
module rebordo_furo_2d() { translate([0, 22]) circle(r = 3.5); }
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
