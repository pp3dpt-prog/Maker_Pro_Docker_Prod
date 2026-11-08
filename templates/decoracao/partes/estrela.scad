// ── ESTRELA FACETADA PARA PENDURAR ──
// Estrela de N pontas com a frente em bico (facetas até ao centro) e as costas planas, para
// imprimir deitada sem suportes. Leva uma argola na ponta de cima para o fio.
// A mesma conta está em Maker_Pro_Frontend_Prod/lib/decoracao.ts (pré-visualização).
//
// Parâmetros: pontas, raio (mm, ponta), interior (% do raio), altura_relevo, base (mm),
//   argola (true/false), diametro_argola (furo, mm)

function _np() = is_undef(pontas) ? 5 : max(3, round(pontas));
function _R()  = is_undef(raio) ? 40 : raio;
function _ri() = _R() * (is_undef(interior) ? 45 : interior) / 100;
function _hr() = is_undef(altura_relevo) ? 8 : altura_relevo;
function _b()  = is_undef(base) ? 2 : base;
function _arg() = is_undef(argola) || argola == true || argola == 1;
function _da() = is_undef(diametro_argola) ? 5 : diametro_argola;

function _pt(i, z) = let(a = 90 + i * 180 / _np(), r = (i % 2 == 0) ? _R() : _ri()) [r * cos(a), r * sin(a), z];

module estrela() {
    M = 2 * _np();
    pts = concat([for (i = [0 : M - 1]) _pt(i, 0)], [for (i = [0 : M - 1]) _pt(i, _b())],
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
    translate([0, _R() + ri + 0.3, 0])
        linear_extrude(height = max(_b(), 2))
            difference() { circle(r = ro, $fn = 48); circle(r = ri, $fn = 48); }
}

union() {
    estrela();
    if (_arg()) argola();
}
