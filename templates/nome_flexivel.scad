// ── NOME FLEXÍVEL (letras articuladas, impressas já montadas) ──
//
// Cada letra é um segmento atravessado por uma barra horizontal (segura letras de qualquer
// forma). Entre letras há uma dobradiça com eixo em Y: a letra da esquerda tem dois nós
// exteriores e o pino; a da direita tem o nó do meio, com furo. Dobra para cima e para baixo.
// Imprime-se deitado, como sai, sem suportes nem brim.
//
// Parâmetros injectados pelo backend (lib/textFit.js, generation_schema.letras_flexi):
//   nome        texto já em maiúsculas, só letras e algarismos, sem acentos
//   lx0, lw     por letra: início da tinta (desde a origem do glifo) e largura da tinta, em mm
//   cap         altura das maiúsculas (mm), para centrar a barra
// Parâmetros do cliente:
//   fonte, tamanho (size do OpenSCAD), espessura, barra (largura da barra, mm),
//   folga (mm, igual em toda a dobradiça), teste_folgas (juntas com folga crescente),
//   modo: "impares" | "pares" (letras 1,3,5… / 2,4,6…, para o 3MF a duas cores) | "tudo"
//
// As injectadas são lidas por funções (avaliadas só na instanciação), por isso a ordem de
// injecção (antes ou depois do template) é indiferente.

function _nome()   = is_undef(nome) ? "" : nome;
function _n()      = len(_nome());
function _fonte()  = is_undef(fonte) ? "Luckiest Guy" : fonte;
function _size()   = is_undef(tamanho) ? 20 : tamanho;
function _T()      = is_undef(espessura) ? 6 : espessura;
function _cap()    = is_undef(cap) ? _size() * 0.75 : cap;
function _b()      = min(is_undef(barra) ? 8 : barra, _cap());
function _x0(i)    = (is_undef(lx0) || i >= len(lx0)) ? 0 : lx0[i];
function _w(i)     = (is_undef(lw) || i >= len(lw)) ? _size() * 0.7 : lw[i];
function _folga0() = is_undef(folga) ? 0.35 : folga;
function _teste()  = !is_undef(teste_folgas) && (teste_folgas == true || teste_folgas == 1);
function _modo()   = is_undef(modo) ? "tudo" : modo;

// folga da junta j (entre as letras j e j+1); em teste: 0,30 · 0,35 · 0,40 … da esquerda para a direita
function folga_j(j) = _teste() ? 0.30 + 0.05 * j : _folga0();

function _R()  = _T() / 2;               // raio dos nós = meia espessura
function _rp() = _R() * 0.45;            // raio do pino
function _gap(j) = 2 * _R() + 2 * folga_j(j) + 0.6;   // espaço entre a tinta de duas letras

// posição (início da tinta) de cada letra
function _pos(i) = i == 0 ? 0 : _pos(i - 1) + _w(i - 1) + _gap(i - 1);
function _yc() = _cap() / 2;             // centro da barra (a meio das maiúsculas)

module letra_2d(i) {
    translate([_pos(i) - _x0(i), 0])
        offset(delta = 0.01) text(_nome()[i], size = _size(), font = _fonte(), halign = "left", valign = "baseline");
}

// faixas da barra em Y: exterior inferior, meio, exterior superior
function _y_meio0(j) = _yc() - _b() / 6 + folga_j(j) / 2;
function _y_meio1(j) = _yc() + _b() / 6 - folga_j(j) / 2;

module no(x, y0, y1) {                   // nó: cilindro de eixo Y, de y0 a y1, centro (x, R)
    translate([x, y1, _R()]) rotate([90, 0, 0]) cylinder(h = y1 - y0, r = _R(), $fn = 48);
}
module caixa(x0, x1, y0, y1) { translate([x0, y0, 0]) cube([x1 - x0, y1 - y0, _T()]); }

// Segmento i: letra + barra, mais a metade esquerda da junta à direita (nós exteriores + pino)
// e a metade direita da junta à esquerda (nó do meio, com furo).
module segmento(i) {
    xa = _pos(i); xb = _pos(i) + _w(i);
    yb0 = _yc() - _b() / 2; yb1 = _yc() + _b() / 2;
    difference() {
        union() {
            linear_extrude(_T()) letra_2d(i);
            caixa(xa, xb, yb0, yb1);                               // barra dentro da letra
            if (i < _n() - 1) {                                    // junta à direita: nós exteriores
                xg = xb + _gap(i) / 2;
                for (f = [[yb0, _y_meio0(i) - folga_j(i)], [_y_meio1(i) + folga_j(i), yb1]]) {
                    caixa(xb - 0.01, xg, f[0], f[1]);
                    no(xg, f[0], f[1]);
                }
                // pino, atravessa o nó do meio da letra seguinte
                translate([xg, yb1, _R()]) rotate([90, 0, 0]) cylinder(h = _b(), r = _rp(), $fn = 32);
            }
            if (i > 0) {                                           // junta à esquerda: nó do meio
                xg = xa - _gap(i - 1) / 2;
                caixa(xg, xa + 0.01, _y_meio0(i - 1), _y_meio1(i - 1));
                no(xg, _y_meio0(i - 1), _y_meio1(i - 1));
            }
        }
        if (i > 0) {                                               // furo do pino no nó do meio
            xg = xa - _gap(i - 1) / 2;
            translate([xg, yb1 + 1, _R()]) rotate([90, 0, 0])
                cylinder(h = _b() + 2, r = _rp() + folga_j(i - 1), $fn = 32);
        }
    }
}

if (_n() > 0) {
    for (i = [0 : _n() - 1]) {
        par = (i % 2 == 1);
        if (_modo() == "impares" && !par) segmento(i);
        else if (_modo() == "pares" && par) segmento(i);
        else if (_modo() != "impares" && _modo() != "pares")
            color(par ? (is_undef(cor_pares) ? "#38BDF8" : cor_pares) : (is_undef(cor_impares) ? "#7C3AED" : cor_impares))
                segmento(i);
    }
}
