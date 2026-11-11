altura_fixa = 3;

// Barril: laterais em arco (elipse 13 × 16 mm cortada a ±13 mm), topo e fundo direitos.
// orientacao = "Deitado": rodado 90° e mais comprido (32 × 26 mm: elipse 19,7 × 13 cortada a
// ±16 mm), com os tampos dos lados. aros (true/false): dois aros em relevo, da cor do rebordo.
function _deitado() = !is_undef(orientacao) && orientacao == "Deitado";
function _aros() = is_undef(aros) ? true : (aros == true || aros == 1 || aros == "true");
module corpo_2d() {
    offset(r = 1.5, $fn = 48) offset(delta = -1.5)
        scale([_deitado() ? 16 / 13 : 1, 1]) rotate(_deitado() ? 90 : 0)
            polygon([for (i = [0:26]) let(y = -13 + i) [13 * sqrt(1 - pow(y / 16, 2)), y], for (i = [0:26]) let(y = 13 - i) [-13 * sqrt(1 - pow(y / 16, 2)), y]]);
}
// aros: faixas de 1,6 mm perto dos tampos, recortadas pelo contorno (0,6 mm para dentro)
module aros_2d() {
    intersection() {
        offset(delta = -0.6) corpo_2d();
        if (_deitado()) for (s = [-1, 1]) translate([s * 13.6 - 0.8, -20]) square([1.6, 40]);
        else for (s = [-1, 1]) translate([-20, s * 9.8 - 0.8]) square([40, 1.6]);
    }
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
module _rebordo() {
    if (rebordo)
        translate([0, 0, altura_fixa]) linear_extrude(height = rebordo_altura)
            difference() { rebordo_corpo_2d(); offset(delta = -rebordo_largura) rebordo_corpo_2d(); rebordo_furo_2d(); }
    if (_aros())   // os aros vão com o rebordo (mesma cor, mesma altura); o nome é recortado por eles
        translate([0, 0, altura_fixa]) linear_extrude(height = rebordo_altura) aros_2d();
}

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
