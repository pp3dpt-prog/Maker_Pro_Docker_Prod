

// --- QUALIDADE (injetável pelo backend) ---

altura_fixa = 3; 
raio_medalha = 15; // Diâmetro de 30mm

module geometria_circulo() {
    union() {
        // Corpo Principal
        cylinder(h = altura_fixa, r = raio_medalha);
        
        // Argola de fixação
        translate([0, raio_medalha + 3, 0]) 
            difference() {
                cylinder(h = altura_fixa, r = 6);
                translate([0, 0, -1]) cylinder(h = altura_fixa + 2, r = 3);
            }
    }
}

module _peca(p) {
    if (p == "base") difference() {
        geometria_circulo();
        // VERSO: Telefone (Escavado)
        translate([xPosN, yPosN, -0.1]) 
            mirror([1,0,0])
            linear_extrude(height = 1.1) 
                text(telefone, size = fontSizeN, font = fonte, halign = "center", valign = "center");
    }
    // FRENTE: Nome (Relevo)
    if (p == "texto") translate([xPos, yPos, altura_fixa]) 
        linear_extrude(height = 1) 
            text(nome_pet, size = fontSize, font = str(fonte, ":style=Bold"), halign = "center", valign = "center");
}

// --- REBORDO (opcional) ---
rebordo = false;
rebordo_largura = 1.2;
rebordo_altura = 1;
module rebordo_corpo_2d() { circle(r = raio_medalha); }
module rebordo_furo_2d() { translate([0, raio_medalha + 3]) circle(r = 3); }
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
