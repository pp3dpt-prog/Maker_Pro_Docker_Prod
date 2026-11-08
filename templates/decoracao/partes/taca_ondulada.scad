// ── TAÇA / FRUTEIRA ONDULADA ──
// Taça que abre da base para o topo, com o rebordo em pétalas: ondula em altura e para fora.
// A curvatura é limitada para a inclinação não passar de ~52° (imprime sem suportes).
//
// Parâmetros: diametro_topo, diametro_base, altura, petalas, onda_rebordo (mm, em altura),
//   onda_lateral (mm, para fora), curvatura (1 = cónica … 3 = muito redonda), parede, fundo

function _rt()  = (is_undef(diametro_topo) ? 190 : diametro_topo) / 2;
function _rb()  = (is_undef(diametro_base) ? 90 : diametro_base) / 2;
function _H()   = is_undef(altura) ? 70 : altura;
function _np()  = is_undef(petalas) ? 8 : max(2, round(petalas));
function _or()  = is_undef(onda_rebordo) ? 8 : onda_rebordo;
function _ol()  = is_undef(onda_lateral) ? 6 : onda_lateral;
function _t()   = is_undef(parede) ? 2.2 : parede;
function _fd()  = is_undef(fundo) ? 2.4 : fundo;
function _solido() = false;
function _passo()  = _prev() ? 3 : 1.5;
function _passo_int() = _prev() ? 3 : 1.5;
NA_modelo = 180;
function _cv()  = let(c = is_undef(curvatura) ? 1.6 : curvatura, d = abs(_rt() - _rb()))
                  max(1, min(c, d < 0.01 ? c : 1.3 * _H() / d));

function perfil(z)  = let(u = min(1, z / _H())) _rb() + (_rt() - _rb()) * (1 - pow(1 - u, _cv()));
function dperfil(z) = let(u = min(0.999, z / _H())) (_rt() - _rb()) * _cv() * pow(1 - u, _cv() - 1) / _H();
function r_base(a, z) = perfil(z) + _ol() * pow(min(1, z / _H()), 1.5) * cos(_np() * a);

function r_ext(a, z) = r_base(a, z);
function r_int(a, z) = r_base(a, z) - _t() * sqrt(1 + dperfil(z) * dperfil(z));
function z_topo(a)   = _H() - _or() * (0.5 - 0.5 * cos(_np() * a));
function _fi()       = _fd();

superficie();
