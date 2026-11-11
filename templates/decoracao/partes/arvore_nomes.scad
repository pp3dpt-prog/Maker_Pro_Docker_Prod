
// ── ÁRVORE DE NATAL COM NOMES ──
// Árvore plana de 2 a 7 ramos com um nome em relevo em cada ramo e uma estrela, de pé numa base
// com cavidades para duas velas LED à frente. As duas peças imprimem-se deitadas, sem suportes;
// os nomes ficam por cima (dica: troca de cor na camada em que começam os nomes).
// Parâmetros: num_ramos (2–7), nome1..nome7 (de baixo para cima; vazio = sem nome), fonte,
//   largura, espessura, diametro_vela, pecas ("Árvore e base" | "Só a árvore" | "Só a base").
//   esc_nome1..7 (0–1): calculados pelo servidor (lib/textFit.js) para cada nome caber no ramo.
// A forma (largura nominal 100 mm, tronco em y = 0) é calculada aqui: ramo i (0 = o de baixo)
//   meia largura 50 − min(9,5; 28,5/(n−1))·i, base a 11 + 24·i, altura 36 (o de cima, triângulo, 40), topo
//   com 30 % da largura; tronco 16 × 14; estrela no cimo. Com 4 ramos é a árvore de antes.
// As zonas dos nomes saem das mesmas contas (o generation_schema tem as larguras úteis e os
// tamanhos por número de ramos, para o ajuste do texto — gerados por scripts/arvore_zonas.mjs).
// Se mudares as contas, muda também Maker_Pro_Frontend_Prod/lib/natalDeco.ts e o script.
function _W()  = _cl(is_undef(largura) ? 140 : largura, 80, 240);
function _e()  = _cl(is_undef(espessura) ? 4 : espessura, 2.4, 8);
function _dv() = _cl(is_undef(diametro_vela) ? 39.5 : diametro_vela, 30, 60);
function _fonte() = is_undef(fonte) ? "Luckiest Guy" : fonte;
function _pecas() = is_undef(pecas) ? "Árvore e base" : pecas;
function _k() = _W() / 100;
function _n() = round(_cl(is_undef(num_ramos) ? 4 : num_ramos, 2, 7));
ALT_NOMES = 1.2;
NOMES_OMISSAO = ["Maria", "João", "Ana", "Rui", "Rita", "Tiago", "Inês"];
function _nome(i) = let(v = [is_undef(nome1) ? undef : nome1, is_undef(nome2) ? undef : nome2, is_undef(nome3) ? undef : nome3,
                             is_undef(nome4) ? undef : nome4, is_undef(nome5) ? undef : nome5, is_undef(nome6) ? undef : nome6,
                             is_undef(nome7) ? undef : nome7][i]) is_undef(v) ? NOMES_OMISSAO[i] : v;
function _esc(i) = let(v = [is_undef(esc_nome1) ? 1 : esc_nome1, is_undef(esc_nome2) ? 1 : esc_nome2, is_undef(esc_nome3) ? 1 : esc_nome3,
                            is_undef(esc_nome4) ? 1 : esc_nome4, is_undef(esc_nome5) ? 1 : esc_nome5, is_undef(esc_nome6) ? 1 : esc_nome6,
                            is_undef(esc_nome7) ? 1 : esc_nome7][i]) v;

// ramo i: [meia largura em baixo, y da base, altura, meia largura em cima]
function ramo(i) = let(n = _n(), hw = 50 - min(9.5, 28.5 / (n - 1)) * i, topo = i == n - 1)
    [hw, 11 + 24 * i, topo ? 40 : 36, topo ? 0 : hw * 0.3];
// zona do nome no ramo i: [cx, cy, largura útil, tamanho da letra] (nominal)
function zona(i) = let(r = ramo(i), tam = 10.5 - 1.5 * i / (_n() - 1), cy = r[1] + 11,
                       meia = r[0] - (r[0] - r[3]) * (cy + tam * 0.55 - r[1]) / r[2])
    [0, cy, round((2 * meia - 8) * 10) / 10, tam];
function estrela_pts(cx, cy, R, r) = [for (i = [0 : 9]) let(a = 90 + i * 36, q = i % 2 ? r : R) [cx + q * cos(a), cy + q * sin(a)]];
module arvore_bruta() {
    translate([-8, 0]) square([16, 14]);
    for (i = [0 : _n() - 1]) let(r = ramo(i))
        polygon(r[3] > 0 ? [[-r[0], r[1]], [r[0], r[1]], [r[3], r[1] + r[2]], [-r[3], r[1] + r[2]]]
                         : [[-r[0], r[1]], [r[0], r[1]], [0, r[1] + r[2]]]);
    let(r = ramo(_n() - 1)) polygon(estrela_pts(0, r[1] + r[2] + 6, 11, 4.8));
}
// arredondada como no gerador: cantos de fora 0,6 mm, de dentro 1,6 mm
module arte2d() {
    scale(_k()) offset(r = -1.6, $fn = 24) offset(r = 1.6, $fn = 24) offset(r = 0.6, $fn = 24) offset(r = -0.6, $fn = 24) arvore_bruta();
}
module nomes() {
    k = _k();
    for (i = [0 : _n() - 1]) if (len(_nome(i)) > 0) {
        z = zona(i);
        translate([z[0] * k, z[1] * k, 0]) text(_nome(i), size = z[3] * k * _esc(i), font = _fonte(), halign = "center", valign = "center");
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
