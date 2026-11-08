// ── VASO / PORTA-LÁPIS TEXTURIZADO ──
// Redondo, quadrado ou hexagonal, a abrir ou a fechar para cima, com textura na parede de
// fora (losangos, riscas, espiral, ondas, bolhas ou tijolo). O relevo sai para fora, por isso
// a parede nunca fica mais fina do que o escolhido.
//
// Parâmetros: forma, largura (mm, na base), altura, afunilar (% do topo face à base),
//   textura, tamanho_textura, profundidade, parede, fundo

function _forma() = is_undef(forma) ? "Redonda" : forma;
function _L()     = is_undef(largura) ? 70 : largura;
function _H()     = is_undef(altura) ? 100 : altura;
function _af()    = is_undef(afunilar) ? 100 : afunilar;
function _tex()   = is_undef(textura) ? "Losangos" : textura;
function _lam()   = is_undef(tamanho_textura) ? 8 : max(1, tamanho_textura);
function _A()     = is_undef(profundidade) ? 1 : profundidade;
function _t()     = is_undef(parede) ? 2 : parede;
function _fd()    = is_undef(fundo) ? 2 : fundo;
function _solido() = false;
function _passo()  = _prev() ? 1.6 : 0.8;
function _passo_int() = _prev() ? 10 : 5;
NA_modelo = 360;
function _r_ciclos() = _L() / 2;

function escala(z) = 1 + (_af() / 100 - 1) * z / _H();
// forma na escala e, encolhida d mm para dentro (d = 0: parede de fora)
function forma_e(a, e, d) =
    _forma() == "Quadrada"  ? r_quadrado(a, e * _L() / 2 - d, max(0.5, e * 0.15 * _L() / 2 - d))
  : _forma() == "Hexagonal" ? r_hex(a, e * _L() / 2 - d)
  : e * _L() / 2 - d;
function r_base(a, z) = forma_e(a, escala(z), 0);
function _incl() = (_af() / 100 - 1) * _L() / 2 / _H();

function r_ext(a, z) = r_base(a, z) + desloc(a, z);
function r_int(a, z) = forma_e(a, escala(z), _t() * sqrt(1 + _incl() * _incl()));
function z_topo(a)   = _H();
function _fi()       = _fd();

superficie();
