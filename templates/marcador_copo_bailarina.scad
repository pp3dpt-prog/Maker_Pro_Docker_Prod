// ── MARCADORES DE COPO — BAILARINA ──
// Silhueta de uma bailarina (desenho do Pedro, pp3d) com o braço erguido: a mão curva-se num gancho
// em "U" que passa por cima da borda do copo, com uma perna curta por dentro a apertar o vidro,
// como se ela segurasse o copo. A figura fica espetada para fora do copo, como uma barbatana.
// A perna de fora do gancho desce até ao palco, como uma barra de ballet, e reforça a peça.
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
// Silhueta da bailarina: desenho do Pedro (pp3d), contornado a partir da imagem dele
// (brinco com a bailarina dentro de uma argola; a argola e o furo foram retirados).
// Escala: pés em y = 0, ponta da mão erguida em (0, 62). 1 contorno exterior + 1 buraco
// (entre o braço e o corpo). Nenhuma parte tem menos de 1,8 mm de largura à altura nominal,
// tirando as pontas dos dedos e do sapato.
BAILARINA = [
    [-4.13,62],[-4.59,61.94],[-5.43,61.32],[-6.44,60.83],[-6.78,60.49],[-7,60.06],[-7.03,58.73],[-7.21,58.27],[-7.21,56.33],[-7.4,55.86],
    [-7.4,54.11],[-7.58,53.64],[-7.58,50.41],[-7.43,50.07],[-7.4,49.67],[-7.95,47.54],[-7.95,47.08],[-8.6,44.83],[-8.94,44.64],[-9.22,44.86],
    [-9.62,45.47],[-9.8,46.06],[-9.13,47.14],[-8.76,48.28],[-9.28,49.48],[-9.13,50.13],[-9.25,50.59],[-9.09,50.96],[-9.09,51.43],[-9.5,52.07],
    [-10.05,52.5],[-10.67,52.72],[-11.07,52.75],[-11.53,52.94],[-12.73,52.94],[-13.07,52.78],[-13.6,52.72],[-14.95,51.95],[-15.66,51.24],[-16.06,50.62],
    [-16.28,49.95],[-16.31,48.99],[-17.17,48.22],[-17.2,47.45],[-17.36,47.11],[-17.39,46.71],[-17.14,46.15],[-16.71,45.69],[-16.56,45.2],[-16.37,45.04],
    [-15.97,44.95],[-15.51,44.52],[-15.08,44.3],[-14.86,44.27],[-14.18,44.49],[-13.78,44.8],[-13.38,44.77],[-13.16,44.52],[-13.13,44.12],[-12.95,43.66],
    [-12.95,43.19],[-13.2,42.64],[-14.18,42.05],[-15.88,41.41],[-17.33,39.96],[-17.82,39.12],[-18.65,38.08],[-21.52,35.24],[-22.91,34.56],[-24.02,33.82],
    [-27.81,30.8],[-28.92,30.06],[-29.57,29.75],[-30.86,28.83],[-31.69,28.02],[-31.97,27.9],[-32.37,27.38],[-32.09,26.76],[-31.29,26.76],[-31.08,26.45],
    [-31.26,25.9],[-31.26,25.25],[-31.42,24.91],[-31.66,23.65],[-32.19,22.2],[-32.16,21.43],[-31.79,21.03],[-30.98,20.63],[-30.65,20.56],[-30.4,20.35],
    [-30.15,19.79],[-30.09,18.22],[-29.75,17.88],[-29.32,17.67],[-28.8,17.6],[-28.15,17.36],[-27.96,17.14],[-27.69,16.37],[-26.98,15.66],[-24.88,14.52],
    [-23.62,14.46],[-23.28,14.18],[-22.48,13.78],[-21.8,13.57],[-19.67,13.57],[-19.33,13.72],[-18.93,13.75],[-17.54,13.2],[-15.42,13.2],[-14.49,13.57],
    [-14.31,13.5],[-13.9,13.07],[-13.9,12.18],[-14.12,11.75],[-15.66,9.8],[-16.62,7.89],[-17.6,4.96],[-18.56,2.87],[-19.11,2.13],[-19.67,1.85],
    [-20.04,1.39],[-20.78,1.11],[-20.93,0.96],[-20.87,0.83],[-20.29,0.77],[-19.39,0.43],[-18.93,0.43],[-17.54,0.06],[-16.19,0.03],[-15.97,0.34],
    [-15.72,1.23],[-15.32,2.03],[-15.08,2.31],[-14.21,3.88],[-13.47,4.99],[-13.04,5.46],[-12.55,6.29],[-12.02,6.78],[-11.87,6.78],[-11.68,6.6],
    [-9.28,1.79],[-8.79,0.12],[-8.39,0.06],[-7.92,0.25],[-7.28,0.25],[-6.81,0.43],[-6.23,0.46],[-5.64,0.74],[-6.47,3.11],[-6.51,3.51],
    [-7.25,6.2],[-7.25,6.66],[-7.8,8.6],[-7.8,9.06],[-7.99,9.53],[-7.99,9.99],[-8.14,10.45],[-7.8,11.56],[-7.8,12.95],[-7.99,13.41],
    [-7.99,14.24],[-7.74,14.8],[-7.49,15.01],[-6.41,15.26],[-5.98,15.48],[-5.09,16.31],[-4.56,16.37],[-3.02,16.96],[-2.81,17.3],[-2.84,18.07],
    [-3.14,18.65],[-3.21,19.18],[-3.51,19.76],[-3.58,20.29],[-4.25,22.35],[-4.29,22.75],[-4.47,23.22],[-4.47,23.68],[-4.66,24.14],[-4.66,24.79],
    [-4.84,25.25],[-4.84,28.67],[-4.66,29.13],[-4.66,29.97],[-4.47,30.43],[-4.47,30.89],[-4.29,31.35],[-4.29,31.82],[-4.1,32.28],[-4.1,32.74],
    [-3.73,34.13],[-3.73,34.96],[-3.21,36.23],[-3.18,36.81],[-2.99,37.27],[-3.02,37.86],[-3.42,38.85],[-4.59,40.23],[-5.21,41.16],[-5.21,42.73],
    [-5.03,43.19],[-5.03,44.21],[-4.84,44.67],[-4.84,45.69],[-4.66,46.15],[-4.66,49.02],[-4.47,49.48],[-4.47,51.06],[-4.66,51.52],[-4.66,54.38],
    [-4.84,54.85],[-4.84,58.64],[-4.75,58.86],[-4.41,59.07],[-2.28,59.07],[-1.82,58.89],[-1.23,58.92],[-0.8,59.23],[-0.77,59.87],[0,60.24],
    [-0.12,60.49],[-0.86,60.86],[-11.31,33.05],[-11.28,31.72],[-11.53,31.17],[-12.98,29.72],[-13.38,29.13],[-14.18,28.3],[-15.05,26.91],[-15.42,26.55],
    [-16.22,26.14],[-18.99,25.22],[-19.39,25.19],[-19.85,25],[-20.5,25],[-20.96,24.82],[-21.98,24.82],[-22.44,25],[-23.09,25],[-23.43,25.16],
    [-23.96,25.22],[-25.68,25.99],[-25.96,26.24],[-27.53,27.1],[-27.93,27.56],[-27.87,27.78],[-27.47,28.21],[-27.16,29.04],[-26.79,29.41],[-21.33,32.13],
    [-21.06,32.37],[-20.41,32.68],[-19.21,33.85],[-17.45,35.09],[-15.14,37],[-14.71,37.21],[-14.37,37.21],[-14.12,37],[-12.89,35.05]];
BAILARINA_CAMINHOS = [for (c = [[0:221], [222:258]]) [for (i = c) i]];

module figura2d() { polygon(BAILARINA, BAILARINA_CAMINHOS); }

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

// o palco fica todo do lado de fora do vidro e vai até à barra de reforço (x = -afastamento),
// que lhe fica agarrada a todo o comprimento; centrado na bailarina se couber
function _xc() = min(-16*_k() - _afast(), W/2 - _afast() - _larg()/2);
function _yc() = -_hp()/2 + 0.6;

module palco2d() {
    translate([_xc(), _yc()]) offset(r=1.2) offset(delta=-1.2) square([_larg(), _hp()], center=true);
}

module corpo2d() {
    union() {
        translate([-_afast(), 0]) scale(_k()) figura2d();
        // pulso: liga a mão da figura (afastada) ao gancho
        hull() { translate([-_afast(), NOMINAL*_k()]) circle(W/2); translate([0, NOMINAL*_k()]) circle(W/2); }
        // reforço: a perna de fora do gancho desce até ao palco (como uma barra de ballet);
        // fecha a moldura palco → barra → gancho e alivia o braço e os tornozelos
        osso([-_afast(), NOMINAL*_k()], [-_afast(), _yc()], W/2);
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
