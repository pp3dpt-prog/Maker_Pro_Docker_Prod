// ── ETIQUETA PARA MOCHILA / SACO DE DESPORTO ──
// Parâmetros injetados pelo backend
nome     = is_undef(nome)     ? "NOME"      : nome;
texto2   = is_undef(texto2)   ? ""          : texto2;
fonte    = is_undef(fonte)    ? "Open Sans" : fonte;
fontSize = is_undef(fontSize) ? 9           : fontSize;

comp    = 85;   // comprimento da etiqueta
larg    = 45;   // largura da etiqueta
alt     = 4;    // espessura
r_canto = 6;    // raio dos cantos arredondados
r_furo  = 4;    // raio do furo para atacador/argola
prof    = 1.2;  // profundidade do texto

// Corpo principal com cantos arredondados
module corpo() {
    hull() {
        for (x = [r_canto, comp - r_canto])
            for (y = [r_canto, larg - r_canto])
                translate([x, y, 0]) cylinder(h=alt, r=r_canto);
    }
}

difference() {
    corpo();

    // Furo para atacador/mosquetão no topo
    translate([comp / 2, larg - r_furo - 4, -1])
        cylinder(h=alt + 2, r=r_furo);

    // Segundo texto gravado no verso (opcional)
    if (texto2 != "") {
        translate([comp / 2, larg / 2 - 6, -0.1])
        rotate([0, 180, 0])
        translate([-comp / 2, -larg / 2 + 6, 0])
        translate([comp / 2, larg / 2 - 6, 0])
        linear_extrude(prof + 0.2)
        text(texto2, size=fontSize - 2, font=fonte, halign="center", valign="center");
    }
}

// Nome em relevo na frente
translate([comp / 2, larg / 2 - (texto2 != "" ? 3 : 0), alt])
linear_extrude(prof)
text(nome, size=fontSize, font=fonte, halign="center", valign="center");
