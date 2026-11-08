// ── VASO TORCIDO ──
// Polígono regular (3 a 12 lados, cantos mais ou menos arredondados) que roda ao subir, com
// bojo (ou cintura, se negativo) a meio. Com "modo_vaso" sai sólido, para fatiar em modo vaso
// (espiral, uma só parede). Sem ele leva parede e fundo com a espessura escolhida.
//
// Parâmetros: lados, raio_base, raio_topo (mm, aos cantos), altura, torcao (graus), bojo (mm),
//   arredondar (0 = cantos vivos … 1 = redondo), parede, fundo, modo_vaso (true/false)

function _n()    = is_undef(lados) ? 6 : max(3, round(lados));
function _rb()   = is_undef(raio_base) ? 40 : raio_base;
function _rt()   = is_undef(raio_topo) ? 55 : raio_topo;
function _H()    = is_undef(altura) ? 150 : altura;
function _tw()   = is_undef(torcao) ? 90 : torcao;
function _bojo() = is_undef(bojo) ? 10 : bojo;
function _s()    = is_undef(arredondar) ? 0.2 : min(1, max(0, arredondar));
function _t()    = is_undef(parede) ? 2 : parede;
function _fd()   = is_undef(fundo) ? 2 : fundo;
function _solido() = !is_undef(modo_vaso) && (modo_vaso == true || modo_vaso == 1);
function _passo()  = _prev() ? 4 : 2;
function _passo_int() = _prev() ? 4 : 2;
NA_modelo = 180;

function perfil(z)  = let(u = z / _H()) _rb() + (_rt() - _rb()) * u + _bojo() * sin(180 * u);
function dperfil(z) = let(u = z / _H()) ((_rt() - _rb()) + _bojo() * PI * cos(180 * u)) / _H();
function forma(a)   = (1 - _s()) * r_poligono(a, _n()) + _s();
function r_base(a, z) = perfil(z) * forma(a - _tw() * z / _H());

function r_ext(a, z) = r_base(a, z);
// parede: o polígono de dentro tem o apótema reduzido da espessura (a parede fica com a espessura
// certa nas faces e nos cantos), corrigida pela inclinação do perfil e da torção
function _tw_incl(z) = perfil(z) * _tw() * PI / 180 / _H();
function _t_ef(z)    = _t() * sqrt(1 + dperfil(z) * dperfil(z) + _tw_incl(z) * _tw_incl(z));
function _apot()     = (1 - _s()) * cos(180 / _n()) + _s();
function r_int(a, z) = (perfil(z) - _t_ef(z) / _apot()) * forma(a - _tw() * z / _H());
function z_topo(a)   = _H();
function _fi()       = _fd();

superficie();
