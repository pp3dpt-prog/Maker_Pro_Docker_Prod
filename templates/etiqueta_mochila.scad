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
