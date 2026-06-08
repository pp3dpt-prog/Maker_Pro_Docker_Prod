-- ============================================================================
-- Novo produto: "Letra Inicial Caixa de Luz"
-- Família letras-decorativas (gera corpo + tampa(nome) + tampa traseira).
-- A inicial é uma CAIXA DE LUZ: casca oca com frente difusora e traseira aberta
-- para fita LED, fechada por uma TAMPA TRASEIRA com LÁBIO de encaixe.
-- O nome encaixa num REVESTIMENTO (socket com a forma do nome) na frente,
-- para ser colado. Furo do cabo opcional (traseira ou lateral).
--
-- Requer a alteração do backend (download.js) que gera a 3ª peça quando
-- tem_traseira = true. Executar no SQL editor do Supabase.
-- NOTA: se a linha já existir, usar antes update_letras_caixa_luz_template.sql.
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
  'Letra inicial em caixa de luz: casca oca com frente difusora e traseira aberta para fita LED, fechada por uma tampa traseira com encaixe. O nome encaixa num revestimento na frente, para colar. Furo do cabo opcional (traseira ou lateral). Vários STL para imprimir em cores diferentes.',
  'letras-decorativas',
  $scad$
// Caixa de Luz — letra inicial (casca oca) + revestimento p/ nome + tampa traseira.
// Parâmetros injectados pelo backend:
// letra, fonte_inicial, nome, fonte_nome, altura, espessura_inicial,
// espessura_nome, posicao_nome, tamanho_nome, sobreposicao,
// espessura_frente, parede_luz, borda_nome,
// espessura_traseira, encaixe_traseira, furo_pos, furo_cabo, furo_altura, modo
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

// Derivados (não injectados)
frente   = min(espessura_frente, espessura_inicial - 0.6);
folga    = 0.35;                  // folga de encaixe (FDM)
// material sólido atrás do nome (recesso + ~1.2mm de fundo), sem passar a traseira
reforco  = min(sobreposicao + 1.2, espessura_inicial - 0.6);

module letra_2d() {
    text(letra, size = altura, font = fonte_inicial_real,
         halign = "center", valign = "center");
}

module silhueta_nome() {
    text(nome, size = tamanho_nome, font = fonte_nome_real,
         halign = "center", valign = "center", spacing = 0.85);
}

module nome_2d() { translate([0, posicao_nome]) silhueta_nome(); }

// Casca oca: frente difusora no topo (z = espessura_inicial), traseira aberta (z = 0).
module casca() {
    difference() {
        linear_extrude(height = espessura_inicial) letra_2d();
        translate([0, 0, -0.01])
            linear_extrude(height = espessura_inicial - frente + 0.01)
                offset(r = -parede_luz) letra_2d();
    }
}

// Área (2D) do socket do nome, limitada à letra: nome + borda.
module nome_socket_2d() {
    intersection() { offset(r = borda_nome) nome_2d(); letra_2d(); }
}

module corpo_luz() {
    difference() {
        union() {
            casca();
            // reforço sólido por dentro, atrás do nome, para o recesso ter fundo
            // e não furar a cavidade (o nome entra PARA DENTRO da frente).
            translate([0, 0, espessura_inicial - reforco])
                linear_extrude(height = reforco + 0.01)
                    nome_socket_2d();
        }
        // recesso do nome na frente: o nome encaixa cá dentro e cola-se
        translate([0, 0, espessura_inicial - sobreposicao])
            linear_extrude(height = sobreposicao + 1)
                offset(r = folga) nome_2d();
        // furo do cabo lateral: entra pela base e abre na cavidade
        if (furo_pos == "Lateral" && furo_cabo > 0) {
            translate([0, -altura * 0.55, (espessura_inicial - frente) / 2])
                rotate([-90, 0, 0])
                    cylinder(h = altura * 0.65, r = furo_cabo / 2, $fn = 32);
        }
    }
}

// Nome decorativo (peça separada, ao centro) para encaixar/colar no revestimento.
module tampa_caixa() {
    linear_extrude(height = espessura_nome, center = false)
        silhueta_nome();
}

// Tampa traseira: placa com a forma da letra + lábio que encaixa na cavidade.
module traseira_caixa() {
    difference() {
        union() {
            linear_extrude(height = espessura_traseira) letra_2d();
            translate([0, 0, espessura_traseira - 0.01])
                linear_extrude(height = encaixe_traseira)
                    offset(r = -(parede_luz + folga)) letra_2d();
        }
        // furo do cabo traseiro
        if (furo_pos == "Traseira" && furo_cabo > 0) {
            translate([0, furo_altura, -0.5])
                cylinder(h = espessura_traseira + encaixe_traseira + 1,
                         r = furo_cabo / 2, $fn = 32);
        }
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
    translate([0, posicao_nome, espessura_inicial - sobreposicao])
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
        "min": 12, "max": 40, "unit": "mm", "order": 7, "default": 20
      },
      "espessura_frente": {
        "ui": { "label": "Espessura da frente (difusor)", "widget": "slider", "step": 0.2 },
        "min": 1, "max": 4, "unit": "mm", "order": 8, "default": 2
      },
      "parede_luz": {
        "ui": { "label": "Espessura das paredes", "widget": "slider", "step": 0.2 },
        "min": 1, "max": 4, "unit": "mm", "order": 9, "default": 2
      },
      "tem_traseira": {
        "ui": { "label": "Gerar tampa traseira (fechar a caixa)", "widget": "checkbox" },
        "order": 10, "default": true
      },
      "espessura_traseira": {
        "ui": { "label": "Espessura da tampa traseira", "widget": "slider", "step": 0.2 },
        "min": 1, "max": 4, "unit": "mm", "order": 11, "default": 2
      },
      "encaixe_traseira": {
        "ui": { "label": "Profundidade do encaixe da tampa", "widget": "slider", "step": 0.5 },
        "min": 1, "max": 8, "unit": "mm", "order": 12, "default": 4
      },
      "furo_pos": {
        "ui": { "label": "Furo para o cabo", "widget": "select",
                "options": ["Nenhum","Traseira","Lateral"] },
        "order": 13, "default": "Traseira"
      },
      "furo_cabo": {
        "ui": { "label": "Diâmetro do furo do cabo", "widget": "slider", "step": 0.5 },
        "min": 2, "max": 12, "unit": "mm", "order": 14, "default": 6
      },
      "furo_altura": {
        "ui": { "label": "Posição do furo (vertical)", "widget": "slider", "step": 5 },
        "min": -120, "max": 120, "unit": "mm", "order": 15, "default": -40
      },
      "sobreposicao": {
        "ui": { "label": "Encaixe do nome (profundidade)", "widget": "slider", "step": 0.5 },
        "min": 1, "max": 8, "unit": "mm", "order": 16, "default": 4
      },
      "borda_nome": {
        "ui": { "label": "Borda do revestimento do nome", "widget": "slider", "step": 0.2 },
        "min": 0.8, "max": 4, "unit": "mm", "order": 17, "default": 1.5
      },
      "espessura_nome": {
        "ui": { "label": "Espessura do nome", "widget": "slider" },
        "min": 2, "max": 15, "unit": "mm", "order": 18, "default": 4
      },
      "posicao_nome": {
        "ui": { "label": "Posição vertical do nome", "widget": "slider" },
        "min": -100, "max": 100, "unit": "mm", "order": 19, "default": 0
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
