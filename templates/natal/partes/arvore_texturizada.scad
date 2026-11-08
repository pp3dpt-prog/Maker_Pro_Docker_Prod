// ── ÁRVORE TEXTURIZADA ──
// Cone com relevo: escamas (como um pinheiro), bolas, diamantes ou uma grinalda em espiral.
// O número de células à volta diminui fila a fila, para o desenho não ficar esmagado em cima.
// Sólida ou oca por baixo (para vela LED).
//
// Parâmetros: raio, altura, curvatura, textura, tamanho_textura, relevo, base_arvore, parede,
//   estrela_topo, tamanho_estrela

function _R()   = is_undef(raio) ? 50 : raio;
function _H()   = is_undef(altura) ? 140 : altura;
function _c()   = is_undef(curvatura) ? 1 : curvatura;
function _tex() = is_undef(textura) ? "Escamas" : textura;
function _lam() = is_undef(tamanho_textura) ? 9 : max(3, tamanho_textura);
function _A()   = is_undef(relevo) ? 1.5 : relevo;
function _t()   = is_undef(parede) ? 2 : parede;
function _oco() = !is_undef(base_arvore) && base_arvore == "Oca por baixo (vela LED)";
function _NA()  = 360;
function _topo_alt() = _H();
function _r_max() = _R() + _A();

function perfil(z)  = let(u = min(1, z / _H())) 1.5 + (_R() - 1.5) * pow(1 - u, _c());
function dperfil(z) = let(u = min(0.999, z / _H())) (_R() - 1.5) * _c() * pow(1 - u, _c() - 1) / _H();

function _frac(x) = x - floor(x);
function _rampa(v, a, b) = v <= a ? 0 : v >= b ? 1 : let(u = (v - a) / (b - a)) u * u * (3 - 2 * u);
function _lv() = _lam() * 0.75;                                          // altura de cada fila
function _ncic(z) = max(3, round(2 * PI * perfil(z) / _lam()));          // células à volta (inteiro: sem costura)
function padrao(a, z) =
    let(p = _tex(), y = z / _lv(), fy = floor(y), yy = y - fy,
        x = _ncic((fy + 0.5) * _lv()) * a / 360 + (fy % 2) * 0.5, xx = _frac(x) - 0.5)
    p == "Escamas"   ? let(yb = 0.45 * (1 - sqrt(max(0, 1 - 4 * xx * xx))))
                       (yy < yb ? 0 : (1 - (yy - yb) / (1 - yb)) * _rampa(yy - yb, 0, 0.12))
  : p == "Bolas"     ? sqrt(max(0, 1 - (xx * xx + (yy - 0.5) * (yy - 0.5)) / (0.38 * 0.38)))
  : p == "Diamantes" ? max(0, 1 - 2 * (abs(xx) + abs(yy - 0.5)))
  : p == "Grinalda"  ? let(f = _frac(z / (_lam() * 3) - a / 360) - 0.5, w = 0.3)
                       (abs(f) < w / 2 ? 0.5 + 0.5 * cos(360 * f / w) : 0)
  : 0;
// o relevo desvanece junto ao fundo e acaba 8 mm abaixo da ponta
function desloc(a, z) = _A() * padrao(a, z) * _rampa(z, 1.2, 3) * _rampa(_H() - 8 - z, 0, 6);
function r_at(a, z) = perfil(z) + desloc(a, z);

function _zrows()  = let(K = max(24, ceil(_H() / (_prev() ? 2.4 : 1.2)))) [for (k = [0 : K]) _H() * k / K];
function _zirows() = let(K = max(8, ceil(_H() / 4))) [for (k = [0 : K]) _H() * k / K];
function rc_at(z) = z > _H() - 6 ? -1 : perfil(z) - _t() * sqrt(1 + dperfil(z) * dperfil(z));

function _linha(z) = 0;
function r_at_linha(a, z, c) = r_at(a, z);

arvore();
