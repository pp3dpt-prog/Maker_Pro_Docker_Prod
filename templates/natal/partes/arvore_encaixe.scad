// ── ÁRVORE DE ENCAIXE (duas placas) ──
// Duas silhuetas planas de árvore em camadas que encaixam em cruz: uma tem a ranhura de cima
// até meio, a outra de baixo até meio. Imprimem deitadas, lado a lado, sem suportes.
// A mesma conta está em Maker_Pro_Frontend_Prod/lib/arvoresNatal.ts (pré-visualização).
//
// Parâmetros: niveis, largura, altura, espessura, folga (da ranhura), largura_tronco
//   (0 = sem tronco), altura_tronco, estreitar (% do pescoço face à camada seguinte)

function _N()  = is_undef(niveis) ? 4 : max(1, round(niveis));
function _W()  = is_undef(largura) ? 100 : largura;
function _H()  = is_undef(altura) ? 150 : altura;
function _esp() = is_undef(espessura) ? 3 : espessura;
function _fol() = is_undef(folga) ? 0.3 : folga;
function _s()  = _esp() + _fol();                                        // largura da ranhura
function _tw() = is_undef(largura_tronco) ? 16 : largura_tronco;
function _ht() = is_undef(altura_tronco) ? 15 : altura_tronco;
function _e()  = (is_undef(estreitar) ? 55 : estreitar) / 100;
function _tronco() = _tw() > 0 && _ht() > 0;
function _tw2() = max(_tw() / 2, _s() / 2 + 2);                         // o tronco tem de ser mais largo que a ranhura
function _zt() = _tronco() ? _ht() : 0;
function _hc() = (_H() - _zt()) / _N();
function _w(i) = _W() / 2 * (1 - 0.7 * i / _N());                         // meia-largura da camada i em baixo
function _neck(i) = max(_s() / 2 + 1.5, _e() * _w(i + 1));
function _y(i) = _zt() + i * _hc();
// lado direito, de baixo para cima (o esquerdo é o espelho)
function _direita() = concat(
    _tronco() ? [[_tw2(), 0], [_tw2(), _zt()]] : [],
    [for (i = [0 : _N() - 1], p = i < _N() - 1 ? [[_w(i), _y(i)], [_neck(i), _y(i + 1)]] : [[_w(i), _y(i)]]) p],
    [[0, _H()]]);
function _contorno() = let(d = _direita()) concat(d, [for (k = [len(d) - 2 : -1 : 0]) [-d[k][0], d[k][1]]]);
function _wm() = max(_W() / 2, _tw2());

module placa(ranhura_em_cima) {
    linear_extrude(height = _esp())
        difference() {
            polygon(_contorno());
            if (ranhura_em_cima) translate([-_s() / 2, _H() / 2]) square([_s(), _H()]);
            else translate([-_s() / 2, -1]) square([_s(), _H() / 2 + 1]);
        }
}
translate([-(_wm() + 3), 0, 0]) placa(true);
translate([_wm() + 3, 0, 0]) placa(false);
