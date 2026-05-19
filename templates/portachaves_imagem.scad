// ── PORTACHAVES COM IMAGEM PERSONALIZADA ──
// Todas as variáveis são injetadas pelo backend — não redefinir aqui

r_canto  = 5;
r_furo   = 2.5;
margem_x = 3;
margem_y = 3;

// Área útil para a imagem (reserva 9mm no topo para o furo + margem)
area_w = largura - 2 * margem_x;
area_h = altura - margem_y - 9;

scale_x = area_w / image_w;
scale_y = area_h / image_h;
scale_z = relevo / 255;

// Base do portachaves com cantos arredondados
module base_keychain() {
    difference() {
        hull() {
            for (x = [r_canto, largura - r_canto])
                for (y = [r_canto, altura - r_canto])
                    translate([x, y, 0]) cylinder(h = espessura, r = r_canto);
        }
        // Furo para argola no topo, centrado
        translate([largura / 2, altura - r_furo - 3, -1])
            cylinder(h = espessura + 2, r = r_furo);
    }
}

base_keychain();

// Imagem em relevo na face superior
if (image_path != "") {
    translate([margem_x, margem_y, espessura])
    scale([scale_x, scale_y, scale_z])
    surface(file = image_path, center = false, invert = false);
}
