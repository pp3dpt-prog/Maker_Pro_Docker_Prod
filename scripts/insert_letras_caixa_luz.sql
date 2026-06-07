-- ============================================================================
-- Novo produto: "Letra Inicial Caixa de Luz"
-- Família letras-decorativas (gera corpo + tampa + tampa traseira via OpenSCAD).
-- A inicial é uma CAIXA DE LUZ: casca oca com frente difusora (no topo) e
-- traseira aberta para a fita LED, fechada por uma TAMPA TRASEIRA separada.
-- O nome decorativo encaixa na frente, como nas Letras Decorativas normais.
--
-- Requer a alteração do backend (download.js) que gera a 3ª peça quando
-- tem_traseira = true. Executar no SQL editor do Supabase.
-- ============================================================================

INSERT INTO prod_designs (
  id, nome, descricao, familia,
  scad_template, generation_schema,
  licenca, preco_creditos, preco_base, pvp, credit_price,
  usa_modo, estado, requer_licenca_comercial, disponivel_consumidor,
  default_fonte,
  default_x_nome, default_y_nome, default_size_nome,
  min_x_nome, max_x_nome, min_y_nome, max_y_nome,
  default_x_num, default_y_num, default_size_num,
  min_x_num, max_x_num, min_y_num, max_y_num,
  acesso_maker, thumbnail_url
) VALUES (
  'letras-caixa-luz',
  'Letra Inicial Caixa de Luz',
  'Letra inicial em caixa de luz: casca oca com frente difusora e traseira aberta para fita LED, fechada por uma tampa traseira. Inclui nome decorativo que encaixa na frente. Vários ficheiros STL para imprimir em cores diferentes.',
  'letras-decorativas',
  $scad$
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
$scad$,
  $json${
    "parameters": {
      "letra": {
        "ui": { "label": "Letra inicial", "widget": "select",
                "options": ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"] },
        "order": 1, "default": "H"
      },
      "fonte_inicial": {
        "ui": { "label": "Estilo da letra", "widget": "select",
                "options": ["Moderno","Clássico","Arredondado"] },
        "order": 2, "default": "Moderno"
      },
      "nome": {
        "ui": { "label": "Nome", "widget": "text", "placeholder": "Escreve o nome aqui" },
        "order": 3, "default": "Helena"
      },
      "fonte_nome": {
        "ui": { "label": "Estilo do nome", "widget": "select",
                "options": ["Lobster","Pacifico","Gloria Hallelujah","Chewy"] },
        "order": 4, "default": "Lobster"
      },
      "altura": {
        "ui": { "label": "Tamanho da letra", "widget": "slider" },
        "min": 80, "max": 250, "unit": "mm", "order": 5, "default": 150
      },
      "tamanho_nome": {
        "ui": { "label": "Tamanho do nome", "widget": "slider", "step": 1 },
        "min": 15, "max": 100, "unit": "mm", "order": 6, "default": 57
      },
      "espessura_inicial": {
        "ui": { "label": "Profundidade da caixa de luz", "widget": "slider" },
        "min": 10, "max": 30, "unit": "mm", "order": 7, "default": 18
      },
      "espessura_frente": {
        "ui": { "label": "Espessura da frente (difusor)", "widget": "slider", "step": 0.2 },
        "min": 1, "max": 4, "unit": "mm", "order": 8, "default": 2
      },
      "parede_luz": {
        "ui": { "label": "Espessura das paredes", "widget": "slider", "step": 0.2 },
        "min": 1, "max": 4, "unit": "mm", "order": 9, "default": 1.6
      },
      "tem_traseira": {
        "ui": { "label": "Gerar tampa traseira (fechar a caixa)", "widget": "checkbox" },
        "order": 10, "default": true
      },
      "espessura_traseira": {
        "ui": { "label": "Espessura da tampa traseira", "widget": "slider", "step": 0.2 },
        "min": 1, "max": 4, "unit": "mm", "order": 11, "default": 2
      },
      "furo_cabo": {
        "ui": { "label": "Furo para o cabo (0 = sem furo)", "widget": "slider", "step": 0.5 },
        "min": 0, "max": 12, "unit": "mm", "order": 12, "default": 6
      },
      "espessura_nome": {
        "ui": { "label": "Espessura do nome", "widget": "slider" },
        "min": 5, "max": 15, "unit": "mm", "order": 13, "default": 8
      },
      "sobreposicao": {
        "ui": { "label": "Encaixe do nome (recesso)", "widget": "slider" },
        "min": 0, "max": 15, "unit": "mm", "order": 14, "default": 3
      },
      "posicao_nome": {
        "ui": { "label": "Posição vertical do nome", "widget": "slider" },
        "min": -100, "max": 100, "unit": "mm", "order": 15, "default": 0
      }
    }
  }$json$::jsonb,
  'CC-BY-NC', 1, 0, 0, 0,
  false, 'ativo', false, false,
  'OpenSans',
  0, 0, 7, -20, 20, -15, 15,
  0, 0, 6.5, -20, 20, -15, 15,
  NULL, NULL
);
