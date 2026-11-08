// ── ÁRVORE EM ESPIRAL ──
// Cone com secção em estrela (4 a 12 pontas) que roda ao subir. Sólida, para imprimir em modo
// vaso (spiralize), ou oca por baixo para pôr por cima de uma vela LED.
//
// Parâmetros: pontas, raio, altura, profundidade (% das pontas), torcao (graus), arredondar
//   (0 = pontas vivas … 1 = onduladas), curvatura (perfil: <1 cheio, >1 esguio), base_arvore,
//   parede, estrela_topo, tamanho_estrela

function _np() = is_undef(pontas) ? 6 : max(3, round(pontas));
function _R()  = is_undef(raio) ? 45 : raio;
function _H()  = is_undef(altura) ? 150 : altura;
function _p()  = (is_undef(profundidade) ? 30 : profundidade) / 100;
function _tw() = is_undef(torcao) ? 180 : torcao;
function _s()  = is_undef(arredondar) ? 0.3 : min(1, max(0, arredondar));
function _c()  = is_undef(curvatura) ? 1 : curvatura;
function _t()  = is_undef(parede) ? 2 : parede;
function _oco() = !is_undef(base_arvore) && base_arvore == "Oca por baixo (vela LED)";
function _NA() = 240;
function _topo_alt() = _H();
function _r_max() = _R();

function perfil(z)  = let(u = min(1, z / _H())) 1.5 + (_R() - 1.5) * pow(1 - u, _c());
function dperfil(z) = let(u = min(0.999, z / _H())) (_R() - 1.5) * _c() * pow(1 - u, _c() - 1) / _H();
function forma(a) = let(m = ((_np() * a) % 360 + 360) % 360, w = abs(m - 180) / 180)   // 1 nas pontas, 0 nos vales
    (1 - _s()) * w + _s() * (0.5 + 0.5 * cos(_np() * a));
function r_at(a, z) = perfil(z) * (1 - _p() * (1 - forma(a - _tw() * z / _H())));

function _zrows()  = let(K = max(24, ceil(_H() / (_prev() ? 3 : 1.5)))) [for (k = [0 : K]) _H() * k / K];
function _zirows() = let(K = max(8, ceil(_H() / 4))) [for (k = [0 : K]) _H() * k / K];
// cavidade: cone dentro dos vales, com a parede corrigida pela inclinação do perfil e da torção
function rc_at(z) = z > _H() - 6 ? -1 :
    let(rv = perfil(z) * (1 - _p()), d = dperfil(z) * (1 - _p()), ti = rv * _tw() * PI / 180 / _H())
    rv - _t() * sqrt(1 + d * d + ti * ti);

function _linha(z) = 0;
function r_at_linha(a, z, c) = r_at(a, z);

arvore();
