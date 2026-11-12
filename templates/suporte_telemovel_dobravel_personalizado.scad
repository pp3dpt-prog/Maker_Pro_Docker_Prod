// ── SUPORTE DE TELEMÓVEL DESMONTÁVEL (DE BOLSO) — PERSONALIZADO (texto/imagem à face, 3MF) ──
//
// Quatro placas planas que encaixam umas nas outras (meia-madeira, sem cola nem parafusos): duas
// laterais com o perfil do suporte (base, lábio, ranhura para o telemóvel e encosto inclinado) e
// duas travessas — a da frente faz de lábio e a de trás fecha a base. Desmonta-se e fica plano,
// para levar no bolso ou na mala. Tudo imprime deitado, sem suportes.
//
// A geometria está escrita montada (x para trás a partir da frente, y para cima, z na largura:
// lateral esquerda em z = 0..t, direita em z = W - t..W) e cada peça é depois deitada na mesa
// (_P(peca)) com a face de fora para cima.
//
// Texto ou imagem embutidos À FACE, noutra cor, na frente da travessa da frente (zona "frente")
// e/ou na face de fora das duas laterais (zona "lados" — o mesmo nas duas). Sai em 3MF
// (generation_schema.multicor):
//   "corpo"  as 4 peças com os rebaixos     "frente" / "lados"  enchimento de cada zona
//   "frente_solta" / "lados_solta"  sem AMS: o enchimento deitado na mesa, com folga, para colar
// (sem modo: tudo, com cores — só para ver no OpenSCAD; montado = true mostra-o montado).
// Do servidor: esc_texto_frente (lib/textFit.js; o texto dos lados não é ajustado, só recortado)
//   e frente_pts / frente_paths / tem_frente, lados_pts / lados_paths / tem_lados (lib/logo.js).
// Se mudares as fórmulas, muda também Maker_Pro_Frontend_Prod/lib/suportesTelemovelExtra.ts.

function _W()  = is_undef(largura) ? 80 : largura;
function _t()  = is_undef(espessura) ? 4 : espessura;
function _a()  = is_undef(angulo) ? 20 : angulo;
function _Le() = is_undef(altura_encosto) ? 90 : altura_encosto;
function _g()  = is_undef(espessura_telemovel) ? 12 : espessura_telemovel;
function _hb() = is_undef(altura_travessa) ? 18 : altura_travessa;
function _f()  = is_undef(folga_encaixe) ? 0.25 : folga_encaixe;
OV  = 6;                                                             // travessas: saem 6 mm para fora das laterais
XB0 = 4;                                                             // travessa da frente: a 4 mm da frente
WE  = 12;                                                            // largura do encosto (na lateral)

function _xg0() = 2 * XB0 + _t();                                    // frente da ranhura do telemóvel
function _xg1() = _xg0() + _g();                                     // pé do encosto
function _yf()  = min(6, _hb() - 4);                                 // fundo da ranhura
function _T()   = [_xg1(), _yf()] + _Le() * [sin(_a()), cos(_a())];  // topo do encosto (frente)
function _Tb()  = _T() + WE * [cos(_a()), -sin(_a())];               // topo do encosto (trás)
function _Lb()  = max(_Tb()[0] + 4, _xg1() + 30);                    // comprimento da base
function _xr()  = _Lb() - XB0 - _t();                                // travessa de trás

function _lat_pts() = [[0, 0], [_Lb(), 0], [_Lb(), _hb()], _Tb(), _T(), [_xg1(), _yf()], [_xg0(), _yf()], [_xg0(), _hb()], [0, _hb()]];
module rasgos_lateral() {                                            // de baixo até meia altura da travessa
    for (x = [XB0, _xr()]) translate([x - _f() / 2, -1]) square([_t() + _f(), _hb() / 2 + _f() / 2 + 1]);
}
module perfil_lateral() { difference() { polygon(_lat_pts()); rasgos_lateral(); } }
module perfil_travessa() {                                           // em (z, y); de cima até meia altura
    W = _W(); t = _t(); f = _f();
    difference() {
        translate([-OV, 0]) square([W + 2 * OV, _hb()]);
        for (z0 = [0, W - t]) translate([z0 - f / 2, _hb() / 2 - f / 2]) square([t + f, _hb()]);
    }
}

// peças montadas
module lateral(lado) { translate([0, 0, lado == "esq" ? 0 : _W() - _t()]) linear_extrude(height = _t()) perfil_lateral(); }
module travessa(x0) { translate([x0, 0, 0]) multmatrix([[0, 0, 1, 0], [0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 1]]) linear_extrude(height = _t()) perfil_travessa(); }
// (a matriz troca x com z: o perfil (z, y) fica no plano zy e a espessura vai em x)

// montado → deitado na mesa, face de fora para cima (rotações próprias)
function _P(peca) =
    peca == "lat_esq" ? [[-1, 0, 0, 2 * _Lb() + 8], [0, 1, 0, 0], [0, 0, -1, _t()], [0, 0, 0, 1]]
  : peca == "lat_dir" ? [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, -(_W() - _t())], [0, 0, 0, 1]]
  : peca == "trav_f"  ? [[0, 0, 1, OV], [0, 1, 0, -(_hb() + 8)], [-1, 0, 0, XB0 + _t()], [0, 0, 0, 1]]
  :                     [[0, 0, 1, OV], [0, 1, 0, -2 * (_hb() + 8)], [-1, 0, 0, _xr() + _t()], [0, 0, 0, 1]];
function _montado() = !is_undef(montado) && montado == true;
module colocar(peca) { if (_montado()) children(); else multmatrix(_P(peca)) children(); }

// ══ personalização: texto/imagem à face ══
MARG = 4;                                                            // margem às arestas (mm)
MV = 1;                                                              // margem em altura (travessa)
MF = 9;                                                              // travessa: o texto fica entre as laterais
function _modo()  = is_undef(modo) ? "tudo" : modo;
function _fonte() = is_undef(fonte) ? "Open Sans" : fonte;
function _dp()    = max(0.4, min(is_undef(profundidade_embutido) ? 1 : profundidade_embutido, _t() - 1.5));
function _conteudo(z) = z == "frente" ? (is_undef(conteudo_frente) ? "Texto" : conteudo_frente)
                                      : (is_undef(conteudo_lados) ? "Nada" : conteudo_lados);
function _texto(z) = z == "frente" ? (is_undef(texto_frente) ? "pp3d" : texto_frente) : (is_undef(texto_lados) ? "" : texto_lados);
function _tam(z)   = z == "frente" ? (is_undef(tamanho_texto_frente) ? 10 : tamanho_texto_frente) : (is_undef(tamanho_texto_lados) ? 7 : tamanho_texto_lados);
function _esc(z)   = z == "frente" ? max(0.05, min(1, is_undef(esc_texto_frente) ? 1 : esc_texto_frente)) : 1;
function _tem_img(z) = z == "frente" ? (!is_undef(tem_frente) && tem_frente == true && !is_undef(frente_pts) && len(frente_pts) >= 3)
                                     : (!is_undef(tem_lados) && tem_lados == true && !is_undef(lados_pts) && len(lados_pts) >= 3);
function _ativa(z) = _conteudo(z) == "Texto" ? len(_texto(z)) > 0 : _conteudo(z) == "Imagem" ? _tem_img(z) : false;

// ── imagem com as cores próprias (cores_imagem_<zona> = "Cores da imagem"): uma peça por cor ──
// Do servidor (lib/logo.js + lib/imagemCores.js): <zona>_c<i>_pts / <zona>_c<i>_paths, i = 1..6,
// sem sobreposições entre cores; <zona>_pts passa a ser a união das cores (o rebaixo).
// Modos "<zona>_c<i>" (enchimento da cor i) e "<zona>_c<i>_solta" (sem AMS, para colar).
NC = 6;
function _nz(v) = is_undef(v) ? [] : v;
function _cores(z) = z == "frente" ? (is_undef(cores_imagem_frente) ? "Uma cor" : cores_imagem_frente) : (is_undef(cores_imagem_lados) ? "Uma cor" : cores_imagem_lados);
function _multi(z) = _conteudo(z) == "Imagem" && _cores(z) == "Cores da imagem";
function _cpts(z, i)   = (z == "frente" ? [_nz(frente_c1_pts), _nz(frente_c2_pts), _nz(frente_c3_pts), _nz(frente_c4_pts), _nz(frente_c5_pts), _nz(frente_c6_pts)] : [_nz(lados_c1_pts), _nz(lados_c2_pts), _nz(lados_c3_pts), _nz(lados_c4_pts), _nz(lados_c5_pts), _nz(lados_c6_pts)])[i - 1];
function _cpaths(z, i) = (z == "frente" ? [_nz(frente_c1_paths), _nz(frente_c2_paths), _nz(frente_c3_paths), _nz(frente_c4_paths), _nz(frente_c5_paths), _nz(frente_c6_paths)] : [_nz(lados_c1_paths), _nz(lados_c2_paths), _nz(lados_c3_paths), _nz(lados_c4_paths), _nz(lados_c5_paths), _nz(lados_c6_paths)])[i - 1];
function _tem_cor(z, i) = _multi(z) && _tem_img(z) && len(_cpts(z, i)) >= 3;
function _modo_cor() = let(l = [for (z = ["frente", "lados"], i = [1 : NC], s = [false, true]) if (_modo() == str(z, "_c", i, s ? "_solta" : "")) [z, i, s]]) len(l) > 0 ? l[0] : undef;

// centro do texto nas laterais: a 35 % da altura do encosto, a meio entre o encosto e a parte de trás
function _Cy() = _yf() + 0.35 * (_T()[1] - _yf());
function _Cx() = let(xa = _xg1() + (_Cy() - _yf()) * tan(_a()),
                     xb = _Cy() <= _hb() ? _Lb() : _Lb() - (_Cy() - _hb()) * (_Lb() - _Tb()[0]) / (_Tb()[1] - _hb()))
                 (xa + xb) / 2;
// colocações de cada zona: [matriz face → peça montada, peça, lado (para a região)]
function _col(z) = z == "frente"
    ? [[[[0, 0, -1, XB0], [0, 1, 0, _hb() / 2], [1, 0, 0, _W() / 2], [0, 0, 0, 1]], "trav_f", "frente"]]
    : [[[[-1, 0, 0, _Cx()], [0, 1, 0, _Cy()], [0, 0, -1, 0], [0, 0, 0, 1]], "lat_esq", "esq"],
       [[[1, 0, 0, _Cx()], [0, 1, 0, _Cy()], [0, 0, 1, _W()], [0, 0, 0, 1]], "lat_dir", "dir"]];

module zona(lado) {                                                  // região útil no plano da face (u, v)
    if (lado == "frente") translate([-(_W() / 2 - MF), -(_hb() / 2 - MV)]) square([_W() - 2 * MF, _hb() - 2 * MV]);
    else mirror([lado == "esq" ? 1 : 0, 0]) translate([-_Cx(), -_Cy()]) offset(r = -MARG, $fn = 24) perfil_lateral();
}
module conteudo2d(z, lado, i = 0) {
    intersection() {
        zona(lado);
        if (_conteudo(z) == "Texto")
            scale(_esc(z)) offset(delta = 0.01)
                text(_texto(z), size = _tam(z), font = _fonte(), halign = "center", valign = "center", $fn = 16);
        else if (_conteudo(z) == "Imagem" && _tem_img(z)) {
            if (i > 0) polygon(points = _cpts(z, i), paths = _cpaths(z, i));
            else if (z == "frente") polygon(points = frente_pts, paths = frente_paths);
            else polygon(points = lados_pts, paths = lados_paths);
        }
    }
}
module na_face(z, w0, w1, so_peca = "", i = 0) {
    for (c = _col(z)) if (so_peca == "" || so_peca == c[1])
        colocar(c[1]) multmatrix(c[0]) translate([0, 0, w0]) linear_extrude(height = w1 - w0) conteudo2d(z, c[2], i);
}
module enchimento(z) { if (_ativa(z) && !_multi(z)) na_face(z, -_dp(), 0); }
module enchimento_cor(z, i) { if (_tem_cor(z, i)) na_face(z, -_dp(), 0, "", i); }

function _fe() = max(0, min(0.5, is_undef(folga_embutido) ? 0.15 : folga_embutido));
module solta(z, ic = 0) {
    if (ic > 0 ? _tem_cor(z, ic) : _ativa(z) && !_multi(z)) for (k = [0 : len(_col(z)) - 1])
        translate([k * (_W() + 10), 0]) linear_extrude(height = _dp()) offset(delta = -_fe()) conteudo2d(z, _col(z)[k][2], ic);
}

module peca(nome) {
    colocar(nome) if (nome == "lat_esq") lateral("esq");
                  else if (nome == "lat_dir") lateral("dir");
                  else if (nome == "trav_f") travessa(XB0);
                  else travessa(_xr());
}
module corpo() {
    for (p = ["lat_esq", "lat_dir", "trav_f", "trav_t"])
        difference() {
            peca(p);
            for (z = ["frente", "lados"]) if (_ativa(z)) na_face(z, -_dp(), 0.5, p);
        }
}

if (_modo() == "corpo") corpo();
else if (_modo() == "frente") enchimento("frente");
else if (_modo() == "lados") enchimento("lados");
else if (_modo() == "frente_solta") solta("frente");
else if (_modo() == "lados_solta") solta("lados");
else if (!is_undef(_modo_cor())) { mc = _modo_cor(); if (mc[2]) solta(mc[0], mc[1]); else enchimento_cor(mc[0], mc[1]); }
else {
    color(is_undef(cor_suporte) ? "#111111" : cor_suporte) corpo();
    color(is_undef(cor_frente) ? "#FFFFFF" : cor_frente) enchimento("frente");
    color(is_undef(cor_lados) ? "#FFFFFF" : cor_lados) enchimento("lados");
    for (z = ["frente", "lados"], i = [1 : NC]) color(["#E11D48", "#2563EB", "#16A34A", "#F59E0B", "#7C3AED", "#0EA5E9"][i - 1]) enchimento_cor(z, i);
}
