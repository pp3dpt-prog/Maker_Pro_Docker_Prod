-- Atualiza o produto esquadro-montagem — corrige o v2 (design do canal em U
-- para chapas): as ranhuras dos braços em coto (Canto: os dois; T: o ramo)
-- ficavam fechadas antes do centro, impedindo as duas chapas de se
-- encontrarem/encaixarem no canto. Usar este UPDATE em vez de re-correr o
-- v2. SQL editor do Supabase.
--
-- v3 (2026-09-07):
--   As ranhuras dos braços em coto passam a abrir ATÉ ao centro (desde
--   -gap/2, não desde uma margem) — as chapas dos dois braços (Canto) ou do
--   ramo com o través (T) agora podem tocar-se/encaixar mesmo junto ao
--   canto, em vez de ficarem separadas por um "web" sólido. O chão continua
--   sólido por baixo de tudo (module esquadro()), por isso a peça não perde
--   resistência mesmo com as ranhuras a cruzarem-se ali.
--   Validado localmente com OpenSCAD (--render, canto/T/cruz) — sem avisos.

UPDATE prod_designs SET
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
// Só usada para dimensionar o relevo da espessura (rotulo_2d) — as ranhuras
// já não dependem disto (ver nota em ranhuras_2d).
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
// T: só o do través). Os braços em coto (que terminam no centro: os dois no
// Canto, o ramo no T) têm a ranhura aberta ATÉ ao centro (desde -g/2, não
// desde margem_hub()) — para as chapas dos dois braços poderem tocar-se e
// encaixar uma na outra mesmo no canto, não ficarem separadas por um "web"
// sólido. O chão (module esquadro()) continua sólido por baixo de tudo, por
// isso a peça não perde resistência mesmo com as ranhuras a cruzarem-se.
module ranhuras_2d() {
    g = gap();
    if (tipo_juncao == "Cruz") {
        translate([-apoio_chapa - 1, -g / 2]) square([apoio_chapa * 2 + 2, g]);
        rotate([0, 0, 90]) translate([-apoio_chapa - 1, -g / 2]) square([apoio_chapa * 2 + 2, g]);
    } else if (tipo_juncao == "T") {
        translate([-apoio_chapa - 1, -g / 2]) square([apoio_chapa * 2 + 2, g]);
        rotate([0, 0, 90]) translate([-g / 2, -g / 2]) square([apoio_chapa + 1 + g / 2, g]);
    } else { // Canto
        translate([-g / 2, -g / 2]) square([apoio_chapa + 1 + g / 2, g]);
        rotate([0, 0, 90]) translate([-g / 2, -g / 2]) square([apoio_chapa + 1 + g / 2, g]);
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
$scad$
WHERE id = 'esquadro-montagem';
