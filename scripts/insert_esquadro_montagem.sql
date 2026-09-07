-- ============================================================================
-- Produto: "Esquadro de Montagem" (corner assembly jig / marcenaria)
-- Família marcenaria — primeiro item da Fase 1 (Quick Wins) do roteiro
-- docs/roadmap-familias-produtos.pdf (39 downloads ref., 7 parâmetros).
--
-- Dois braços planos que se encostam a duas peças de madeira, segurando-as no
-- ângulo exacto (90° por defeito, ajustável) enquanto se cola/aparafusa a
-- junta. Furos de fixação para parafuso/grampo em cada braço; reforço
-- diagonal opcional para rigidez; cantos exteriores arredondados (o canto
-- interior, de registo, fica sempre afiado).
--
-- Validado localmente com OpenSCAD (--render, 5 combinações incl. ângulos
-- 45°/90°/135°, com/sem reforço, com/sem furos) — sem avisos.
-- SQL editor do Supabase.
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
  'esquadro-montagem',
  'Esquadro de Montagem',
  'Jig de marcenaria: dois braços planos que se encostam a duas peças de madeira, segurando-as no ângulo exacto (90° por defeito, ajustável) enquanto colas ou aparafusas a junta. Furos para fixar com parafuso ou grampo, reforço diagonal opcional para mais rigidez.',
  'marcenaria',
  $scad$
// Esquadro de Montagem — jig de marcenaria: dois braços planos que se encostam
// a duas peças de madeira formando o ângulo exacto (por defeito 90°), para
// segurar/colar/aparafusar uma junta em esquadria. Furos de fixação para
// parafuso/grampo em cada braço; reforço diagonal opcional para rigidez.
//
// Parâmetros injectados pelo backend (DEPOIS deste texto — ver regra em
// [[testar-templates-openscad]] / memória do projeto): comprimento, largura,
// espessura, angulo, diametro_furo, reforco_diagonal, raio_canto.
// IMPORTANTE: nenhuma variável derivada a nível de topo — usar function();
// e nenhum if/else a nível de topo que dependa de parâmetros injectados.

// Roda um ponto 2D 'a' graus em torno da origem.
function rot(p, a) = [
    p[0] * cos(a) - p[1] * sin(a),
    p[0] * sin(a) + p[1] * cos(a)
];

module braco_2d() {
    square([comprimento, largura]);
}

// Os dois braços partilham o vértice na origem — o ângulo entre as arestas
// interiores (ao longo de y=0) é exactamente 'angulo'. Esta aresta interior
// tem de ficar sempre afiada (não arredondar), por isso o arredondamento só
// aplica aos cantos exteriores (ver forma_arredondada_2d).
module forma_2d() {
    union() {
        braco_2d();
        rotate([0, 0, angulo]) braco_2d();
    }
}

// offset(+r) depois offset(-r) só arredonda cantos convexos (exteriores) —
// o canto interior (côncavo, junto à origem) fica sempre afiado.
module forma_arredondada_2d() {
    offset(r = raio_canto) offset(r = -raio_canto) forma_2d();
}

// Reforço: ponte diagonal entre os dois braços, a meio caminho, para dar
// rigidez à junta contra flexão.
module reforco_2d() {
    p1 = [comprimento * 0.42, largura / 2];
    p2 = rot(p1, angulo);
    hull() {
        translate(p1) circle(d = largura * 0.55, $fn = 32);
        translate(p2) circle(d = largura * 0.55, $fn = 32);
    }
}

// Furos de fixação (parafuso/grampo), dois por braço.
module furos_2d() {
    for (t = [0.55, 0.85]) {
        translate([comprimento * t, largura / 2]) circle(d = diametro_furo, $fn = 32);
        translate(rot([comprimento * t, largura / 2], angulo)) circle(d = diametro_furo, $fn = 32);
    }
}

module esquadro_2d() {
    difference() {
        union() {
            forma_arredondada_2d();
            if (reforco_diagonal) reforco_2d();
        }
        if (diametro_furo > 0) furos_2d();
    }
}

module esquadro() {
    linear_extrude(height = espessura) esquadro_2d();
}

esquadro();
$scad$,
  $json${
    "parameters": {
      "comprimento": {
        "ui": { "label": "Comprimento de cada braço", "widget": "slider" },
        "min": 60, "max": 250, "unit": "mm", "order": 1, "default": 120
      },
      "largura": {
        "ui": { "label": "Largura de cada braço", "widget": "slider" },
        "min": 15, "max": 60, "unit": "mm", "order": 2, "default": 30
      },
      "espessura": {
        "ui": { "label": "Espessura", "widget": "slider", "step": 0.5 },
        "min": 4, "max": 15, "unit": "mm", "order": 3, "default": 8
      },
      "angulo": {
        "ui": { "label": "Ângulo entre os braços", "widget": "slider" },
        "min": 30, "max": 150, "unit": "°", "order": 4, "default": 90
      },
      "diametro_furo": {
        "ui": { "label": "Diâmetro dos furos de fixação (0 = sem furos)", "widget": "slider", "step": 0.5 },
        "min": 0, "max": 10, "unit": "mm", "order": 5, "default": 5
      },
      "reforco_diagonal": {
        "ui": { "label": "Reforço diagonal (mais rigidez)", "widget": "checkbox" },
        "order": 6, "default": true
      },
      "raio_canto": {
        "ui": { "label": "Arredondamento dos cantos exteriores", "widget": "slider", "step": 0.5 },
        "min": 0, "max": 10, "unit": "mm", "order": 7, "default": 3
      }
    }
  }$json$::jsonb,
  'CC-BY-NC', 2, 0, 0, 0,
  false, 'ativo', false, false,
  'OpenSans',
  0, 0, 7, -20, 20, -15, 15,
  0, 0, 6.5, -20, 20, -15, 15,
  NULL, NULL
);
