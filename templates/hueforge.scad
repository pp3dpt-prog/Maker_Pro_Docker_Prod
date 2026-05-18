// ── HUEFORGE — IMPRESSÃO MULTI-COR COM IMAGEM ──
// Parâmetros injetados pelo backend
image_path     = is_undef(image_path)     ? ""    : image_path;
image_w        = is_undef(image_w)        ? 100   : image_w;
image_h        = is_undef(image_h)        ? 100   : image_h;
largura_mm     = is_undef(largura_mm)     ? 100   : largura_mm;
altura_mm      = is_undef(altura_mm)      ? 100   : altura_mm;
espessura_base = is_undef(espessura_base) ? 1.0   : espessura_base;
altura_relevo  = is_undef(altura_relevo)  ? 2.0   : altura_relevo;
// num_cores e layer_height usados apenas para o TXT, não para a geometria

scale_x = largura_mm / image_w;
scale_y = altura_mm  / image_h;
// O relevo vai de 0 (pixel=0, preto) até altura_relevo mm (pixel=255, branco)
scale_z = altura_relevo / 255;

union() {
    // Placa base sólida (dá suporte e garante a primeira cor)
    cube([largura_mm, altura_mm, espessura_base]);

    // Relevo da imagem quantizada por cima da base
    if (image_path != "") {
        translate([0, 0, espessura_base])
        scale([scale_x, scale_y, scale_z])
        surface(file = image_path, center = false, invert = false);
    }
}
