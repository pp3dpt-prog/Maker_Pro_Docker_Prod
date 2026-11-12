// ── SUPORTE DE TELEMÓVEL DE SECRETÁRIA — PERSONALIZADO (texto/imagem à face, 3MF) ──
//
// Suporte clássico para pousar na mesa: base, lábio à frente, ranhura para o telemóvel, encosto
// inclinado para trás e reforço por trás. O perfil (vista de lado) está em XY — x para trás a
// partir da frente, y para cima — e é extrudido pela largura em z: sai deitado de lado, que é como
// se imprime (sem suportes).
//
// Texto ou imagem embutidos À FACE, noutra cor, na frente do encosto (zona "encosto") e/ou na
// frente do lábio (zona "labio"). Sai em 3MF (generation_schema.multicor); o template corre uma
// vez por parte (modo):
//   "corpo"                  suporte com os rebaixos
//   "encosto" / "labio"      enchimento de cada zona (rente à face)
//   "encosto_solta" / "labio_solta"  sem AMS: o enchimento deitado na mesa, um pouco mais pequeno
//                            (folga_embutido) para imprimir noutra cor e colar no rebaixo
// (sem modo: tudo, com cores — só para ver no OpenSCAD).
// Do servidor: esc_texto_encosto / esc_texto_labio (lib/textFit.js) e encosto_pts / encosto_paths
//   / tem_encosto, labio_pts / labio_paths / tem_labio (lib/logo.js).
// Se mudares as fórmulas, muda também Maker_Pro_Frontend_Prod/lib/suportesTelemovelExtra.ts.

function _b(v, d) = is_undef(v) ? d : (v == true || v == 1 || v == "true");
function _W()   = is_undef(largura) ? 75 : largura;
function _a()   = is_undef(angulo) ? 22 : angulo;
function _Le()  = is_undef(altura_encosto) ? 110 : altura_encosto;
function _e()   = is_undef(espessura) ? 6 : espessura;
function _g()   = is_undef(espessura_telemovel) ? 12 : espessura_telemovel;
function _hl()  = max(_e() + 3, is_undef(altura_labio) ? 16 : altura_labio);
function _ref() = is_undef(reforco) ? "Inteiro" : reforco;
function _rc()  = _b(is_undef(ranhura_cabo) ? undef : ranhura_cabo, true);
function _wr()  = is_undef(largura_ranhura) ? 12 : largura_ranhura;

function _x0() = _e() + _g();                                        // frente do encosto, junto à base
function _V()  = [sin(_a()), cos(_a())];                             // ao longo do encosto, para cima
function _Nb() = [cos(_a()), -sin(_a())];                            // normal de trás do encosto
function _F0() = [_x0(), _e()];
function _Pk() = _F0() + 0.6 * _Le() * _V() + _e() * _Nb();          // onde o reforço toca no encosto
function _Lb() = max(is_undef(profundidade_base) ? 90 : profundidade_base,
                     _x0() + 0.75 * _Le() * sin(_a()) + _e() * cos(_a()) + _e(), _Pk()[0] + _e());

module perfil() {
    e = _e(); Lb = _Lb(); F0 = _F0(); V = _V(); Nb = _Nb(); Le = _Le();
    square([Lb, e]);                                                 // base
    square([e, _hl()]);                                              // lábio
    polygon([F0, F0 + Le * V, F0 + Le * V + e * Nb, F0 + e * Nb]);   // encosto
    if (_ref() == "Inteiro") polygon([F0, _Pk(), [Lb, e]]);
    else if (_ref() == "Barra") {
        Q = [Lb - 0.75 * e, e / 2]; d = (Q - _Pk()) / norm(Q - _Pk()); np = [-d[1], d[0]];
        polygon([_Pk() + e / 2 * np, Q + e / 2 * np, Q - e / 2 * np, _Pk() - e / 2 * np]);
    }
}

module suporte() {
    W = _W();
    difference() {
        linear_extrude(height = W) perfil();
        if (_rc())                                                   // ranhura do cabo (pelo lábio e pelo fundo)
            translate([-1, -1, (W - _wr()) / 2]) cube([_x0() + 1, _hl() + 2, _wr()]);
    }
}

// ══ personalização: texto/imagem à face ══
MARG = 4;                                                            // margem às arestas da largura (mm)
MV = 1;                                                              // margem às arestas em altura (mm)
function _modo()  = is_undef(modo) ? "tudo" : modo;
function _fonte() = is_undef(fonte) ? "Open Sans" : fonte;
function _dp()    = max(0.4, min(is_undef(profundidade_embutido) ? 1 : profundidade_embutido, _e() - 1.5));
function _conteudo(z) = z == "encosto" ? (is_undef(conteudo_encosto) ? "Texto" : conteudo_encosto)
                                       : (is_undef(conteudo_labio) ? "Nada" : conteudo_labio);
function _texto(z) = z == "encosto" ? (is_undef(texto_encosto) ? "pp3d" : texto_encosto) : (is_undef(texto_labio) ? "" : texto_labio);
function _tam(z)   = z == "encosto" ? (is_undef(tamanho_texto_encosto) ? 12 : tamanho_texto_encosto) : (is_undef(tamanho_texto_labio) ? 8 : tamanho_texto_labio);
function _esc(z)   = let(v = z == "encosto" ? (is_undef(esc_texto_encosto) ? 1 : esc_texto_encosto) : (is_undef(esc_texto_labio) ? 1 : esc_texto_labio)) max(0.05, min(1, v));
function _tem_img(z) = z == "encosto" ? (!is_undef(tem_encosto) && tem_encosto == true && !is_undef(encosto_pts) && len(encosto_pts) >= 3)
                                      : (!is_undef(tem_labio) && tem_labio == true && !is_undef(labio_pts) && len(labio_pts) >= 3);
function _ativa(z) = _conteudo(z) == "Texto" ? len(_texto(z)) > 0 : _conteudo(z) == "Imagem" ? _tem_img(z) : false;

// ── imagem com as cores próprias (cores_imagem_<zona> = "Cores da imagem"): uma peça por cor ──
// Do servidor (lib/logo.js + lib/imagemCores.js): <zona>_c<i>_pts / <zona>_c<i>_paths, i = 1..6,
// sem sobreposições entre cores; <zona>_pts passa a ser a união das cores (o rebaixo).
// Modos "<zona>_c<i>" (enchimento da cor i) e "<zona>_c<i>_solta" (sem AMS, para colar).
NC = 6;
function _nz(v) = is_undef(v) ? [] : v;
function _cores(z) = z == "encosto" ? (is_undef(cores_imagem_encosto) ? "Uma cor" : cores_imagem_encosto) : (is_undef(cores_imagem_labio) ? "Uma cor" : cores_imagem_labio);
function _multi(z) = _conteudo(z) == "Imagem" && _cores(z) == "Cores da imagem";
function _cpts(z, i)   = (z == "encosto" ? [_nz(encosto_c1_pts), _nz(encosto_c2_pts), _nz(encosto_c3_pts), _nz(encosto_c4_pts), _nz(encosto_c5_pts), _nz(encosto_c6_pts)] : [_nz(labio_c1_pts), _nz(labio_c2_pts), _nz(labio_c3_pts), _nz(labio_c4_pts), _nz(labio_c5_pts), _nz(labio_c6_pts)])[i - 1];
function _cpaths(z, i) = (z == "encosto" ? [_nz(encosto_c1_paths), _nz(encosto_c2_paths), _nz(encosto_c3_paths), _nz(encosto_c4_paths), _nz(encosto_c5_paths), _nz(encosto_c6_paths)] : [_nz(labio_c1_paths), _nz(labio_c2_paths), _nz(labio_c3_paths), _nz(labio_c4_paths), _nz(labio_c5_paths), _nz(labio_c6_paths)])[i - 1];
function _tem_cor(z, i) = _multi(z) && _tem_img(z) && len(_cpts(z, i)) >= 3;
function _modo_cor() = let(l = [for (z = ["encosto", "labio"], i = [1 : NC], s = [false, true]) if (_modo() == str(z, "_c", i, s ? "_solta" : "")) [z, i, s]]) len(l) > 0 ? l[0] : undef;

function _sc() = _Le() * max(0, min(100, is_undef(posicao_encosto) ? 70 : posicao_encosto)) / 100;
// face → peça: (u, v, w), u = leitura, v = para cima, w para fora da face (rotação própria)
function _M(z) = let(a = _a(), c = cos(a), s = sin(a), W = _W())
    z == "encosto"
    ? let(O = _F0() + _sc() * _V()) [[0, s, -c, O[0]], [0, c, s, O[1]], [1, 0, 0, W / 2], [0, 0, 0, 1]]
    : [[0, 0, -1, 0], [0, 1, 0, _hl() / 2], [1, 0, 0, W / 2], [0, 0, 0, 1]];

// região útil de cada zona, no plano da face (u, v)
module zona(z) {
    W = _W();
    if (z == "encosto")
        translate([-(W / 2 - MARG), MV - _sc()]) square([W - 2 * MARG, _Le() - 2 * MV]);
    else difference() {
        translate([-(W / 2 - MARG), -(_hl() / 2 - MV)]) square([W - 2 * MARG, _hl() - 2 * MV]);
        if (_rc()) translate([-_wr() / 2 - 1, -_hl()]) square([_wr() + 2, 2 * _hl()]);
    }
}

module conteudo2d(z, i = 0) {
    intersection() {
        zona(z);
        if (_conteudo(z) == "Texto")
            scale(_esc(z)) offset(delta = 0.01)
                text(_texto(z), size = _tam(z), font = _fonte(), halign = "center", valign = "center", $fn = 16);
        else if (_conteudo(z) == "Imagem" && _tem_img(z)) {
            if (i > 0) polygon(points = _cpts(z, i), paths = _cpaths(z, i));
            else if (z == "encosto") polygon(points = encosto_pts, paths = encosto_paths);
            else polygon(points = labio_pts, paths = labio_paths);
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
        suporte();
        for (z = ["encosto", "labio"]) if (_ativa(z)) na_face(z, -_dp(), 0.5);
    }
}

if (_modo() == "corpo") corpo();
else if (_modo() == "encosto") enchimento("encosto");
else if (_modo() == "labio") enchimento("labio");
else if (_modo() == "encosto_solta") solta("encosto");
else if (_modo() == "labio_solta") solta("labio");
else if (!is_undef(_modo_cor())) { mc = _modo_cor(); if (mc[2]) solta(mc[0], mc[1]); else enchimento_cor(mc[0], mc[1]); }
else {
    color(is_undef(cor_suporte) ? "#111111" : cor_suporte) corpo();
    color(is_undef(cor_encosto) ? "#FFFFFF" : cor_encosto) enchimento("encosto");
    color(is_undef(cor_labio) ? "#FFFFFF" : cor_labio) enchimento("labio");
    for (z = ["encosto", "labio"], i = [1 : NC]) color(["#E11D48", "#2563EB", "#16A34A", "#F59E0B", "#7C3AED", "#0EA5E9"][i - 1]) enchimento_cor(z, i);
}
