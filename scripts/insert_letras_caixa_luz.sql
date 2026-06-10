-- ============================================================================
-- Produto: "Letra Inicial Caixa de Luz" (estilo moldura / name lightbox)
-- Família letras-decorativas (gera corpo + tampa(nome) + tampa traseira).
-- A inicial é uma caixa de luz com MOLDURA à volta (offset da letra, cantos
-- redondos): frente difusora no topo, paredes no perímetro para colar a FITA
-- LED por dentro, traseira aberta fechada por uma TAMPA TRASEIRA com encaixe.
-- O nome encaixa um pouco para dentro (registo) e fica saliente o resto.
-- Furo do cabo opcional (traseira ou lateral).
--
-- Requer o backend (download.js) que gera a 3ª peça quando tem_traseira=true.
-- Se a linha já existir, usar update_letras_caixa_luz_template.sql.
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
  'Letra inicial em caixa de luz com moldura: frente difusora, paredes no perímetro para a fita LED, traseira fechada por tampa com encaixe. Nome encaixado um pouco e saliente o resto. Furo do cabo opcional. Vários STL para cores diferentes.',
  'letras-decorativas',
  $scad$
// Caixa de Luz (estilo moldura) — letra + moldura, frente difusora, paredes
// para fita LED, nome com encaixe+saliente, tampa traseira com encaixe.
// Parâmetros injectados pelo backend:
// letra, fonte_inicial, nome, fonte_nome, altura, tamanho_nome, posicao_nome,
// espessura_inicial(=profundidade da caixa), espessura_frente, parede_luz,
// borda_moldura, sobreposicao(=encaixe do nome), espessura_nome, borda_nome,
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
folga    = 0.35;
reforco  = min(sobreposicao + 1.2, espessura_inicial - 0.6);

module letra_2d() {
    text(letra, size = altura, font = fonte_inicial_real,
         halign = "center", valign = "center");
}

// Moldura = letra alargada (offset com cantos redondos) → área para a fita LED
// e aspeto de placa. borda_moldura = 0 → segue o contorno da letra.
module moldura_2d() { offset(r = borda_moldura) letra_2d(); }

module silhueta_nome() {
    text(nome, size = tamanho_nome, font = fonte_nome_real,
         halign = "center", valign = "center", spacing = 0.85);
}

module nome_2d() { translate([0, posicao_nome]) silhueta_nome(); }

// Casca: frente difusora no topo (z=espessura_inicial), paredes no perímetro
// da moldura, cavidade oca (fita LED cola na parede interior), traseira aberta.
module casca() {
    difference() {
        linear_extrude(height = espessura_inicial) moldura_2d();
        translate([0, 0, -0.01])
            linear_extrude(height = espessura_inicial - frente + 0.01)
                offset(r = -parede_luz) moldura_2d();
    }
}

// Socket do nome, limitado à moldura.
module nome_socket_2d() {
    intersection() { offset(r = borda_nome) nome_2d(); moldura_2d(); }
}

module corpo_luz() {
    difference() {
        union() {
            casca();
            // reforço sólido atrás do nome (para o encaixe ter fundo)
            translate([0, 0, espessura_inicial - reforco])
                linear_extrude(height = reforco + 0.01)
                    nome_socket_2d();
        }
        // encaixe do nome na frente (o nome entra um pouco aqui)
        translate([0, 0, espessura_inicial - sobreposicao])
            linear_extrude(height = sobreposicao + 1)
                offset(r = folga) nome_2d();
        // furo do cabo lateral
        if (furo_pos == "Lateral" && furo_cabo > 0) {
            translate([0, -altura * 0.55, (espessura_inicial - frente) / 2])
                rotate([-90, 0, 0])
                    cylinder(h = altura * 0.65, r = furo_cabo / 2, $fn = 32);
        }
    }
}

// Nome (peça separada): encaixa 'sobreposicao' no socket e fica saliente o resto.
module tampa_caixa() {
    linear_extrude(height = espessura_nome, center = false)
        silhueta_nome();
}

// Tampa traseira: placa com a forma da moldura + lábio que encaixa na cavidade.
module traseira_caixa() {
    difference() {
        union() {
            linear_extrude(height = espessura_traseira) moldura_2d();
            translate([0, 0, espessura_traseira - 0.01])
                linear_extrude(height = encaixe_traseira)
                    offset(r = -(parede_luz + folga)) moldura_2d();
        }
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
        "order": 1, "default": "A"
      },
      "fonte_inicial": {
        "ui": { "label": "Estilo da letra", "widget": "select",
                "options": ["Moderno","Clássico","Arredondado"] },
        "order": 2, "default": "Moderno"
      },
      "nome": {
        "ui": { "label": "Nome", "widget": "text", "placeholder": "Escreve o nome aqui" },
        "order": 3, "default": "Athreya"
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
        "min": 15, "max": 120, "unit": "mm", "order": 6, "default": 60
      },
      "borda_moldura": {
        "ui": { "label": "Largura da moldura à volta", "widget": "slider", "step": 0.5 },
        "min": 0, "max": 25, "unit": "mm", "order": 7, "default": 8
      },
      "espessura_inicial": {
        "ui": { "label": "Profundidade da caixa (paredes p/ fita LED)", "widget": "slider" },
        "min": 8, "max": 40, "unit": "mm", "order": 8, "default": 14
      },
      "espessura_frente": {
        "ui": { "label": "Espessura da frente (difusor)", "widget": "slider", "step": 0.2 },
        "min": 1, "max": 4, "unit": "mm", "order": 9, "default": 2
      },
      "parede_luz": {
        "ui": { "label": "Espessura das paredes", "widget": "slider", "step": 0.2 },
        "min": 1.5, "max": 5, "unit": "mm", "order": 10, "default": 2.4
      },
      "tem_traseira": {
        "ui": { "label": "Gerar tampa traseira (fechar a caixa)", "widget": "checkbox" },
        "order": 11, "default": true
      },
      "espessura_traseira": {
        "ui": { "label": "Espessura da tampa traseira", "widget": "slider", "step": 0.2 },
        "min": 1, "max": 4, "unit": "mm", "order": 12, "default": 2
      },
      "encaixe_traseira": {
        "ui": { "label": "Profundidade do encaixe da tampa", "widget": "slider", "step": 0.5 },
        "min": 1, "max": 8, "unit": "mm", "order": 13, "default": 4
      },
      "furo_pos": {
        "ui": { "label": "Furo para o cabo", "widget": "select",
                "options": ["Nenhum","Traseira","Lateral"] },
        "order": 14, "default": "Traseira"
      },
      "furo_cabo": {
        "ui": { "label": "Diâmetro do furo do cabo", "widget": "slider", "step": 0.5 },
        "min": 2, "max": 12, "unit": "mm", "order": 15, "default": 6
      },
      "furo_altura": {
        "ui": { "label": "Posição do furo (vertical)", "widget": "slider", "step": 5 },
        "min": -140, "max": 140, "unit": "mm", "order": 16, "default": -50
      },
      "sobreposicao": {
        "ui": { "label": "Encaixe do nome para dentro", "widget": "slider", "step": 0.5 },
        "min": 0, "max": 8, "unit": "mm", "order": 17, "default": 2.5
      },
      "espessura_nome": {
        "ui": { "label": "Espessura do nome (saliente)", "widget": "slider", "step": 0.5 },
        "min": 4, "max": 25, "unit": "mm", "order": 18, "default": 10
      },
      "borda_nome": {
        "ui": { "label": "Borda do encaixe do nome", "widget": "slider", "step": 0.2 },
        "min": 0.4, "max": 4, "unit": "mm", "order": 19, "default": 1.2
      },
      "posicao_nome": {
        "ui": { "label": "Posição vertical do nome", "widget": "slider" },
        "min": -120, "max": 120, "unit": "mm", "order": 20, "default": 0
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
