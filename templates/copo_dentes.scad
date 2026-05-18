// ── COPO PERSONALIZADO PARA DENTES ──
// Parâmetros injetados pelo backend
nome        = is_undef(nome)        ? "NOME"      : nome;
fonte       = is_undef(fonte)       ? "Open Sans" : fonte;
fontSize    = is_undef(fontSize)    ? 14          : fontSize;
diametro    = is_undef(diametro)    ? 72          : diametro;
altura_copo = is_undef(altura_copo) ? 95          : altura_copo;

espessura   = 2.5;
r           = diametro / 2;
altura_rel  = 1.5;   // altura das letras em relevo

// Coloca cada letra rotacionada à volta do cilindro
module texto_cilindrico(str, raio, h_pos, tamanho, fonte) {
    n             = len(str);
    char_width    = tamanho * 0.62;
    angle_per_char = (char_width / raio) * (180 / PI);
    total_angle   = angle_per_char * n;

    for (i = [0 : n - 1]) {
        a = -total_angle / 2 + (i + 0.5) * angle_per_char;
        rotate([0, 0, a])
        translate([raio, 0, h_pos])
        rotate([90, 0, 90])
        linear_extrude(height = altura_rel + 0.1)
        text(str[i], size = tamanho, font = fonte,
             halign = "center", valign = "center");
    }
}

// Corpo do copo (cilindro oco com base reforçada)
difference() {
    union() {
        cylinder(h = altura_copo,        r = r);
        cylinder(h = espessura * 1.5,    r = r); // base reforçada
    }
    translate([0, 0, espessura])
        cylinder(h = altura_copo, r = r - espessura); // interior oco
}

// Texto em relevo a acompanhar a superfície curva
texto_cilindrico(nome, r, altura_copo / 2, fontSize, fonte);
