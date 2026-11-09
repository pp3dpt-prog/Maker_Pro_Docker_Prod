
// ── CENA DE NATAL COM LUZ ──
// Moldura (círculo, estrela ou arco) com uma cena em silhueta lá dentro, e uma base com
// ranhura onde a moldura encaixa de pé e uma cavidade para uma vela LED por trás.
// As duas peças imprimem-se deitadas, lado a lado, sem suportes.
// Parâmetros: moldura, cena, largura, espessura, diametro_vela, pecas ("Moldura e base" | "Só a moldura" | "Só a base")
function _idx(lista, nome) = let(i = [for (j = [0 : len(lista) - 1]) if (lista[j][0] == nome) j]) len(i) ? i[0] : 0;
function _M()  = NATAL_MOLDURAS[_idx(NATAL_MOLDURAS, is_undef(moldura) ? "Círculo" : moldura)];
function _C()  = NATAL_CENAS[_idx(NATAL_CENAS, is_undef(cena) ? "Renas" : cena)];
function _W()  = _cl(is_undef(largura) ? 120 : largura, 70, 220);
function _e()  = _cl(is_undef(espessura) ? 4 : espessura, 2.4, 8);
function _dv() = _cl(is_undef(diametro_vela) ? 39.5 : diametro_vela, 30, 60);
function _pecas() = is_undef(pecas) ? "Moldura e base" : pecas;
function _k()  = _W() / _M()[3];
// onde vai a cena dentro de cada moldura: [altura do chão (fração da altura), largura (fração)]
function _pos(n) = n == "Estrela" ? [0.18, 0.56] : n == "Arco" ? [4 / 96, 68 / 76] : [0.13, 0.86];

module arte2d() {
    M = _M(); C = _C(); p = _pos(M[0]);
    sc = p[1] * M[3] / 100;
    offset(delta = 0.001) scale(_k()) {   // o offset limpa vértices quase repetidos (senão o CGAL recusa a malha)
        difference() { forma2d([M[1]]); forma2d([M[2]]); }
        intersection() { forma2d([M[2]]); translate([0, p[0] * M[4] + 3 * sc]) scale(sc) forma2d(C[1]); }
    }
}
// medidas da base
function _hb() = 9;
function _prof() = 4;
function _Db() = _dv() + _e() + 19;
function _Wb() = max(_M()[0] == "Arco" ? _W() + 12 : 0.8 * _W(), _dv() + 16);   // o arco assenta em toda a largura
function _ys() = -_Db() / 2 + 10;
function _vela() = [0, _ys() + _e() / 2 + 3 + _dv() / 2];

// a ranhura segue só o contorno de fora da moldura (os recortes da cena criavam fiapos)
module base() { base_vela(_Wb(), _Db(), _hb(), _prof(), _ys(), _e(), [_vela()], _dv()) scale(_k()) forma2d([_M()[1]]); }

module cena_led() {
    p = _pecas();
    if (p != "Só a base") linear_extrude(height = _e()) arte2d();
    if (p != "Só a moldura") translate([0, p == "Só a base" ? 0 : -_Db() / 2 - 8, 0]) base();
}
cena_led();
