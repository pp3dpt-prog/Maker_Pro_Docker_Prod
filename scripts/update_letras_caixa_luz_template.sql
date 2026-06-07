-- Atualiza o scad_template do produto letras-caixa-luz (corrige o encaixe do nome).
-- Corre no SQL editor do Supabase.

UPDATE prod_designs SET scad_template = $scad$
// Caixa de Luz — letra inicial (casca oca) + nome decorativo + tampa traseira.
// Parâmetros injectados pelo backend:
// letra, fonte_inicial, nome, fonte_nome, altura, espessura_inicial,
// espessura_nome, sobreposicao, posicao_nome, tamanho_nome,
// espessura_frente, parede_luz, espessura_traseira, furo_cabo, modo
// IMPORTANTE: não redefinir variáveis injectadas (quebra a injecção).

fonte_inicial_real =
  fonte_inicial == "Clássico"    ? "Liberation Serif:style=Bold" :
  fonte_inicial == "Arredondado" ? "Ubuntu:style=Bold" :
  "Liberation Sans:style=Bold";

fonte_nome_real =
  fonte_nome == "Pacifico"          ? "Pacifico" :
  fonte_nome == "Gloria Hallelujah" ? "Gloria Hallelujah" :
  fonte_nome == "Chewy"             ? "Chewy" :
  "Lobster";

// Frente nunca maior que a profundidade. O recesso do nome pode atravessar a
// frente fina e entrar na cavidade, para o nome encaixar de facto na inicial.
frente  = min(espessura_frente, espessura_inicial - 0.6);
recesso = max(0, min(sobreposicao, espessura_inicial - 0.6));

module letra_2d() {
    text(letra, size = altura, font = fonte_inicial_real,
         halign = "center", valign = "center");
}

module silhueta_nome() {
    text(nome, size = tamanho_nome, font = fonte_nome_real,
         halign = "center", valign = "center", spacing = 0.85);
}

// Letra inicial como caixa de luz:
//  - frente difusora (espessura 'frente') no topo  → z = espessura_inicial
//  - cavidade oca com paredes 'parede_luz'
//  - traseira aberta (z = 0) para a fita LED
//  - recesso do nome na frente, para encaixe do nome decorativo
module corpo_luz() {
    difference() {
        difference() {
            linear_extrude(height = espessura_inicial) letra_2d();
            // cavidade: aberta no fundo, deixa 'frente' de espessura no topo
            translate([0, 0, -0.01])
                linear_extrude(height = espessura_inicial - frente + 0.01)
                    offset(r = -parede_luz) letra_2d();
        }
        // recesso do nome na frente (topo)
        translate([0, posicao_nome, espessura_inicial - recesso])
            linear_extrude(height = recesso + 1)
                silhueta_nome();
    }
}

module tampa_caixa() {
    linear_extrude(height = espessura_nome, center = false)
        silhueta_nome();
}

// Tampa traseira: placa com a forma da letra que fecha a caixa por trás,
// com furo opcional para o cabo da fita LED (furo_cabo = 0 → sem furo).
module traseira_caixa() {
    difference() {
        linear_extrude(height = espessura_traseira) letra_2d();
        if (furo_cabo > 0)
            translate([0, -altura * 0.30, -0.5])
                cylinder(h = espessura_traseira + 1, r = furo_cabo / 2, $fn = 24);
    }
}

if (modo == "corpo") {
    corpo_luz();
} else if (modo == "tampa") {
    tampa_caixa();
} else if (modo == "traseira") {
    traseira_caixa();
} else {
    corpo_luz();
    translate([0, posicao_nome, espessura_inicial - recesso])
        tampa_caixa();
}
$scad$
WHERE id = 'letras-caixa-luz';
