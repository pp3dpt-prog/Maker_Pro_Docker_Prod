
// ── CASINHA LANTERNA ──
// Casinha oca, aberta em baixo, para pôr por cima de uma vela LED: paredes com janelas de
// 4 vidros e porta em arco, telhado de duas águas com beiral e chaminé. Feita de placas
// (frente, trás, lados, águas do telhado), impressa de pé, sem suportes: o telhado a ≥ 40°,
// as janelas e a porta são pontes curtas.
// Parâmetros: largura, profundidade, altura (das paredes), inclinacao (do telhado, graus),
//   janelas (por lado), chamine, parede (espessura)
function _W()  = _cl(is_undef(largura) ? 60 : largura, 40, 160);
function _P()  = _cl(is_undef(profundidade) ? 50 : profundidade, 30, 160);
function _Hw() = _cl(is_undef(altura) ? 50 : altura, 25, 160);
function _th() = _cl(is_undef(inclinacao) ? 45 : inclinacao, 40, 60);
function _nj() = round(_cl(is_undef(janelas) ? 2 : janelas, 0, 4));
function _ch() = _sim(is_undef(chamine) ? true : chamine);
function _t()  = _cl(is_undef(parede) ? 2 : parede, 1.2, 4);
function _Hr() = _W() / 2 * tan(_th());          // altura do telhado (por baixo)
function _tr() = _t() + 0.4;                      // espessura do telhado
BEIRAL = 2.5;

// janela de 4 vidros centrada em (x, z): os 4 vidros são os buracos
module janela(x, z, w, h) {
    b = max(1.2, 0.09 * w);
    for (sx = [-1, 1], sz = [-1, 1])
        translate([x + (sx < 0 ? -w / 2 : b / 2), z + (sz < 0 ? -h / 2 : b / 2)]) square([w / 2 - b / 2, h / 2 - b / 2]);
}
module porta(w, h) {
    translate([-w / 2, -1]) square([w, h - w / 2 + 1]);
    translate([0, h - w / 2]) circle(d = w, $fn = 48);
}
// frente (com porta) e trás: pentágono com janelas e um óculo na empena
module empena(frente) {
    W = _W(); Hw = _Hw(); Hr = _Hr();
    jw = min(0.2 * W, 0.34 * Hw); jh = 0.36 * Hw;
    difference() {
        polygon([[-W / 2, 0], [W / 2, 0], [W / 2, Hw], [0, Hw + Hr], [-W / 2, Hw]]);
        if (frente) {
            porta(min(0.24 * W, 0.4 * Hw), 0.62 * Hw);
            if (W >= 45) for (s = [-1, 1]) janela(s * 0.31 * W, 0.56 * Hw, jw, jh);
        } else if (_nj() > 0) {
            for (i = [1 : _nj()]) janela(-W / 2 + W * i / (_nj() + 1), 0.55 * Hw, min(jw, 0.7 * W / (_nj() + 1)), jh);
        }
        if (Hr > 16) translate([0, Hw + 0.4 * Hr]) circle(r = min(0.16 * Hr, 0.09 * W), $fn = 40);
    }
}
module lado() {
    P = _P(); Hw = _Hw(); n = _nj();
    jw = min(0.7 * P / (n + 1), 0.34 * Hw); jh = 0.36 * Hw;
    difference() {
        translate([-P / 2, 0]) square([P, Hw]);
        if (n > 0) for (i = [1 : n]) janela(-P / 2 + P * i / (n + 1), 0.55 * Hw, jw, jh);
    }
}
// água do telhado (a da direita, +x), perfil no plano XZ
module agua() {
    W = _W(); Hw = _Hw(); Hr = _Hr(); th = _th(); v = _tr() / cos(th);
    A = [W / 2 + BEIRAL * cos(th), Hw - BEIRAL * sin(th)];
    polygon([A, [0, Hw + Hr], [0, Hw + Hr + v], A + [0, v]]);
}
module chamine() {
    W = _W(); Hw = _Hw(); Hr = _Hr(); v = _tr() / cos(_th());
    zr = function(x) Hw + Hr * (1 - x / (W / 2)) + v;
    x1 = 0.22 * W; x2 = x1 + max(6, 0.14 * W);
    translate([0, 0.18 * _P(), 0]) placa_xz(max(6, 0.14 * W))
        polygon([[x1, zr(x1) - 1.5], [x2, zr(x2) - 1.5], [x2, Hw + Hr + v + 0.12 * Hr], [x1, Hw + Hr + v + 0.12 * Hr]]);
}
module casinha() {
    W = _W(); P = _P(); t = _t();
    translate([0, -P / 2 + t / 2, 0]) placa_xz(t) empena(true);
    translate([0, P / 2 - t / 2, 0]) placa_xz(t) empena(false);
    for (s = [-1, 1]) translate([s * (W / 2 - t / 2), 0, 0]) rotate([90, 0, 90]) linear_extrude(height = t, center = true) lado();
    for (m = [0, 1]) mirror([m, 0, 0]) placa_xz(P + 2 * BEIRAL) agua();
    if (_ch()) chamine();
}
casinha();
