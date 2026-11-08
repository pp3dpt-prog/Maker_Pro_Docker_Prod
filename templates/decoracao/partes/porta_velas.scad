// ── PORTA-VELAS (velas de chá / tealight) ──
// Peça baixa com a cavidade da vela em cima e textura à volta. Por omissão a cavidade é para
// tealights normais (38 mm × 16 mm, com folga). A largura e a altura sobem sozinhas se forem
// pequenas demais para a vela (mínimo 3 mm de parede e 3 mm de fundo).
//
// Parâmetros: forma (Redonda, Hexagonal, Flor), largura, altura, textura, tamanho_textura,
//   profundidade, diametro_vela, profundidade_vela

function _forma() = is_undef(forma) ? "Redonda" : forma;
function _dv()    = is_undef(diametro_vela) ? 39.5 : diametro_vela;
function _pv()    = is_undef(profundidade_vela) ? 17 : profundidade_vela;
function _fmin()  = _forma() == "Flor" ? 0.82 : 1;
function _L()     = max(is_undef(largura) ? 70 : largura, (_dv() + 6) / _fmin());
function _H()     = max(is_undef(altura) ? 30 : altura, _pv() + 3);
function _tex()   = is_undef(textura) ? "Riscas" : textura;
function _lam()   = is_undef(tamanho_textura) ? 6 : max(1, tamanho_textura);
function _A()     = is_undef(profundidade) ? 0.8 : profundidade;
function _solido() = false;
function _passo()  = _prev() ? 1.2 : 0.6;
function _passo_int() = _prev() ? 10 : 5;
NA_modelo = 360;
function _r_ciclos() = _L() / 2;

function forma0(a) =
    _forma() == "Hexagonal" ? r_hex(a, _L() / 2)
  : _forma() == "Flor"      ? _L() / 2 * (0.91 + 0.09 * cos(8 * a))
  : _L() / 2;

function r_ext(a, z) = forma0(a) + desloc(a, z);
function r_int(a, z) = _dv() / 2;
function z_topo(a)   = _H();
function _fi()       = _H() - _pv();

superficie();
