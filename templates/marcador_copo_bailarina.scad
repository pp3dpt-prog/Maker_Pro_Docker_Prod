// ── MARCADORES DE COPO — BAILARINA ──
// Silhueta de uma bailarina (desenho original) com o braço erguido: a mão curva-se num gancho
// em "U" que passa por cima da borda do copo, com uma perna curta por dentro a apertar o vidro,
// como se ela segurasse o copo. A figura fica espetada para fora do copo, como uma barbatana.
// Aos pés, um palco com o nome em relevo (noutra cor) ou liso com um rebaixo para colar uma
// etiqueta (fita de etiquetadora, para as emergências). Até 12 de uma vez.
//
// Parâmetros:
//   quantidade, nome_1 … nome_12, fonte, tamanho_nome (mm)
//   palco            "Nome em relevo" | "Rebaixo para etiqueta"
//   fita             largura da fita da etiqueta (mm): 6, 9 ou 12
//   largura          largura do palco (mm)
//   altura_figura    altura da bailarina, dos pés à borda do copo (mm)
//   espessura        espessura da peça (mm) — sem AMS é a altura da troca de cor
//   espessura_vidro  espessura do vidro na borda do copo (mm)
//   afastamento      quanto a figura e o palco se afastam do copo (mm) — para copos com barriga
//                    (taças de vinho), que alargam abaixo da borda; o pulso dobra para chegar ao gancho
//   modo             "corpo" | "nome" | "tudo"

function _q()      = is_undef(quantidade) ? 6 : max(1, min(12, round(quantidade)));
function _fonte()  = is_undef(fonte) ? "Pacifico" : fonte;
function _tam()    = is_undef(tamanho_nome) ? 7 : max(4, min(12, tamanho_nome));
function _palco()  = is_undef(palco) ? "Nome em relevo" : palco;
function _etiq()   = _palco() == "Rebaixo para etiqueta";
function _fita()   = is_undef(fita) ? 9 : max(4, min(14, is_string(fita) ? 9 : fita));
function _larg()   = is_undef(largura) ? 44 : max(30, min(80, largura));
function _alt()    = is_undef(altura_figura) ? 62 : max(45, min(90, altura_figura));
function _esp()    = is_undef(espessura) ? 3 : max(2.4, min(5, espessura));
function _vidro()  = is_undef(espessura_vidro) ? 2.5 : max(1, min(6, espessura_vidro));
function _modo()   = is_undef(modo) ? "tudo" : modo;
function _afast()  = is_undef(afastamento) ? 2 : max(0, min(15, afastamento));

function _nome(i) =
    i == 0 ? (is_undef(nome_1)  ? "" : nome_1)  : i == 1 ? (is_undef(nome_2)  ? "" : nome_2)  :
    i == 2 ? (is_undef(nome_3)  ? "" : nome_3)  : i == 3 ? (is_undef(nome_4)  ? "" : nome_4)  :
    i == 4 ? (is_undef(nome_5)  ? "" : nome_5)  : i == 5 ? (is_undef(nome_6)  ? "" : nome_6)  :
    i == 6 ? (is_undef(nome_7)  ? "" : nome_7)  : i == 7 ? (is_undef(nome_8)  ? "" : nome_8)  :
    i == 8 ? (is_undef(nome_9)  ? "" : nome_9)  : i == 9 ? (is_undef(nome_10) ? "" : nome_10) :
    i == 10 ? (is_undef(nome_11) ? "" : nome_11) : (is_undef(nome_12) ? "" : nome_12);
function _esc(i) =
    i == 0 ? (is_undef(esc_nome_1)  ? 1 : esc_nome_1)  : i == 1 ? (is_undef(esc_nome_2)  ? 1 : esc_nome_2)  :
    i == 2 ? (is_undef(esc_nome_3)  ? 1 : esc_nome_3)  : i == 3 ? (is_undef(esc_nome_4)  ? 1 : esc_nome_4)  :
    i == 4 ? (is_undef(esc_nome_5)  ? 1 : esc_nome_5)  : i == 5 ? (is_undef(esc_nome_6)  ? 1 : esc_nome_6)  :
    i == 6 ? (is_undef(esc_nome_7)  ? 1 : esc_nome_7)  : i == 7 ? (is_undef(esc_nome_8)  ? 1 : esc_nome_8)  :
    i == 8 ? (is_undef(esc_nome_9)  ? 1 : esc_nome_9)  : i == 9 ? (is_undef(esc_nome_10) ? 1 : esc_nome_10) :
    i == 10 ? (is_undef(esc_nome_11) ? 1 : esc_nome_11) : (is_undef(esc_nome_12) ? 1 : esc_nome_12);

NOMINAL  = 62;     // altura (pés → borda) para que o desenho foi feito
function _k() = _alt() / NOMINAL;
W        = 2.2;    // largura do gancho (mm reais)
PERNA    = 18;     // perna de dentro do gancho (mm)
PONTA    = 3;      // aba da ponta, aberta para dentro do copo (mm)
REL      = 0.8;    // relevo do nome (mm)
REB      = 0.4;    // profundidade do rebaixo da etiqueta (mm)

function _gU() = _vidro() + 1.2;                  // folga no "U"
function _gP() = max(0.6, _vidro() - 0.6);        // folga na ponta (aperta)
function _rc() = (_gU() + W) / 2;
function _hp() = _etiq() ? _fita() + 3 : _tam()*1.3 + 3;   // altura do palco

// ---------- silhueta (desenho nominal: pés em y = 0, borda do copo em y = 62, vidro à direita de x = 0) ----------
module osso(a, b, ra, rb) { hull() { translate(a) circle(ra); translate(b) circle(rb == undef ? ra : rb); } }

module saia2d() {
    // saia rodada, levantada pela mão esquerda, com a bainha ondulada
    offset(r=0.8) offset(r=-0.8) polygon([
        [-11.0, 31.5], [-15.6, 31.5], [-19.5, 28.5], [-24.5, 27.6], [-29.0, 29.2], [-27.6, 25.2],
        [-25.6, 22.6], [-23.4, 21.4], [-21.4, 19.6], [-18.6, 19.2], [-16.2, 18.0], [-13.4, 18.6],
        [-10.6, 17.8], [-8.2, 19.4], [-6.6, 19.0], [-7.4, 22.6], [-9.0, 27.0]]);
}

module figura2d() {
    offset(r=-0.6) offset(r=0.6) union() {
        translate([-12.2, 50.2]) circle(3.4);                       // cabeça
        osso([-14.6, 51.6], [-16.2, 50.4], 1.9, 1.3);                // carrapito
        osso([-11.6, 46.0], [-11.8, 43.0], 1.2);                     // pescoço
        osso([-11.6, 40.4], [-12.6, 33.0], 3.4, 2.2);                // tronco
        osso([-12.6, 33.0], [-12.0, 30.6], 2.2, 2.6);                // cintura
        osso([-9.4, 42.2], [-14.8, 41.6], 1.6);                      // ombros
        // braço erguido: ombro → cotovelo → mão (vertical junto ao vidro)
        osso([-9.4, 42.2], [-5.2, 52.0], 1.5, 1.25);
        osso([-5.2, 52.0], [-1.1, 58.0], 1.25, 1.1);
        osso([-1.1, 58.0], [0, 62], 1.1);
        // braço de baixo, a segurar a ponta da saia
        osso([-14.8, 41.6], [-20.6, 35.6], 1.4, 1.15);
        osso([-20.6, 35.6], [-27.6, 28.8], 1.15, 0.95);
        osso([-27.6, 28.8], [-29.2, 29.6], 0.95, 0.8);               // dedos
        saia2d();
        // pernas: a da frente direita, a de trás cruzada, em bicos de pés com salto
        osso([-11.2, 19.0], [-9.6, 9.0], 1.9, 1.3);
        osso([-9.6, 9.0], [-9.4, 3.2], 1.3, 0.85);
        osso([-9.4, 3.2], [-6.4, 0.6], 0.85, 0.6);                   // pé
        osso([-9.6, 2.6], [-9.9, 0.4], 0.45);                        // salto
        osso([-14.4, 19.0], [-15.6, 9.4], 1.9, 1.3);
        osso([-15.6, 9.4], [-16.8, 3.2], 1.3, 0.85);
        osso([-16.8, 3.2], [-19.8, 0.6], 0.85, 0.6);
        osso([-16.6, 2.6], [-16.4, 0.4], 0.45);
    }
}

// ---------- peça em mm reais ----------
// o desenho escala com a altura; o gancho, o palco e o nome não
module gancho2d() {
    rc = _rc(); top = NOMINAL*_k();
    osso([0, top - 6], [0, top], W/2);                                  // mão (vertical, encostada ao vidro)
    translate([rc, top]) intersection() {
        difference() { circle(rc + W/2); circle(rc - W/2); }
        translate([-rc - W, 0]) square([2*rc + 2*W, rc + W]);
    }
    a = [2*rc, top]; b = [W + _gP(), top - PERNA];
    osso(a, b, W/2);
    osso(b, b + [PONTA*sin(30), -PONTA*cos(30)], W/2);                 // ponta aberta para dentro do copo
}

// o palco fica todo do lado de fora do vidro (x < 0); centrado na bailarina se couber
function _xc() = min(-13*_k() - _afast(), -W/2 - 0.3 - _afast() - _larg()/2);
function _yc() = -_hp()/2 + 0.6;

module palco2d() {
    translate([_xc(), _yc()]) offset(r=1.2) offset(delta=-1.2) square([_larg(), _hp()], center=true);
}

module corpo2d() {
    union() {
        translate([-_afast(), 0]) scale(_k()) figura2d();
        // pulso: liga a mão da figura (afastada) ao gancho
        hull() { translate([-_afast(), NOMINAL*_k()]) circle(W/2); translate([0, NOMINAL*_k()]) circle(W/2); }
        translate([-_afast() - 1.2, NOMINAL*_k() - 1.0]) circle(1.3);     // polegar
        gancho2d();
        palco2d();
    }
}

module nome2d(i) {
    if (_nome(i) != "")
        translate([_xc(), _yc()])
            text(_nome(i), size=_tam()*_esc(i), font=_fonte(), halign="center", valign="center");
}

module corpo1() {
    difference() {
        linear_extrude(_esp()) corpo2d();
        if (_etiq())   // rebaixo para a etiqueta
            translate([_xc(), _yc(), _esp() - REB]) linear_extrude(1)
                offset(r=0.6) square([_larg() - 4 - 1.2, _fita() + 0.6 - 1.2], center=true);
    }
}
module nome1(i) { if (!_etiq()) translate([0, 0, _esp() - 0.01]) linear_extrude(REL + 0.01) nome2d(i); }

// ---------- arrumação na mesa ----------
function _cols()  = _q() > 6 ? 4 : min(_q(), 3);
function _passoX() = max(_larg(), 30*_k()) + _afast() + 2*_rc() + 2*W + 6;
function _passoY() = NOMINAL*_k() + _hp() + _rc() + 6;
function pos(i) = [(i % _cols())*_passoX(), -floor(i / _cols())*_passoY()];

if (_modo() == "corpo" || _modo() == "tudo")
    for (i=[0:_q()-1]) translate(pos(i)) corpo1();
if (_modo() == "nome" || _modo() == "tudo")
    for (i=[0:_q()-1]) translate(pos(i)) nome1(i);
