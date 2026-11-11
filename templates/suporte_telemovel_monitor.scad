// ── SUPORTE DE TELEMÓVEL PARA DEBAIXO DO MONITOR ──
//
// Perfil em "C" (placa + aba de cima + lábio de baixo) que aperta, com dois parafusos de cabeça
// serrilhada, a base/pé do monitor; à frente desce uma rampa que acaba numa curva, e um reforço
// triangular (apoio das costas do telemóvel) liga a rampa à placa.
//
// Sai já na orientação de impressão: o perfil deitado na mesa (XY) e extrudido em Z (largura).
// As abas com a rosca fêmea e os parafusos são polyhedrons gerados por fórmula (anéis em volta do
// eixo): só a aba se une à placa, e os parafusos vão num só polyhedron (sem uniões).
//
// Perfil (x para o lado do monitor, y para cima, origem no canto de baixo da face da frente da placa):
//   placa      x 0..placa,              y 0..H   (H = labio + vao + altura_aba)
//   lábio      x 0..placa+compr_labio,  y 0..labio
//   abas       x placa..placa+lado_aba, y H-altura_aba..H  (uma por parafuso, com rosca)
//   rampa      parte do canto de baixo e desce para a frente com angulo_rampa
//   curva      raio_curva (ao eixo da chapa), angulo_curva graus, ponta arredondada
//   reforço    triângulo entre a rampa (a base_reforco mm da placa) e a placa (a altura_reforco)
//
// Parâmetros: peca ("Tudo", "Suporte", "Parafusos"), largura, vao, espessura_placa, espessura_labio,
//   comprimento_labio, altura_aba, lado_aba, num_parafusos (1 ou 2), comprimento_rampa,
//   angulo_rampa, espessura_rampa, raio_curva, angulo_curva, reforco ("Inteiro", "Duas nervuras",
//   "Central", "Sem"), altura_reforco, base_reforco, espessura_nervura, ranhura_cabo,
//   largura_ranhura, diametro_rosca, passo_rosca, folga_rosca, comprimento_parafuso,
//   diametro_cabeca, altura_cabeca.
// As injectadas são lidas por funções, por isso a ordem de injecção é indiferente.
// Se mudares as fórmulas, muda também Maker_Pro_Frontend_Prod/lib/suporteTelemovel.ts.

function _b(v, d) = is_undef(v) ? d : (v == true || v == 1 || v == "true");
function _peca() = is_undef(peca) ? "Tudo" : peca;
function _W()    = is_undef(largura) ? 70 : largura;
function _vao()  = is_undef(vao) ? 50 : vao;
function _tp()   = is_undef(espessura_placa) ? 6.5 : espessura_placa;
function _tl()   = is_undef(espessura_labio) ? 6 : espessura_labio;
function _ll()   = is_undef(comprimento_labio) ? 12 : comprimento_labio;
function _ha()   = is_undef(altura_aba) ? 13 : altura_aba;
function _np()   = (is_undef(num_parafusos) || num_parafusos >= 2) && _W() >= 2 * _lado() + 2 ? 2 : 1;   // 2 só se couberem
function _Lr()   = is_undef(comprimento_rampa) ? 50 : comprimento_rampa;
function _a()    = is_undef(angulo_rampa) ? 18 : angulo_rampa;
function _tr()   = is_undef(espessura_rampa) ? 6 : espessura_rampa;
function _R()    = max(_tr() / 2 + 1, is_undef(raio_curva) ? 13.5 : raio_curva);
function _sw()   = is_undef(angulo_curva) ? 120 : angulo_curva;
function _ref()  = is_undef(reforco) ? "Inteiro" : reforco;
function _ccr()  = cos(_a());
function _bg()   = min(is_undef(base_reforco) ? 25 : base_reforco, _Lr() * _ccr() - 2);
function _hg()   = min(is_undef(altura_reforco) ? 37 : altura_reforco, _H());
function _en()   = is_undef(espessura_nervura) ? 8 : espessura_nervura;
function _rc()   = _b(is_undef(ranhura_cabo) ? undef : ranhura_cabo, false);
function _wr()   = is_undef(largura_ranhura) ? 12 : largura_ranhura;
function _d()    = is_undef(diametro_rosca) ? 12 : diametro_rosca;
function _P()    = is_undef(passo_rosca) ? 2.5 : passo_rosca;
function _fg()   = is_undef(folga_rosca) ? 0.35 : folga_rosca;
function _Ls()   = is_undef(comprimento_parafuso) ? 40 : comprimento_parafuso;
function _Dh()   = is_undef(diametro_cabeca) ? 19 : diametro_cabeca;
function _hh()   = is_undef(altura_cabeca) ? 8 : altura_cabeca;
function _lado() = max(is_undef(lado_aba) ? 25 : lado_aba, _d() + 6);

function _H()    = _tl() + _vao() + _ha();

// ── rosca trapezoidal de 60° (flancos 0,3 do passo, cristas/raízes 0,2), direita ──
function _frac(x) = x - floor(x);
function _prof(u) = u < 0.2 ? 0 : u < 0.5 ? (u - 0.2) / 0.3 : u < 0.7 ? 1 : (1 - u) / 0.3;
function _hd()    = 0.52 * _P();                                     // profundidade do filete
function r_rosca(ang, z, extra) = _d() / 2 - _hd() + _hd() * _prof(_frac(z / _P() - ang / 360)) + extra;

NA = 36;                                                             // segmentos em volta do eixo
function _ang(i) = i * 360 / NA;
function _anel(rf, z) = [for (i = [0 : NA - 1]) let(a = _ang(i), r = rf(a)) [r * cos(a), r * sin(a), z]];

// rectângulo de meios-lados hx, hy com cantos de raio q: distância ao centro no ângulo a
function r_rect(a, hx, hy, q) =
    let(c = abs(cos(a)), s = abs(sin(a)), Cx = hx - q, Cy = hy - q)
    (s * hx / max(c, 1e-9) <= Cy) ? hx / max(c, 1e-9)
  : (c * hy / max(s, 1e-9) <= Cx) ? hy / max(s, 1e-9)
  : let(b = c * Cx + s * Cy) b + sqrt(b * b - (Cx * Cx + Cy * Cy - q * q));

// ── sólidos fechados a partir de anéis (de baixo para cima) + centros das tampas ──
// Vários sólidos num só polyhedron (cascas separadas): o OpenSCAD não precisa de os unir.
function _faces_aneis(M, o) =
    let(B = o + M * NA, T = B + 1, id = function(k, i) o + k * NA + (i % NA))
    concat(
        [for (k = [0 : M - 2], i = [0 : NA - 1], f = [[id(k, i), id(k + 1, i), id(k + 1, i + 1)], [id(k, i), id(k + 1, i + 1), id(k, i + 1)]]) f],
        [for (i = [0 : NA - 1]) [B, id(0, i), id(0, i + 1)]],
        [for (i = [0 : NA - 1]) [T, id(M - 1, i + 1), id(M - 1, i)]]);
module solidos_aneis(lista) {                                      // lista de [aneis, centro_baixo, centro_cima]
    tam = [for (s = lista) len(s[0]) * NA + 2];
    off = [for (j = [0 : len(lista) - 1]) j == 0 ? 0 : sum_ate(tam, j)];
    polyhedron(points = [for (s = lista) each concat([for (r = s[0]) each r], [s[1], s[2]])],
               faces = [for (j = [0 : len(lista) - 1]) each _faces_aneis(len(lista[j][0]), off[j])]);
}
function sum_ate(v, n) = n <= 0 ? 0 : v[n - 1] + sum_ate(v, n - 1);

// ── tubo: anéis de fora e de dentro (de baixo para cima) ──
module tubo(Ro, Ri) {
    Mo = len(Ro); Mi = len(Ri);
    pts = concat([for (r = Ro) each r], [for (r = Ri) each r]);
    O = Mo * NA;
    function io(k, i) = k * NA + (i % NA);
    function ii(k, i) = O + k * NA + (i % NA);
    faces = concat(
        [for (k = [0 : Mo - 2], i = [0 : NA - 1], f = [[io(k, i), io(k + 1, i), io(k + 1, i + 1)], [io(k, i), io(k + 1, i + 1), io(k, i + 1)]]) f],
        [for (k = [0 : Mi - 2], i = [0 : NA - 1], f = [[ii(k, i), ii(k + 1, i + 1), ii(k + 1, i)], [ii(k, i), ii(k, i + 1), ii(k + 1, i + 1)]]) f],
        [for (i = [0 : NA - 1], f = [[io(Mo - 1, i), ii(Mi - 1, i), ii(Mi - 1, i + 1)], [io(Mo - 1, i), ii(Mi - 1, i + 1), io(Mo - 1, i + 1)]]) f],
        [for (i = [0 : NA - 1], f = [[io(0, i), io(0, i + 1), ii(0, i + 1)], [io(0, i), ii(0, i + 1), ii(0, i)]]) f]
    );
    polyhedron(points = pts, faces = faces);
}

// ── aba com rosca fêmea: eixo em z, base em z = 0, centrada em xy ──
function _dz() = _P() / 6;                                           // passo das linhas da rosca
module aba_roscada() {
    h = _lado() / 2; ha = _ha(); ce = 1;                             // ce: chanfro de entrada
    K = max(4, ceil(ha / _dz()));
    Ro = [_anel(function(a) r_rect(a, h, h, 1.5), 0), _anel(function(a) r_rect(a, h, h, 1.5), ha)];
    Ri = [for (k = [0 : K]) let(z = ha * k / K)
            _anel(function(a) r_rosca(a, z, _fg()) + max(0, ce - z) + max(0, ce - (ha - z)), z)];
    tubo(Ro, Ri);
}

// ── parafuso: cabeça serrilhada em baixo (z = 0), rosca para cima, ponta chanfrada ──
function aneis_parafuso(dx, dy) =
    let(Rh = _Dh() / 2, hh = _hh(), L = _Ls(), ch = 0.8, kd = 0.7,
        N = max(12, round(PI * _Dh() / 2.4)),                        // estrias da cabeça
        tri = function(x) 1 - 2 * abs(_frac(x) - 0.5),
        serr = function(a) Rh - kd * tri(a * N / 360),
        zt = hh + L, rtip = _d() / 2 - _hd() - 0.3, K = max(4, ceil(L / _dz())),
        mv = function(R) [for (p = R) p + [dx, dy, 0]])
    [concat(
        [mv(_anel(function(a) serr(a) - ch, 0)), mv(_anel(serr, ch)),
         mv(_anel(serr, hh - ch)), mv(_anel(function(a) serr(a) - ch, hh))],
        [for (k = [0 : K]) let(z = hh + L * k / K)
            mv(_anel(function(a) min(r_rosca(a, z, 0), rtip + (zt - z)), z))]),
     [dx, dy, 0], [dx, dy, zt]];

// ── perfil 2D (sem o reforço) ──
function _n() = [-sin(_a()), cos(_a())];                            // normal para cima da rampa
function _B1() = _Lr() * [-cos(_a()), -sin(_a())];                   // fim da aresta de baixo da rampa
function _E() = _B1() + _tr() / 2 * _n();                            // fim do eixo da rampa
function _C() = _E() - _R() * _n();                                  // centro da curva
function _phi0() = 90 + _a();

module perfil() {
    tp = _tp(); tr = _tr(); n = _n(); R = _R(); C = _C(); sw = _sw(); f0 = _phi0();
    square([tp, _H()]);                                              // placa
    square([tp + _ll(), _tl()]);                                     // lábio
    Bp = [tp, tp * tan(_a())];
    polygon([Bp, _B1(), _B1() + tr * n, Bp + tr * n]);               // rampa
    nseg = max(8, ceil(sw / 4));
    polygon(concat(                                                  // curva
        [for (j = [0 : nseg]) let(f = f0 + sw * j / nseg) C + (R + tr / 2) * [cos(f), sin(f)]],
        [for (j = [nseg : -1 : 0]) let(f = f0 + sw * j / nseg) C + (R - tr / 2) * [cos(f), sin(f)]]));
    translate(C + R * [cos(f0 + sw), sin(f0 + sw)]) circle(d = tr, $fn = 32);   // ponta redonda
}
module perfil_reforco() {
    tp = _tp(); a = _a(); c0 = 0.5 * _tr() / cos(a);
    polygon([[tp / 2, tp / 2 * tan(a) + c0], [tp / 2, _hg()], [-_bg(), -_bg() * tan(a) + c0]]);
}

// ── zonas (em z) das abas e do reforço ──
function _zabas() = _np() == 1 ? [_W() / 2] : [_lado() / 2, _W() - _lado() / 2];

module suporte() {
    W = _W(); tp = _tp(); H = _H();
    difference() {
        union() {
            linear_extrude(height = W) perfil();
            if (_ref() == "Inteiro") linear_extrude(height = W) perfil_reforco();
            else if (_ref() == "Duas nervuras") for (z0 = [0, W - _en()]) translate([0, 0, z0]) linear_extrude(height = _en()) perfil_reforco();
            else if (_ref() == "Central") translate([0, 0, (W - _en()) / 2]) linear_extrude(height = _en()) perfil_reforco();
            for (zc = _zabas())
                translate([tp + _lado() / 2 - 0.5, H - _ha(), zc]) rotate([-90, 0, 0]) aba_roscada();
        }
        if (_rc()) {                                                 // ranhura para o cabo (a meio, pela curva e pela rampa)
            xs = (_ref() == "Sem" || _ref() == "Duas nervuras") ? _Lr() * _ccr() * 0.55 : _bg() + 3;
            translate([-500 - xs, -500, (W - _wr()) / 2]) cube([500, 1000, _wr()]);
        }
    }
}

module parafusos(x0, y0) {
    Rh = _Dh() / 2;
    solidos_aneis([for (k = [0 : _np() - 1]) aneis_parafuso(x0, y0 - k * (2 * Rh + 5))]);
}

if (_peca() == "Suporte") suporte();
else if (_peca() == "Parafusos") parafusos(0, 0);
else {
    suporte();
    parafusos(_tp() + _lado() + 8 + _Dh() / 2, _H() - _Dh() / 2);
}
