// ── SUPERFÍCIE POLAR (comum aos modelos de decoração) ──
// A peça é UM polyhedron gerado por fórmula: parede de fora, rebordo, parede de dentro,
// chão interior e fundo (ou, em modo sólido, parede de fora + tampa + fundo). Não há
// booleanas, por isso gera depressa no servidor. Cada modelo define:
//   r_ext(a, z), r_int(a, z)  distância ao centro (mm) no ângulo a (graus) e altura z
//   z_topo(a)                 altura do rebordo no ângulo a
//   _fi()                     altura do chão interior
//   _H()                      altura máxima (para o número de linhas)
//   _solido()                 true = sem cavidade (para imprimir em "modo vaso")
//   _passo(), _passo_int()    altura de cada linha da malha de fora / de dentro (mm) — a parede de
//                             dentro é lisa, por isso pode ter menos linhas
// A mesma conta está em Maker_Pro_Frontend_Prod/lib/decoracao.ts (pré-visualização).

function _NA() = NA_modelo;                           // colunas (cada modelo define NA_modelo)
function _prev() = !is_undef(modo) && modo == "preview";
function _K()  = max(24, ceil(_H() / _passo()));      // linhas de fora
function _Ki() = max(4, ceil(_H() / _passo_int()));   // linhas de dentro
function _ang(i) = i * 360 / _NA();
function p_ext(i, k) = let(a = _ang(i), z = z_topo(a) * k / _K(), r = r_ext(a, z)) [r * cos(a), r * sin(a), z];
function p_int(i, k) = let(a = _ang(i), z = _fi() + (z_topo(a) - _fi()) * k / _Ki(), r = r_int(a, z)) [r * cos(a), r * sin(a), z];

// faces escritas no sentido contrário aos ponteiros do relógio vistas de fora (como no three.js);
// o OpenSCAD quer o inverso, por isso inverte-se no fim
function _quad(a, b, c, d) = [[a, b, c], [a, c, d]];

module superficie() {
    NA = _NA(); K = _K(); R = K + 1;
    ext = [for (i = [0 : NA - 1], k = [0 : K]) p_ext(i, k)];
    if (_solido()) {
        B = NA * R; T = B + 1;
        pts = concat(ext, [[0, 0, 0], [0, 0, z_topo(0)]]);
        faces = concat(
            [for (i = [0 : NA - 1], k = [0 : K - 1], t = _quad(i * R + k, ((i + 1) % NA) * R + k, ((i + 1) % NA) * R + k + 1, i * R + k + 1)) t],
            [for (i = [0 : NA - 1]) [T, i * R + K, ((i + 1) % NA) * R + K]],
            [for (i = [0 : NA - 1]) [B, ((i + 1) % NA) * R, i * R]]
        );
        polyhedron(points = pts, faces = [for (f = faces) [f[2], f[1], f[0]]], convexity = 4);
    } else {
        Ki = _Ki(); Ri = Ki + 1;
        int = [for (i = [0 : NA - 1], k = [0 : Ki]) p_int(i, k)];
        O = NA * R; B = O + NA * Ri; F = B + 1;
        pts = concat(ext, int, [[0, 0, 0], [0, 0, _fi()]]);
        faces = concat(
            // parede de fora
            [for (i = [0 : NA - 1], k = [0 : K - 1], t = _quad(i * R + k, ((i + 1) % NA) * R + k, ((i + 1) % NA) * R + k + 1, i * R + k + 1)) t],
            // parede de dentro (normais para o centro)
            [for (i = [0 : NA - 1], k = [0 : Ki - 1], t = _quad(O + i * Ri + k, O + i * Ri + k + 1, O + ((i + 1) % NA) * Ri + k + 1, O + ((i + 1) % NA) * Ri + k)) t],
            // rebordo (liga fora → dentro)
            [for (i = [0 : NA - 1], t = _quad(i * R + K, ((i + 1) % NA) * R + K, O + ((i + 1) % NA) * Ri + Ki, O + i * Ri + Ki)) t],
            // chão interior e fundo
            [for (i = [0 : NA - 1]) [F, O + i * Ri, O + ((i + 1) % NA) * Ri]],
            [for (i = [0 : NA - 1]) [B, ((i + 1) % NA) * R, i * R]]
        );
        polyhedron(points = pts, faces = [for (f = faces) [f[2], f[1], f[0]]], convexity = 6);
    }
}
// ── formas (distância ao centro em função do ângulo, em graus) ──
function r_poligono(a, n) =                          // polígono regular com os cantos a 1 (cantos em 0°, 360/n…)
    let(seg = 360 / n, p = ((a % seg) + seg) % seg - seg / 2) cos(180 / n) / cos(p);
function r_quadrado(a, h, q) =                       // quadrado de meio-lado h com cantos de raio q
    let(c = abs(cos(a)), s = abs(sin(a)), C = h - q)
    (s * h / max(c, 1e-9) <= C) ? h / max(c, 1e-9)
    : (c * h / max(s, 1e-9) <= C) ? h / max(s, 1e-9)
    : let(b = c * C + s * C) b + sqrt(b * b - (2 * C * C - q * q));
function r_hex(a, h) = let(p = ((a + 30) % 60 + 60) % 60 - 30) h / cos(p);   // h = apótema (lados a 0°, 60°…)
// ── texturas (0..1) em função do ângulo e da altura — as mesmas do suporte para bases ──
// Cada modelo define _tex(), _lam() (tamanho), _A() (relevo) e _r_ciclos() (raio para contar ciclos).
function _frac(x) = x - floor(x);
function _tri(x)  = 1 - 2 * abs(_frac(x) - 0.5);
function _ncic()  = max(3, round(2 * PI * _r_ciclos() / _lam()));   // ciclos inteiros: sem costura
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
// a textura desvanece junto ao fundo e ao rebordo (orlas lisas)
function _rampa(v, a, b) = v <= a ? 0 : v >= b ? 1 : let(u = (v - a) / (b - a)) u * u * (3 - 2 * u);
function desloc(a, z) = (_tex() == "Liso") ? 0 : _A() * padrao(a, z) * _rampa(z, 1.2, 3) * _rampa(z_topo(a) - z, 1.2, 3);
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
