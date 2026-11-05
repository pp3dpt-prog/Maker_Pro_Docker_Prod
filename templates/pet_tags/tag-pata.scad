altura_fixa = 3;

// Elipse como no editor: scale([rx, ry]) circle(1), rodada e colocada em (cx, cy).
// $fn fixo: com os valores por omissão do OpenSCAD um circle(r = 1) sai um pentágono.
module elipse(cx, cy, rx, ry, rot = 0) {
    translate([cx, cy]) rotate(rot) scale([rx, ry]) circle(r = 1, $fn = 72);
}

// Almofada + 4 dedos encostados a ela; o fecho (offset +0,8 / −0,8) suaviza a
// ligação dedo-almofada sem tapar os entalhes entre os dedos.
module pata_2d() {
    offset(r = -0.8) offset(r = 0.8) union() {
        elipse(0, -6, 13, 10);
        elipse(-5.6, 8, 4.3, 5.6, 8);
        elipse(5.6, 8, 4.3, 5.6, -8);
        elipse(-13.2, 2.5, 4, 5.2, 32);
        elipse(13.2, 2.5, 4, 5.2, -32);
        translate([-2.5, 5]) square([5, 10.5]);   // tapa a fenda entre os dedos do meio, sob a argola
    }
}

module geometria_pata() {
    linear_extrude(height = altura_fixa) difference() {
        union() {
            pata_2d();
            translate([0, 15.5]) circle(r = 5, $fn = 72);          // argola
        }
        translate([0, 15.5]) circle(r = 2.6, $fn = 72);            // furo da argola
    }
}

module _peca(p) {
    if (p == "base") difference() {
        geometria_pata();
        // VERSO: telefone gravado
        translate([xPosN, yPosN, -0.1])
            mirror([1, 0, 0])
            linear_extrude(height = 1.1)
                text(telefone, size = fontSizeN, font = fonte, halign = "center", valign = "center");
    }
    // FRENTE: nome em relevo (na almofada)
    if (p == "texto") translate([xPos, yPos, altura_fixa])
        linear_extrude(height = 1)
            text(nome_pet, size = fontSize, font = fonte, halign = "center", valign = "center");
}

// --- REBORDO (opcional) ---
rebordo = false;
rebordo_largura = 1.2;
rebordo_altura = 1;
module rebordo_corpo_2d() { pata_2d(); }
module rebordo_furo_2d() { translate([0, 15.5]) circle(r = 2.6, $fn = 72); }
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
