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
