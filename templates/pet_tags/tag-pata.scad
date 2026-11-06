altura_fixa = 3;

// Elipse: scale([rx, ry]) circle(1), rodada e colocada em (cx, cy). $fn fixo (com os valores
// por omissão do OpenSCAD um circle(r = 1) sai um pentágono).
module elipse(cx, cy, rx, ry, rot = 0) {
    translate([cx, cy]) rotate(rot) scale([rx, ry]) circle(r = 1, $fn = 72);
}

// Os 5 "feijões" da pata, separados entre si: almofada (onde vai o nome) + 4 dedos.
module almofada_2d() { elipse(0, -5.5, 12, 9); }
module dedos_2d() {
    elipse(-5.3, 10, 3.8, 5, 10);
    elipse(5.3, 10, 3.8, 5, -10);
    elipse(-13, 5, 3.3, 4.5, 40);
    elipse(13, 5, 3.3, 4.5, -40);
}
module feijoes_2d() { almofada_2d(); dedos_2d(); }

// Medalha: os feijões alargados 1,6 mm (ficam ligados), o polígono dos centros enche o
// interior e o fecho de 1,2 mm suaviza as ligações, deixando entalhes entre os dedos.
module pata_2d() {
    offset(r = -1.2, $fn = 48) offset(r = 1.2, $fn = 48) union() {
        offset(r = 1.6, $fn = 48) feijoes_2d();
        polygon([[-13, 5], [-5.3, 10], [-2.5, 15], [2.5, 15], [5.3, 10], [13, 5], [0, -5.5]]);   // enche o interior e a ligação à argola
    }
}

module geometria_pata() {
    linear_extrude(height = altura_fixa) difference() {
        union() {
            pata_2d();
            translate([0, 18]) circle(r = 4.5, $fn = 72);          // argola
        }
        translate([0, 18]) circle(r = 2.4, $fn = 72);              // furo da argola
    }
}

module _peca(p) {
    if (p == "base") difference() {
        geometria_pata();
        // VERSO: telefone gravado
        translate([xPosN, yPosN, -0.1])
            mirror([1, 0, 0])
            linear_extrude(height = 1.1)
                offset(delta = 0.01) text(telefone, size = fontSizeN, font = fonte, halign = "center", valign = "center");
    }
    // FRENTE: nome em relevo (na almofada)
    if (p == "texto") translate([xPos, yPos, altura_fixa])
        linear_extrude(height = 1)
            offset(delta = 0.01) text(nome_pet, size = fontSize, font = fonte, halign = "center", valign = "center");
}

// --- REBORDO (opcional) ---
// rebordo_estilo (só na pata):
//   "Contorno em todos"               um anel de rebordo_largura em cada feijão (omissão antiga)
//   "Dedos cheios"                    os 4 dedos cheios, sem nada à volta do nome
//   "Dedos cheios + contorno do nome" dedos cheios + anel de rebordo_largura na almofada
rebordo = false;
rebordo_largura = 1.2;
rebordo_altura = 1;
function _estilo() = is_undef(rebordo_estilo) ? "Contorno em todos" : rebordo_estilo;
module anel_2d() { difference() { children(); offset(delta = -rebordo_largura) children(); } }
module rebordo_2d() {
    if (_estilo() == "Dedos cheios") {
        dedos_2d();
    } else if (_estilo() == "Dedos cheios + contorno do nome") {
        dedos_2d();
        anel_2d() almofada_2d();
    } else {
        anel_2d() feijoes_2d();
    }
}
module _rebordo() if (rebordo)
    translate([0, 0, altura_fixa]) linear_extrude(height = rebordo_altura) rebordo_2d();

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
