// ── DOCK VERTICAL PARA CARREGAR O TELEMÓVEL — PERSONALIZADO (texto/imagem à face, 3MF) ──
//
// Bloco para a mesa com uma ranhura em cima onde o telemóvel fica de pé (ligeiramente inclinado
// para trás) e um furo no fundo da ranhura para a ficha do cabo (USB-C/Lightning): a ficha entra
// por baixo e o cabo sai por um canal no fundo, para trás. O perfil (vista de lado) está em XY —
// x para trás a partir da frente, y para cima — e é extrudido pela largura em z: sai deitado de
// lado, que é como se imprime (sem suportes). A ranhura é aberta dos dois lados (cabe qualquer
// largura de telemóvel); o furo da ficha e o canal do cabo ficam a meio da largura.
//
// Texto ou imagem embutidos À FACE, noutra cor, na frente (zona "frente") e/ou na face inclinada
// de cima, à frente do telemóvel (zona "inclinada"). Sai em 3MF (generation_schema.multicor):
//   "corpo"  dock com os rebaixos      "frente" / "inclinada"  enchimento de cada zona
//   "frente_solta" / "inclinada_solta"  sem AMS: o enchimento deitado na mesa, com folga, para colar
// (sem modo: tudo, com cores — só para ver no OpenSCAD).
// Do servidor: esc_texto_frente / esc_texto_inclinada (lib/textFit.js) e frente_pts / frente_paths
//   / tem_frente, inclinada_pts / inclinada_paths / tem_inclinada (lib/logo.js).
// Se mudares as fórmulas, muda também Maker_Pro_Frontend_Prod/lib/suportesTelemovelExtra.ts.

function _W()  = is_undef(largura) ? 90 : largura;
function _D()  = is_undef(profundidade) ? 75 : profundidade;
function _H()  = is_undef(altura) ? 50 : altura;
function _Hf() = max(8, min(_H() - 5, is_undef(altura_frente) ? 28 : altura_frente));
function _a()  = is_undef(angulo) ? 12 : angulo;
function _g()  = is_undef(espessura_telemovel) ? 12 : espessura_telemovel;
function _ds() = min(_H() - 12, is_undef(profundidade_ranhura) ? 18 : profundidade_ranhura);
function _wf() = is_undef(largura_ficha) ? 13 : largura_ficha;
function _tf() = is_undef(espessura_ficha) ? 8 : espessura_ficha;
function _wc() = min(_wf(), is_undef(diametro_cabo) ? 5 : diametro_cabo);

function _Vp() = [sin(_a()), cos(_a())];                             // eixo do telemóvel, para cima
function _Np() = [cos(_a()), -sin(_a())];                            // normal (para trás)
function _gc() = _g() / (2 * cos(_a()));                             // meia largura da ranhura na horizontal
// ranhura: a meio da profundidade, mas com pelo menos 10 mm de parede atrás e 14 à frente
function _xs() = max(_gc() + 14, min(0.55 * _D(), _D() - _gc() - 10 - _ds() * sin(_a())));
function _B()  = [_xs(), _H()] - _ds() * _Vp();                      // fundo da ranhura (eixo)
function _xf() = _xs() - _gc() - 3;                                  // fim da face inclinada
function _Px() = _B()[0] - _B()[1] * tan(_a());                      // onde o furo da ficha sai em baixo

module bloco() { polygon([[0, 0], [_D(), 0], [_D(), _H()], [_xf(), _H()], [0, _Hf()]]); }
module ranhura() {
    B = _B(); g2 = _g() / 2; Np = _Np(); Vp = _Vp(); L = _ds() + 30;
    polygon([B - g2 * Np, B + g2 * Np, B + g2 * Np + L * Vp, B - g2 * Np + L * Vp]);
}
module furo_ficha() {
    B = _B(); t2 = _tf() / 2; Np = _Np(); Vp = _Vp(); L = (B[1] + 2) / cos(_a());
    polygon([B - t2 * Np + Vp, B + t2 * Np + Vp, B + t2 * Np - L * Vp, B - t2 * Np - L * Vp]);
}
module canal_cabo() { translate([_Px() - _wc() / 2, -1]) square([_D() - _Px() + _wc() / 2 + 1, _wc() + 1]); }

module dock() {
    W = _W();
    difference() {
        linear_extrude(height = W) difference() { bloco(); ranhura(); }
        translate([0, 0, (W - _wf()) / 2]) linear_extrude(height = _wf()) furo_ficha();
        translate([0, 0, (W - _wc()) / 2]) linear_extrude(height = _wc()) canal_cabo();
    }
}

// ══ personalização: texto/imagem à face ══
MARG = 4;                                                            // margem às arestas da largura (mm)
MV = 1;                                                              // margem às arestas em altura (mm)
function _modo()  = is_undef(modo) ? "tudo" : modo;
function _fonte() = is_undef(fonte) ? "Open Sans" : fonte;
function _dp()    = max(0.4, min(is_undef(profundidade_embutido) ? 1 : profundidade_embutido, 3));
function _conteudo(z) = z == "frente" ? (is_undef(conteudo_frente) ? "Texto" : conteudo_frente)
                                      : (is_undef(conteudo_inclinada) ? "Nada" : conteudo_inclinada);
function _texto(z) = z == "frente" ? (is_undef(texto_frente) ? "pp3d" : texto_frente) : (is_undef(texto_inclinada) ? "" : texto_inclinada);
function _tam(z)   = z == "frente" ? (is_undef(tamanho_texto_frente) ? 14 : tamanho_texto_frente) : (is_undef(tamanho_texto_inclinada) ? 10 : tamanho_texto_inclinada);
function _esc(z)   = let(v = z == "frente" ? (is_undef(esc_texto_frente) ? 1 : esc_texto_frente) : (is_undef(esc_texto_inclinada) ? 1 : esc_texto_inclinada)) max(0.05, min(1, v));
function _tem_img(z) = z == "frente" ? (!is_undef(tem_frente) && tem_frente == true && !is_undef(frente_pts) && len(frente_pts) >= 3)
                                     : (!is_undef(tem_inclinada) && tem_inclinada == true && !is_undef(inclinada_pts) && len(inclinada_pts) >= 3);
function _ativa(z) = _conteudo(z) == "Texto" ? len(_texto(z)) > 0 : _conteudo(z) == "Imagem" ? _tem_img(z) : false;

// ── imagem com as cores próprias (cores_imagem_<zona> = "Cores da imagem"): uma peça por cor ──
// Do servidor (lib/logo.js + lib/imagemCores.js): <zona>_c<i>_pts / <zona>_c<i>_paths, i = 1..6,
// sem sobreposições entre cores; <zona>_pts passa a ser a união das cores (o rebaixo).
// Modos "<zona>_c<i>" (enchimento da cor i) e "<zona>_c<i>_solta" (sem AMS, para colar).
NC = 6;
function _nz(v) = is_undef(v) ? [] : v;
function _cores(z) = z == "frente" ? (is_undef(cores_imagem_frente) ? "Uma cor" : cores_imagem_frente) : (is_undef(cores_imagem_inclinada) ? "Uma cor" : cores_imagem_inclinada);
function _multi(z) = _conteudo(z) == "Imagem" && _cores(z) == "Cores da imagem";
function _cpts(z, i)   = (z == "frente" ? [_nz(frente_c1_pts), _nz(frente_c2_pts), _nz(frente_c3_pts), _nz(frente_c4_pts), _nz(frente_c5_pts), _nz(frente_c6_pts)] : [_nz(inclinada_c1_pts), _nz(inclinada_c2_pts), _nz(inclinada_c3_pts), _nz(inclinada_c4_pts), _nz(inclinada_c5_pts), _nz(inclinada_c6_pts)])[i - 1];
function _cpaths(z, i) = (z == "frente" ? [_nz(frente_c1_paths), _nz(frente_c2_paths), _nz(frente_c3_paths), _nz(frente_c4_paths), _nz(frente_c5_paths), _nz(frente_c6_paths)] : [_nz(inclinada_c1_paths), _nz(inclinada_c2_paths), _nz(inclinada_c3_paths), _nz(inclinada_c4_paths), _nz(inclinada_c5_paths), _nz(inclinada_c6_paths)])[i - 1];
function _tem_cor(z, i) = _multi(z) && _tem_img(z) && len(_cpts(z, i)) >= 3;
function _modo_cor() = let(l = [for (z = ["frente", "inclinada"], i = [1 : NC], s = [false, true]) if (_modo() == str(z, "_c", i, s ? "_solta" : "")) [z, i, s]]) len(l) > 0 ? l[0] : undef;

function _Li() = norm([_xf(), _H() - _Hf()]);                        // comprimento da face inclinada
function _Vi() = [_xf(), _H() - _Hf()] / _Li();
// face → peça: (u, v, w), u = leitura, v = para cima, w para fora da face (rotação própria)
function _M(z) = let(W = _W())
    z == "frente"
    ? [[0, 0, -1, 0], [0, 1, 0, _Hf() / 2], [1, 0, 0, W / 2], [0, 0, 0, 1]]
    : let(v = _Vi()) [[0, v[0], -v[1], _xf() / 2], [0, v[1], v[0], (_Hf() + _H()) / 2], [1, 0, 0, W / 2], [0, 0, 0, 1]];

module zona(z) {
    W = _W(); h = z == "frente" ? _Hf() : _Li();
    translate([-(W / 2 - MARG), -(h / 2 - MV)]) square([W - 2 * MARG, h - 2 * MV]);
}

module conteudo2d(z, i = 0) {
    intersection() {
        zona(z);
        if (_conteudo(z) == "Texto")
            scale(_esc(z)) offset(delta = 0.01)
                text(_texto(z), size = _tam(z), font = _fonte(), halign = "center", valign = "center", $fn = 16);
        else if (_conteudo(z) == "Imagem" && _tem_img(z)) {
            if (i > 0) polygon(points = _cpts(z, i), paths = _cpaths(z, i));
            else if (z == "frente") polygon(points = frente_pts, paths = frente_paths);
            else polygon(points = inclinada_pts, paths = inclinada_paths);
        }
    }
}
module na_face(z, w0, w1, i = 0) { multmatrix(_M(z)) translate([0, 0, w0]) linear_extrude(height = w1 - w0) conteudo2d(z, i); }
module enchimento(z) { if (_ativa(z) && !_multi(z)) na_face(z, -_dp(), 0); }
module enchimento_cor(z, i) { if (_tem_cor(z, i)) na_face(z, -_dp(), 0, i); }

function _fe() = max(0, min(0.5, is_undef(folga_embutido) ? 0.15 : folga_embutido));
module solta(z, i = 0) { if (i > 0 ? _tem_cor(z, i) : _ativa(z) && !_multi(z)) linear_extrude(height = _dp()) offset(delta = -_fe()) conteudo2d(z, i); }

module corpo() {
    difference() {
        dock();
        for (z = ["frente", "inclinada"]) if (_ativa(z)) na_face(z, -_dp(), 0.5);
    }
}

if (_modo() == "corpo") corpo();
else if (_modo() == "frente") enchimento("frente");
else if (_modo() == "inclinada") enchimento("inclinada");
else if (_modo() == "frente_solta") solta("frente");
else if (_modo() == "inclinada_solta") solta("inclinada");
else if (!is_undef(_modo_cor())) { mc = _modo_cor(); if (mc[2]) solta(mc[0], mc[1]); else enchimento_cor(mc[0], mc[1]); }
else {
    color(is_undef(cor_suporte) ? "#111111" : cor_suporte) corpo();
    color(is_undef(cor_frente) ? "#FFFFFF" : cor_frente) enchimento("frente");
    color(is_undef(cor_inclinada) ? "#FFFFFF" : cor_inclinada) enchimento("inclinada");
    for (z = ["frente", "inclinada"], i = [1 : NC]) color(["#E11D48", "#2563EB", "#16A34A", "#F59E0B", "#7C3AED", "#0EA5E9"][i - 1]) enchimento_cor(z, i);
}
