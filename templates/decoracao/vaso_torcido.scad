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
