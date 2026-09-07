-- Atualiza o produto esquadro-montagem (já inserido por insert_esquadro_montagem.sql)
-- com o design correto: gabarito que veste a borda de chapas (madeira/MDF/
-- contraplacado) num canto (L), T ou cruz — não o design v1 (dois braços
-- planos "à esquadro de marceneiro") que tinha sido construído por engano.
-- Usar este UPDATE em vez de re-correr o INSERT. SQL editor do Supabase.
--
-- v2 (2026-09-07):
--   Design totalmente novo a pedido do utilizador (mostrou referência de uma
--   ferramenta concorrente): cada braço é um CANAL EM U (chão sólido +
--   paredes) que desliza sobre a borda da chapa (folga = espessura_chapa +
--   folga). Nos tipos T/Cruz, o(s) par(es) de braços opostos são um FEIXE
--   CONTÍNUO a atravessar o centro (é a mesma chapa a passar a direito), não
--   dois braços separados — só o(s) braço(s) de ramificação termina(m) em
--   coto no centro. Espessura da chapa gravada em relevo no chão, junto ao
--   centro. "Tipo de junção" escolhe qual dos 3 (canto/T/cruz) é gerado
--   nesse download (não um kit dos 3 sempre).
--   Validado localmente com OpenSCAD (--render, canto/T/cruz + variante com
--   paredes finas) — sem avisos.

UPDATE prod_designs SET
  descricao = 'Gabarito que veste a borda de chapas (madeira, MDF, contraplacado) num canto (L), T ou cruz, e segura o esquadro certo enquanto colas. A espessura da chapa fica gravada em relevo junto ao centro.',
  scad_template = $scad$
// Esquadro de Montagem (chapas) — gabarito que veste a borda de chapas (madeira/
// MDF/contraplacado) num canto (L), T ou cruz, segurando-as no ângulo certo
// durante a colagem. Cada braço é um canal em U (chão sólido + 2 paredes) que
// desliza sobre a borda da chapa (folga = espessura_chapa + folga). Nos tipos
// T/Cruz, o(s) par(es) de braços opostos são um FEIXE CONTÍNUO a atravessar o
// centro (é a mesma chapa a passar a direito), não dois braços separados.
// Espessura da chapa gravada em relevo no chão, junto ao centro.
//
// Parâmetros injectados pelo backend (DEPOIS deste texto): tipo_juncao,
// espessura_chapa, apoio_chapa, profundidade, espessura, parede, folga.
// IMPORTANTE: nenhuma variável derivada a nível de topo — usar function();
// e nenhum if/else a nível de topo que dependa de parâmetros injectados.

function gap() = espessura_chapa + folga;
function largura_braco() = parede * 2 + gap();
// Zona central sólida onde um braço em coto (não-contínuo) NÃO tem ranhura —
// evita furar a parede do feixe perpendicular que atravessa o centro.
function margem_hub() = largura_braco() / 2;

module braco_solido_2d(comprimento) {
    translate([0, -largura_braco() / 2]) square([comprimento, largura_braco()]);
}

// Pegadas (footprint) sólidas de cada braço/feixe, conforme o tipo de junção.
module bracos_2d() {
    if (tipo_juncao == "Cruz") {
        translate([-apoio_chapa, 0]) braco_solido_2d(apoio_chapa * 2);
        rotate([0, 0, 90]) translate([-apoio_chapa, 0]) braco_solido_2d(apoio_chapa * 2);
    } else if (tipo_juncao == "T") {
        translate([-apoio_chapa, 0]) braco_solido_2d(apoio_chapa * 2);
        rotate([0, 0, 90]) braco_solido_2d(apoio_chapa);
    } else { // Canto
        braco_solido_2d(apoio_chapa);
        rotate([0, 0, 90]) braco_solido_2d(apoio_chapa);
    }
}

// Ranhuras onde a borda da chapa desliza — contínuas nos feixes (Cruz: os 2;
// T: só o do través), em coto (só a partir de margem_hub()) nos braços que
// terminam no centro.
module ranhuras_2d() {
    g = gap();
    if (tipo_juncao == "Cruz") {
        translate([-apoio_chapa - 1, -g / 2]) square([apoio_chapa * 2 + 2, g]);
        rotate([0, 0, 90]) translate([-apoio_chapa - 1, -g / 2]) square([apoio_chapa * 2 + 2, g]);
    } else if (tipo_juncao == "T") {
        translate([-apoio_chapa - 1, -g / 2]) square([apoio_chapa * 2 + 2, g]);
        rotate([0, 0, 90]) translate([margem_hub(), -g / 2]) square([apoio_chapa - margem_hub() + 1, g]);
    } else { // Canto
        translate([margem_hub(), -g / 2]) square([apoio_chapa - margem_hub() + 1, g]);
        rotate([0, 0, 90]) translate([margem_hub(), -g / 2]) square([apoio_chapa - margem_hub() + 1, g]);
    }
}

// Texto da espessura da chapa, gravado em relevo junto ao centro.
module rotulo_2d() {
    text(str(espessura_chapa), size = margem_hub() * 1.1, halign = "center", valign = "center",
         font = "Liberation Sans:style=Bold");
}

module esquadro() {
    union() {
        // Chão sólido (fecha o canal por baixo, pára a chapa em Z).
        linear_extrude(height = espessura) bracos_2d();
        // Paredes do canal (com a ranhura para a chapa), por cima do chão.
        translate([0, 0, espessura])
            linear_extrude(height = max(profundidade - espessura, 0.4))
                difference() { bracos_2d(); ranhuras_2d(); }
        // Relevo da espessura da chapa, no chão junto ao centro.
        linear_extrude(height = espessura + 0.4) rotulo_2d();
    }
}

esquadro();
$scad$,
  generation_schema = $json${
    "parameters": {
      "tipo_juncao": {
        "ui": { "label": "Tipo de junção", "widget": "select",
                "options": ["Canto", "T", "Cruz"] },
        "order": 1, "default": "Canto"
      },
      "espessura_chapa": {
        "ui": { "label": "Espessura da chapa", "widget": "slider", "step": 0.5 },
        "min": 3, "max": 30, "unit": "mm", "order": 2, "default": 15
      },
      "apoio_chapa": {
        "ui": { "label": "Apoio sobre a chapa (comprimento de cada braço)", "widget": "slider" },
        "min": 20, "max": 100, "unit": "mm", "order": 3, "default": 60
      },
      "profundidade": {
        "ui": { "label": "Profundidade do canal (chão + paredes)", "widget": "slider" },
        "min": 10, "max": 60, "unit": "mm", "order": 4, "default": 20
      },
      "espessura": {
        "ui": { "label": "Espessura do chão", "widget": "slider", "step": 0.5 },
        "min": 2, "max": 10, "unit": "mm", "order": 5, "default": 5
      },
      "parede": {
        "ui": { "label": "Espessura das paredes do canal", "widget": "slider", "step": 0.5 },
        "min": 1.5, "max": 8, "unit": "mm", "order": 6, "default": 4
      },
      "folga": {
        "ui": { "label": "Folga de encaixe da chapa", "widget": "slider", "step": 0.1 },
        "min": 0.1, "max": 1, "unit": "mm", "order": 7, "default": 0.3
      }
    }
  }$json$::jsonb
WHERE id = 'esquadro-montagem';
