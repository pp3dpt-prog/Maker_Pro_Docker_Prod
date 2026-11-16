// ── SUPORTE DE TELEMÓVEL DE SECRETÁRIA EM DUAS PEÇAS (ENCAIXE) ──
//
// Duas peças que se encaixam na hora de usar: as COSTAS (placa inclinada com o apoio em V e o
// rebordo à frente) entram numa ranhura inclinada da BASE (bloco). Desmontado fica plano para
// guardar ou levar.
// Com ranhura_cabo: abertura a meio do apoio (a ficha desce do telemóvel), arco no fundo das
// costas e canal no topo da base, por onde o cabo passa para trás.
//
// Coordenadas de uso (perfil em XY, largura em Z): x para trás a partir da frente da base,
// y para cima, z na largura. As costas definem-se num referencial próprio (u ao longo da placa,
// a subir; w para trás, perpendicular à placa; frente da placa em w = 0):
//   mundo = B0 + u·V + w·N,  V = (sin a, cos a),  N = (cos a, -sin a)
//   B0 = (xs - dr·tan a, hb - dr)  — canto da frente do fundo das costas, dentro da ranhura
// Apoio (no referencial u,w; d = -w para a frente): seat em u = us, rebordo até us + hl,
// face interior a 45° (V) — imprime-se sem suportes com as costas deitadas.
//
// Saídas (peca): "Tudo" (as duas deitadas para imprimir), "Costas", "Base", "Montado".
// Parâmetros: peca, largura, altura_costas, angulo, altura_apoio, espessura_telemovel,
//   altura_labio, espessura, profundidade_base, altura_base, profundidade_encaixe, folga_encaixe,
//   ranhura_cabo, largura_ranhura.
// Se mudares as fórmulas, muda também Maker_Pro_Frontend_Prod/lib/suporteEncaixe.ts.

function _b(v, d) = is_undef(v) ? d : (v == true || v == 1 || v == "true");
function _peca() = is_undef(peca) ? "Tudo" : peca;
function _W()   = is_undef(largura) ? 80 : largura;
function _Lc()  = is_undef(altura_costas) ? 140 : altura_costas;
function _a()   = is_undef(angulo) ? 20 : angulo;
function _Hs()  = is_undef(altura_apoio) ? 55 : altura_apoio;
function _g()   = is_undef(espessura_telemovel) ? 13 : espessura_telemovel;
function _hl()  = is_undef(altura_labio) ? 10 : altura_labio;
function _e()   = is_undef(espessura) ? 6 : espessura;
function _Db()  = is_undef(profundidade_base) ? 100 : profundidade_base;
function _hb()  = is_undef(altura_base) ? 20 : altura_base;
function _dr0() = is_undef(profundidade_encaixe) ? 12 : profundidade_encaixe;
function _f()   = is_undef(folga_encaixe) ? 0.25 : folga_encaixe;
function _rc()  = _b(is_undef(ranhura_cabo) ? undef : ranhura_cabo, true);
function _wr()  = min(is_undef(largura_ranhura) ? 15 : largura_ranhura, _W() - 20);

// ── derivados (iguais em lib/suporteEncaixe.ts) ──
function _s()  = sin(_a());
function _c()  = cos(_a());
function _pw() = 4;                                                  // paredes dos lados da ranhura
function _el() = max(_e(), 6);                                       // espessura do apoio (ao longo da placa)
function _tt() = 4;                                                  // espessura do topo do rebordo
function _Dl() = _g() + _hl() + _tt();                               // quanto o apoio sai para a frente
function _cg() = 4;                                                  // profundidade do canal do cabo na base
function _dr() = max(4, min(_dr0(), _hb() - 3 - _f() * _c() - (_e() + _f()) * _s()));
function _xs() = max(0.3 * _Db(), 3 + _dr() * tan(_a()) + _f() * (_s() + _c()) + 1);
function _B0() = [_xs() - _dr() * tan(_a()), _hb() - _dr()];
function _ut() = (_hb() - _B0()[1]) / _c();                          // u onde a placa sai da base
function _ha() = _rc() ? _ut() + 14 : 0;                             // altura do arco do cabo (em u)
function _us() = max(min((_Hs() - _B0()[1]) / _c(), _Lc() - _hl() - 10),
                     (_rc() ? _ha() : _ut()) + _el() + 3);
function _D()  = max(_Db(), _B0()[0] + _Lc() * _s() + _e() * _c() + 5);   // a base cobre o topo
function _z0() = (_W() - _wr()) / 2;
function _z1() = (_W() + _wr()) / 2;

// ── perfis 2D ──
module perfil_costas(com_apoio = true) {                             // no referencial (u, w)
    us = _us(); el = _el(); hl = _hl(); g = _g(); Dl = _Dl();
    square([_Lc(), _e()]);
    if (com_apoio)
        polygon([[us - el, 0], [us - el, -Dl], [us + hl, -Dl], [us + hl, -(g + hl)], [us, -g], [us, 0]]);
}
// placa sem apoio e sem o arco (fatia do meio quando há ranhura para o cabo)
module perfil_costas_meio() { translate([_ha(), 0]) square([_Lc() - _ha(), _e()]); }

function _paraMundo(p) = _B0() + p[0] * [_s(), _c()] + p[1] * [_c(), -_s()];
module ranhura_2d() {                                                // a ranhura, já no mundo (x, y)
    f = _f(); L = _Lc();
    polygon([for (p = [[-f, -f], [L, -f], [L, _e() + f], [-f, _e() + f]]) _paraMundo(p)]);
}
module perfil_base(ranhura = true, canal = false) {
    difference() {
        square([_D(), _hb()]);
        if (ranhura) ranhura_2d();
        if (canal) translate([max(3, _xs() - 20), _hb() - _cg()]) square([_D(), _cg() + 1]);
    }
}

// ── peças (no seu referencial) ──
module costas_local() {                                              // u, w, z
    if (_rc()) {
        linear_extrude(height = _z0()) perfil_costas();
        translate([0, 0, _z0()]) linear_extrude(height = _wr()) perfil_costas_meio();
        translate([0, 0, _z1()]) linear_extrude(height = _W() - _z1()) perfil_costas();
    } else linear_extrude(height = _W()) perfil_costas();
}
module base_mundo() {                                                // x, y, z
    pw = _pw(); f = _f(); W = _W();
    translate([0, 0, -pw]) linear_extrude(height = pw - f) perfil_base(false);
    translate([0, 0, W + f]) linear_extrude(height = pw - f) perfil_base(false);
    if (_rc()) {
        translate([0, 0, -f]) linear_extrude(height = _z0() + f) perfil_base();
        translate([0, 0, _z0()]) linear_extrude(height = _wr()) perfil_base(true, true);
        translate([0, 0, _z1()]) linear_extrude(height = W + f - _z1()) perfil_base();
    } else translate([0, 0, -f]) linear_extrude(height = W + 2 * f) perfil_base();
}

// ── colocações ──
module costas_montadas() {
    B = _B0(); s = _s(); c = _c();
    multmatrix([[s, c, 0, B[0]], [c, -s, 0, B[1]], [0, 0, 1, 0], [0, 0, 0, 1]]) costas_local();
}
module costas_imprimir() {                                           // costas para baixo, apoio para cima
    multmatrix([[0, 0, -1, _W()], [1, 0, 0, 0], [0, -1, 0, _e()], [0, 0, 0, 1]]) costas_local();
}
module base_imprimir() {                                             // deitada como em uso
    multmatrix([[0, 0, 1, _pw()], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1]]) base_mundo();
}

if (_peca() == "Costas") costas_imprimir();
else if (_peca() == "Base") base_imprimir();
else if (_peca() == "Montado") { base_mundo(); costas_montadas(); }
else {
    base_imprimir();
    translate([_W() + 2 * _pw() + 10, 0, 0]) costas_imprimir();
}
