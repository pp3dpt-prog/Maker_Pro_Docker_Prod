// ── ESTRELA FACETADA PARA PENDURAR ──
// Estrela de N pontas com a frente em bico (facetas até ao centro) e as costas planas, para
// imprimir deitada sem suportes. Leva uma argola na ponta de cima para o fio.
// A mesma conta está em Maker_Pro_Frontend_Prod/lib/decoracao.ts (pré-visualização).
//
// Parâmetros: pontas, raio (mm, ponta), interior (% do raio), altura_relevo, base (mm),
//   argola (true/false), diametro_argola (furo, mm), arredondar (raio das pontas, mm — para não
//   magoar; 0 = em bico)

function _np() = is_undef(pontas) ? 5 : max(3, round(pontas));
function _R()  = is_undef(raio) ? 40 : raio;
function _ri() = _R() * (is_undef(interior) ? 45 : interior) / 100;
function _hr() = is_undef(altura_relevo) ? 8 : altura_relevo;
function _b()  = is_undef(base) ? 2 : base;
function _arg() = is_undef(argola) || argola == true || argola == 1;
function _da() = is_undef(diametro_argola) ? 5 : diametro_argola;

function _rp() = max(0, is_undef(arredondar) ? 1.5 : arredondar);
function _vert(i) = let(a = 90 + i * 180 / _np(), r = (i % 2 == 0) ? _R() : _ri()) [r * cos(a), r * sin(a)];
// meio ângulo da ponta (graus) e quanto a ponta recua quando se arredonda
function _meio() = let(P = _vert(0), Q = _vert(1), u = (Q - P) / norm(Q - P)) acos(-P * u / norm(P));
function _recuo() = _rp() > 0 ? _rp() / sin(_meio()) - _rp() : 0;
NARCO = 8;                                         // segmentos do arco de cada ponta
// contorno 2D: nas pontas (i par) um arco de raio _rp() tangente às duas arestas
function _contorno() = [for (i = [0 : 2 * _np() - 1]) each
    (i % 2 == 1 || _rp() <= 0) ? [_vert(i)] :
    let(P = _vert(i), dir = P / norm(P), m = _meio(), c = P - dir * (_rp() / sin(m)), a0 = atan2(dir[1], dir[0]),
        abre = 90 - m)                              // o arco vai de a0 − (90 − m) a a0 + (90 − m)
    [for (k = [0 : NARCO]) let(a = a0 - abre + 2 * abre * k / NARCO) c + _rp() * [cos(a), sin(a)]]];

module estrela() {
    L = _contorno(); M = len(L);
    pts = concat([for (q = L) [q[0], q[1], 0]], [for (q = L) [q[0], q[1], _b()]],
                 [[0, 0, 0], [0, 0, _b() + _hr()]]);
    C = 2 * M; A = C + 1;
    faces = concat(
        [for (i = [0 : M - 1]) [C, (i + 1) % M, i]],                                         // costas
        [for (i = [0 : M - 1], t = [[i, (i + 1) % M, M + (i + 1) % M], [i, M + (i + 1) % M, M + i]]) t],   // lados
        [for (i = [0 : M - 1]) [A, M + i, M + (i + 1) % M]]                                  // facetas
    );
    polyhedron(points = pts, faces = [for (f = faces) [f[2], f[1], f[0]]], convexity = 3);
}

module argola() {
    ri = _da() / 2; ro = ri + 2.4;
    translate([0, _R() - _recuo() + ri + 0.3, 0])        // encostada à ponta (arredondada) de cima
        linear_extrude(height = max(_b(), 2))
            difference() { circle(r = ro, $fn = 48); circle(r = ri, $fn = 48); }
}

union() {
    estrela();
    if (_arg()) argola();
}
