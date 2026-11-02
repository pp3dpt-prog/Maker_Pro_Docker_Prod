-- Etiqueta para mochila: corrige o template e liga o ajuste automático do texto.
-- SQL editor do Supabase. Re-executável (é um UPDATE por id).
--
-- ORDEM: aplicar este UPDATE *depois* de o backend (Maker_Pro_Docker_Prod) estar em
-- produção com lib/textFit.js e a fonte Open Sans — o SCAD novo lê os factores
-- esc_nome/esc_linha2/esc_verso que só o backend novo calcula (sem eles assume 1 e o
-- texto longo pode sair da etiqueta).
--
-- Correcções ao template anterior:
--   * texto da frente flutuava (começava 0,8 mm acima da base) -> agora assenta nela
--   * borda com o dobro da largura (2,5 -> 5 mm) -> offset(delta)
--   * aba com 19 mm em vez de 11 e furo fora de centro -> tab_sai/tab_sob
--   * o verso nunca chegava ao SCAD (schema chamava-lhe texto2, o SCAD lê verso)
--   * texto largo saía da etiqueta -> factores esc_* (generation_schema.ajuste_texto)
--   * fontes de píxeis (Press Start 2P) davam malha não fechada e STL sem texto
-- Schema: unidade do tamanho passa de pt para mm; "Baloo2" -> "Baloo 2" e sem duplicado;
-- lista com as 15 fontes instaladas no backend.
-- Validado com OpenSCAD 2021.01 (a versão do Dockerfile), nas duas ordens de injecção.

UPDATE prod_designs SET
  descricao = 'Etiqueta personalizada para mochilas, com nome em relevo na frente, segunda linha opcional e texto escavado no verso. Aba com furo para cordão elástico.',
  default_fonte = 'Open Sans',
  scad_template = $scad$
// ── ETIQUETA PARA MOCHILA / SACO DE DESPORTO ──
// Parâmetros injectados pelo backend:
//   nome, linha2, verso   texto da frente (1–2 linhas) e do verso (escavado)
//   fonte                 família da fonte (instalada no servidor, ver /fonts)
//   fontSize              tamanho do texto em mm (size do OpenSCAD)
//   esc_nome, esc_linha2, esc_verso
//                         factor 0–1 de redução do texto, calculado pelo servidor
//                         (lib/textFit.js) para caber na largura útil; 1 = sem redução
//
// Não há valores por defeito como `nome = ...;` e também não se derivam variáveis de
// topo a partir das injectadas (`_nome = is_undef(nome) ? "" : nome;` seria calculada
// antes de o servidor definir `nome` quando as variáveis vêm DEPOIS do template, e sairia
// vazia — a etiqueta ficava sem texto).
// As injectadas são lidas por funções, avaliadas só na instanciação, quando já têm o
// valor final — por isso a ordem de injecção (antes ou depois do template) é indiferente.

function _nome()      = is_undef(nome)      ? ""          : nome;
function _linha2()    = is_undef(linha2)    ? ""          : linha2;
function _verso()     = is_undef(verso)     ? ""          : verso;
function _fonte()     = is_undef(fonte)     ? "Open Sans" : fonte;
function _fs()        = is_undef(fontSize)  ? 9           : fontSize;
function _esc_nome()   = is_undef(esc_nome)   ? 1 : esc_nome;
function _esc_linha2() = is_undef(esc_linha2) ? 1 : esc_linha2;
function _esc_verso()  = is_undef(esc_verso)  ? 1 : esc_verso;

larg    = 85;
alt     = 50;
esp     = 3.5;
r_canto = 8;

// Aba de fixação (cordão elástico)
tab_w   = 18;
tab_sai = 12;   // quanto sai acima do corpo
tab_sob = 2;    // quanto entra no corpo (garante união)
tab_r   = 4;
r_furo  = 3.8;

// Borda e texto
borda_larg = 2.5;
borda_esp  = 0.8;
alt_texto  = 1.2;   // relevo da frente
prof_verso = 1.3;   // profundidade do verso escavado

// A largura útil do texto é larg - 2*borda_larg - 2*4 = 72 mm e tem de coincidir com
// generation_schema.ajuste_texto.largura_util (usado pelo servidor e pela pré-visualização).

module forma2d() {
    hull() for (x = [r_canto, larg - r_canto], y = [r_canto, alt - r_canto])
        translate([x, y]) circle(r = r_canto, $fn = 48);
}

module aba2d() {
    h = tab_sai + tab_sob;
    translate([larg/2 - tab_w/2, alt - tab_sob])
        hull() for (x = [tab_r, tab_w - tab_r], y = [tab_r, h - tab_r])
            translate([x, y]) circle(r = tab_r, $fn = 48);
}

module furo_cordao() {
    translate([larg/2, alt + tab_sai/2, -1])
        cylinder(h = esp + 2, r = r_furo, $fn = 48);
}

module borda_relevo() {
    translate([0, 0, esp - 0.01])
        linear_extrude(borda_esp + 0.01)
            difference() {
                forma2d();
                offset(delta = -borda_larg) forma2d();
            }
}

// offset(delta = 0.01) funde contornos que se tocam nos cantos: sem ele, fontes de
// píxeis (Press Start 2P) geram uma malha não fechada ("The given mesh is not closed")
// e o OpenSCAD exporta a placa SEM texto.
module texto2d(t, esc) {
    scale(esc)
        offset(delta = 0.01)
            text(t, size = _fs(), font = _fonte(), halign = "center", valign = "center");
}

// Verso escavado, espelhado em X para ler correctamente ao virar a etiqueta
module corte_verso() {
    translate([larg/2, alt/2, -0.01])
        linear_extrude(prof_verso + 0.01)
            mirror([1, 0]) texto2d(_verso(), _esc_verso());
}

module frente() {
    translate([0, 0, esp - 0.01])
        linear_extrude(alt_texto + 0.01) {
            if (len(_linha2()) > 0) {
                translate([larg/2, alt/2 + _fs() * 0.55]) texto2d(_nome(), _esc_nome());
                translate([larg/2, alt/2 - _fs() * 0.55]) texto2d(_linha2(), _esc_linha2());
            } else {
                translate([larg/2, alt/2]) texto2d(_nome(), _esc_nome());
            }
        }
}

difference() {
    linear_extrude(esp) { forma2d(); aba2d(); }
    furo_cordao();
    if (len(_verso()) > 0) corte_verso();
}
borda_relevo();
frente();
$scad$,
  generation_schema = $json${
  "parameters": {
    "nome": {
      "ui": {
        "label": "Nome (frente)",
        "widget": "text"
      },
      "order": 1,
      "default": ""
    },
    "linha2": {
      "ui": {
        "label": "Segunda linha (opcional)",
        "widget": "text",
        "placeholder": "Deixar vazio para uma linha"
      },
      "order": 2,
      "default": ""
    },
    "verso": {
      "ui": {
        "label": "Texto verso (opcional)",
        "widget": "text"
      },
      "order": 3,
      "default": ""
    },
    "fontSize": {
      "ui": {
        "step": 1,
        "label": "Tamanho da letra",
        "widget": "slider"
      },
      "max": 14,
      "min": 6,
      "unit": "mm",
      "order": 4,
      "default": 9
    },
    "fonte": {
      "ui": {
        "label": "Tipo de letra",
        "widget": "select",
        "options": [
          "Open Sans",
          "Aladin",
          "Amarante",
          "Anton",
          "Baloo 2",
          "Benne",
          "Chewy",
          "Gloria Hallelujah",
          "Lobster",
          "Luckiest Guy",
          "Oswald",
          "Pacifico",
          "Press Start 2P",
          "Racing Sans One",
          "Sigmar One"
        ]
      },
      "order": 5,
      "default": "Open Sans"
    },
    "info_fita": {
      "ui": {
        "text": "📦 Etiqueta fornecida com cordão elástico para prender ao fecho da mochila.",
        "widget": "info"
      },
      "order": 99
    }
  },
  "ajuste_texto": {
    "largura_util": 72,
    "campos": [
      "nome",
      "linha2",
      "verso"
    ]
  }
}$json$::jsonb
WHERE id = 'etiqueta_mochila';
