// ── SUPORTE PARA BASES DE COPOS (com textura nas paredes) ──
//
// Caixa aberta em cima onde as bases de copos encaixam e ficam guardadas, com a mesma forma
// das bases (redonda, quadrada ou hexagonal — iguais às de base_copos.scad), um entalhe à
// frente para as tirar e uma textura nas paredes de fora (como o BumpMesh: o relevo sai da
// parede para fora, por isso o interior não muda e as bases continuam a caber).
//
// A peça inteira é UM polyhedron gerado por fórmula (parede de fora deslocada pela textura,
// rebordo, parede de dentro, fundo): não há booleanas, por isso gera depressa no servidor.
// Cada forma é dada pela distância ao centro em função do ângulo (r_in(a)).
//
// Parâmetros: forma, largura (das bases, mm), altura_base (espessura de cada base com o relevo),
//   folga, parede, fundo, textura, tamanho_textura, profundidade, entalhe (true/false), degrau (mm)
// Leva sempre 6 bases (num_bases só para testes): a altura interior é 6 × altura_base + 1 mm, para
// a última base ficar rente ao topo. O entalhe desce até deixar um degrau baixo à frente
// (omissão 3 mm), para se conseguir tirar a última base sem ela escorregar para fora.
//
// As injectadas são lidas por funções, por isso a ordem de injecção é indiferente.

function _forma() = is_undef(forma) ? "Redonda" : forma;
function _L()     = is_undef(largura) ? 95 : largura;
function _nb()    = is_undef(num_bases) ? 6 : num_bases;
function _hb()    = is_undef(altura_base) ? 4.3 : altura_base;
function _degrau() = is_undef(degrau) ? 3 : degrau;
function _c()     = is_undef(folga) ? 1 : folga;
function _t()     = is_undef(parede) ? 2.4 : parede;
function _f()     = is_undef(fundo) ? 2 : fundo;
function _tex()   = is_undef(textura) ? "Losangos" : textura;
function _lam()   = is_undef(tamanho_textura) ? 8 : tamanho_textura;
function _A()     = (_tex() == "Liso") ? 0 : (is_undef(profundidade) ? 0.9 : profundidade);
function _ent()   = is_undef(entalhe) || entalhe == true || entalhe == 1;

function _Hint()  = _nb() * _hb() + 1;          // altura útil por dentro (1 mm de folga em cima)
function _H()     = _f() + _Hint();

// ── forma: distância ao centro (mm) da parede interior, no ângulo a (graus) ──
function r_quadrado(a, h, q) =                  // quadrado de meio-lado h com cantos de raio q
    let(c = abs(cos(a)), s = abs(sin(a)), C = h - q)
    (s * h / max(c, 1e-9) <= C) ? h / max(c, 1e-9)
    : (c * h / max(s, 1e-9) <= C) ? h / max(s, 1e-9)
    : let(b = c * C + s * C) b + sqrt(b * b - (2 * C * C - q * q));
function r_hex(a, h) = let(p = ((a + 30) % 60 + 60) % 60 - 30) h / cos(p);   // lados a 0°, 60°…
function r_in(a) =
    _forma() == "Quadrada"  ? r_quadrado(a, _L() / 2 + _c(), 8 + _c())
  : _forma() == "Hexagonal" ? r_hex(a, _L() / 2 + _c())
  : _L() / 2 + _c();

// ── entalhe à frente (a = 270°): baixa o topo das paredes até ao degrau, com transição suave ──
function _ang_dist(a, b) = abs(((a - b) % 360 + 540) % 360 - 180);
function entalhe_f(a) = !_ent() ? 0 :
    let(d = _ang_dist(a, 270), al = 22, be = 14)
    d < al ? 1 : d < al + be ? 0.5 + 0.5 * cos(180 * (d - al) / be) : 0;
function z_topo(a) = _H() - entalhe_f(a) * (_Hint() - _degrau());   // no fundo do entalhe: fundo + degrau

// ── texturas (0..1) em função do ângulo (ciclos à volta) e da altura ──
function _frac(x) = x - floor(x);
function _tri(x)  = 1 - 2 * abs(_frac(x) - 0.5);                 // onda triangular 0..1..0
function _ncic()  = max(3, round(2 * PI * (_L() / 2 + _c() + _t()) / _lam()));   // ciclos inteiros: sem costura
function padrao(a, z) =
    let(x = _ncic() * a / 360, y = z / _lam(), p = _tex())
    p == "Riscas"   ? 0.5 + 0.5 * cos(360 * x)
  : p == "Espiral"  ? 0.5 + 0.5 * cos(360 * (x + y * 0.5))
  : p == "Losangos" ? min(_tri(x + y / 2), _tri(x - y / 2))
  : p == "Ondas"    ? 0.5 + 0.5 * cos(360 * y + 90 * sin(360 * x))
  : p == "Bolhas"   ? let(fy = floor(y * 1.15), xx = _frac(x + (fy % 2) * 0.5) - 0.5,
                          yy = _frac(y * 1.15) - 0.5, r2 = (xx * xx + yy * yy) / (0.42 * 0.42))
                      sqrt(max(0, 1 - r2))
  : p == "Tijolo"   ? let(yb = z / (_lam() * 0.55), fy = floor(yb), xb = x + (fy % 2) * 0.5)
                      ((_frac(yb) < 0.16 || _frac(xb) < 0.08) ? 0 : 1)
  : 0;
// a textura desvanece junto ao fundo e ao topo (rebordos lisos)
function _rampa(v, a, b) = v <= a ? 0 : v >= b ? 1 : let(u = (v - a) / (b - a)) u * u * (3 - 2 * u);
function desloc(a, z) = _A() * padrao(a, z) * _rampa(z, 1.2, 3) * _rampa(z_topo(a) - z, 1.2, 3);

// ── malha ──
NA = 360;                                        // colunas (1°)
function _K() = max(12, ceil(_H() / 0.5));       // linhas (~0,5 mm)
function _ang(i) = i * 360 / NA;
function p_ext(i, k) = let(a = _ang(i), z = z_topo(a) * k / _K(), r = r_in(a) + _t() + desloc(a, z)) [r * cos(a), r * sin(a), z];
function p_int(i, k) = let(a = _ang(i), z = _f() + (z_topo(a) - _f()) * k / _K(), r = r_in(a)) [r * cos(a), r * sin(a), z];

module suporte() {
    K = _K(); R = K + 1;
    ext = [for (i = [0 : NA - 1], k = [0 : K]) p_ext(i, k)];
    int = [for (i = [0 : NA - 1], k = [0 : K]) p_int(i, k)];
    O = NA * R;                                  // início dos pontos interiores
    B = 2 * NA * R;                              // centro do fundo (z = 0)
    F = B + 1;                                   // centro do chão interior (z = fundo)
    pts = concat(ext, int, [[0, 0, 0], [0, 0, _f()]]);
    faces = concat(
        // parede de fora
        [for (i = [0 : NA - 1], k = [0 : K - 1]) let(j = (i + 1) % NA)
            [i * R + k, j * R + k, j * R + k + 1, i * R + k + 1]],
        // rebordo de cima (liga fora → dentro)
        [for (i = [0 : NA - 1]) let(j = (i + 1) % NA)
            [i * R + K, j * R + K, O + j * R + K, O + i * R + K]],
        // parede de dentro (normais para o centro)
        [for (i = [0 : NA - 1], k = [0 : K - 1]) let(j = (i + 1) % NA)
            [O + i * R + k, O + i * R + k + 1, O + j * R + k + 1, O + j * R + k]],
        // chão interior
        [for (i = [0 : NA - 1]) let(j = (i + 1) % NA) [F, O + i * R, O + j * R]],
        // fundo
        [for (i = [0 : NA - 1]) let(j = (i + 1) % NA) [B, j * R, i * R]]
    );
    // o OpenSCAD quer as faces no sentido dos ponteiros do relógio vistas de fora: inverte-se a ordem
    polyhedron(points = pts, faces = [for (f = faces) [for (q = [len(f) - 1 : -1 : 0]) f[q]]], convexity = 6);
}

suporte();
