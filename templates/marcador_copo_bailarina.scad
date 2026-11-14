// ── MARCADORES DE COPO — BAILARINA ──
// Silhueta de uma bailarina (desenho original) com o braço erguido: a mão curva-se num gancho
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
// membro com várias articulações e raios a afinar: pts = [[x, y, r], ...]
module membro(pts) { for (i = [0:len(pts)-2]) osso([pts[i][0], pts[i][1]], [pts[i+1][0], pts[i+1][1]], pts[i][2], pts[i+1][2]); }

// curva fechada suave (Catmull-Rom) a passar pelos pontos
function _cr(p0, p1, p2, p3, t) = 0.5 * ((2*p1) + (-p0 + p2)*t + (2*p0 - 5*p1 + 4*p2 - p3)*t*t + (-p0 + 3*p1 - 3*p2 + p3)*t*t*t);
function suave(pts, n=8) = let(L = len(pts))
    [for (i = [0:L-1]) for (j = [0:n-1])
        _cr(pts[(i-1+L)%L], pts[i], pts[(i+1)%L], pts[(i+2)%L], j/n)];

TRONCO = [   // de perfil a três quartos, peito para o copo, cintura fina
    [-10.4, 47.7], [-9.0, 46.5], [-8.5, 44.4], [-8.9, 42.0], [-9.8, 39.4], [-9.9, 37.6],
    [-9.4, 35.8], [-13.8, 35.8], [-13.5, 37.6], [-13.4, 39.4], [-13.9, 42.2], [-14.0, 44.8],
    [-13.4, 46.5], [-12.2, 47.7]];

TUTU = [     // tutu em prato: disco largo e fino, com camadas recortadas por baixo; a ponta
             // do lado do copo chega à barra de reforço (segundo apoio a meio da peça)
    [-12.0, 38.0], [-8.0, 37.7], [-4.6, 37.3], [-1.4, 37.4], [-0.4, 36.6], [-1.8, 35.6],
    [-4.6, 35.1], [-6.4, 34.3], [-8.0, 34.7], [-9.8, 33.6], [-11.8, 34.4], [-13.8, 33.5],
    [-15.8, 34.5], [-17.8, 34.0], [-19.6, 35.1], [-21.6, 35.4], [-23.4, 36.4], [-24.0, 37.4],
    [-22.4, 37.7], [-19.2, 37.6], [-15.8, 37.9]];

module figura2d() {
    offset(r=-0.5) offset(r=0.5) union() {
        // cabeça inclinada para a mão, com o rosto de perfil e o carrapito
        translate([-11.1, 53.5]) circle(2.85);
        hull() { translate([-9.0, 54.6]) circle(0.9); translate([-8.3, 54.9]) circle(0.45); }   // nariz
        translate([-9.4, 52.4]) circle(0.95);                                                     // queixo
        translate([-13.3, 55.4]) circle(1.6);                                                     // carrapito
        membro([[-10.8, 51.0, 1.0], [-11.0, 49.2, 1.05], [-11.3, 47.6, 1.25]]);                 // pescoço comprido
        polygon(suave(TRONCO));
        polygon(suave(TUTU));
        // braço erguido em arco suave; a mão chega ao gancho em (0, 62)
        membro([[-9.6, 46.0, 1.3], [-8.0, 49.8, 1.15], [-6.0, 53.4, 1.0], [-3.6, 57.0, 0.9], [-1.4, 60.2, 0.85], [0, 62, 1.0]]);
        // braço aberto ao lado (à la seconde), a descer e a mão a subir de leve
        membro([[-13.6, 45.6, 1.25], [-16.6, 44.6, 1.1], [-19.6, 43.8, 1.0], [-22.6, 43.8, 0.88], [-24.8, 44.6, 0.75]]);
        membro([[-24.8, 44.6, 0.75], [-26.2, 45.6, 0.62], [-27.2, 46.6, 0.55]]);                // mão e dedos
        // perna de apoio, em pontas: coxa, joelho, barriga da perna, tornozelo, peito do pé em arco
        membro([[-10.6, 35.0, 2.0], [-10.4, 27.0, 1.7], [-10.2, 20.0, 1.2], [-10.3, 14.0, 1.45],
                [-10.1, 8.5, 1.1], [-10.0, 4.6, 0.82], [-9.4, 2.6, 0.8], [-9.6, 0.75, 0.75]]);
        // perna em passé: coxa para fora, joelho dobrado, ponta do pé encostada ao joelho da outra
        membro([[-13.2, 34.8, 1.95], [-16.2, 30.0, 1.6], [-19.6, 25.4, 1.25], [-17.6, 23.2, 1.35],
                [-14.4, 21.6, 1.0], [-12.4, 20.8, 0.85], [-10.6, 20.4, 0.75]]);
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

// o palco fica todo do lado de fora do vidro e vai até à barra de reforço (x = -afastamento),
// que lhe fica agarrada a todo o comprimento; centrado na bailarina se couber
function _xc() = min(-13*_k() - _afast(), W/2 - _afast() - _larg()/2);
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
