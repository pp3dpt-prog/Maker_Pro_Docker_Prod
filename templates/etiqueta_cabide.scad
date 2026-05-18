// ── ETIQUETA PARA CABIDE ──
// Parâmetros injetados pelo backend
texto    = is_undef(texto)    ? "TEXTO"     : texto;
fonte    = is_undef(fonte)    ? "Open Sans" : fonte;
fontSize = is_undef(fontSize) ? 10          : fontSize;

larg    = 70;   // largura da etiqueta
alt_tag = 32;   // altura total
esp     = 3;    // espessura
r_canto = 5;    // raio dos cantos
r_furo  = 5.5;  // raio do furo para o gancho do cabide (cabide standard ~5mm)
prof    = 1.2;  // profundidade do texto

// Corpo com cantos arredondados
module corpo() {
    hull() {
        for (x = [r_canto, larg - r_canto])
            for (y = [r_canto, alt_tag - r_canto])
                translate([x, y, 0]) cylinder(h=esp, r=r_canto);
    }
}

difference() {
    corpo();

    // Furo no topo para encaixar no gancho do cabide
    translate([larg / 2, alt_tag - r_furo - 4, -1])
        cylinder(h=esp + 2, r=r_furo);
}

// Texto em relevo (centrado, ligeiramente abaixo do furo)
translate([larg / 2, alt_tag / 2 - 4, esp])
linear_extrude(prof)
text(texto, size=fontSize, font=fonte, halign="center", valign="center");
