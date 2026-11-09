
// ── ÁRVORE DE NATAL COM NOMES ──
// Árvore plana de 4 ramos com um nome em relevo em cada ramo e uma estrela, de pé numa base
// com cavidades para duas velas LED à frente. As duas peças imprimem-se deitadas, sem suportes;
// os nomes ficam por cima (dica: troca de cor na camada em que começam os nomes).
// Parâmetros: nome1..nome4 (de baixo para cima; vazio = sem nome), fonte, largura, espessura,
//   diametro_vela, pecas ("Árvore e base" | "Só a árvore" | "Só a base").
//   esc_nome1..4 (0–1): calculados pelo servidor (lib/textFit.js) para cada nome caber no ramo.
function _W()  = _cl(is_undef(largura) ? 140 : largura, 80, 240);
function _e()  = _cl(is_undef(espessura) ? 4 : espessura, 2.4, 8);
function _dv() = _cl(is_undef(diametro_vela) ? 39.5 : diametro_vela, 30, 60);
function _fonte() = is_undef(fonte) ? "Luckiest Guy" : fonte;
function _pecas() = is_undef(pecas) ? "Árvore e base" : pecas;
function _k() = _W() / 100;
ALT_NOMES = 1.2;
function _nomes() = [is_undef(nome1) ? "Maria" : nome1, is_undef(nome2) ? "João" : nome2,
                     is_undef(nome3) ? "Ana" : nome3, is_undef(nome4) ? "Rui" : nome4];
function _escs() = [is_undef(esc_nome1) ? 1 : esc_nome1, is_undef(esc_nome2) ? 1 : esc_nome2,
                    is_undef(esc_nome3) ? 1 : esc_nome3, is_undef(esc_nome4) ? 1 : esc_nome4];

module arte2d() { offset(delta = 0.001) scale(_k()) forma2d(NATAL_ARVORE); }
module nomes() {
    k = _k(); N = _nomes(); E = _escs();
    for (i = [0 : 3]) if (len(N[i]) > 0) {
        z = NATAL_ARVORE_ZONAS[i];
        translate([z[0] * k, z[1] * k, 0]) text(N[i], size = z[3] * k * E[i], font = _fonte(), halign = "center", valign = "center");
    }
}
function _hb() = 9;
function _prof() = 4;
function _Db() = _dv() + _e() + 19;
function _Wb() = max(0.62 * _W(), 2 * _dv() + 20);
function _ys() = _Db() / 2 - 10;
function _velas() = let(y = _ys() - _e() / 2 - 3 - _dv() / 2, x = max(_dv() / 2 + 3, 0.2 * _W())) [[-x, y], [x, y]];

module base() { base_vela(_Wb(), _Db(), _hb(), _prof(), _ys(), _e(), _velas(), _dv()) arte2d(); }

module arvore_nomes() {
    p = _pecas();
    if (p != "Só a base") {
        linear_extrude(height = _e()) arte2d();
        translate([0, 0, _e() - 0.01]) linear_extrude(height = ALT_NOMES + 0.01) nomes();
    }
    if (p != "Só a árvore") translate([0, p == "Só a base" ? 0 : -_Db() / 2 - 8, 0]) base();
}
arvore_nomes();
