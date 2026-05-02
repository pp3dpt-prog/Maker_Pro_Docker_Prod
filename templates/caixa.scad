// models/caixa.scad
// Modelo básico de caixa paramétrica
// Versão inicial — serve para desbloquear o pipeline STL

// Parâmetros esperados (injetados pelo backend):
// largura
// comprimento
// altura
// espessura
// espessura_fundo
// tem_tampa (0 ou 1)

module render() {

    // Corpo exterior
    difference() {

        // Caixa exterior
        cube([largura, comprimento, altura], center = false);

        // Cavidade interior
        translate([espessura, espessura, espessura_fundo])
            cube([
                largura - 2 * espessura,
                comprimento - 2 * espessura,
                altura
            ], center = false);
    }

    // Tampa simples (opcional, só para teste inicial)
    if (tem_tampa == 1) {
        translate([0, 0, altura + 1])
            cube([largura, comprimento, espessura], center = false);
    }
}
