
// ── PEÇAS COMUNS AOS MODELOS DE NATAL DA FAMÍLIA "DECORAÇÃO" ──
// A pré-visualização (Maker_Pro_Frontend_Prod/lib/natalDeco.ts) faz as mesmas contas.
// Se mudares alguma coisa aqui, muda também lá.

function _cl(v, a, b) = max(a, min(b, v));
// usar sempre com is_undef antes (o OpenSCAD avisa se se passar uma variável que não existe):
//   _sim(is_undef(x) ? true : x)
function _sim(v) = v == true || v == 1 || v == "true" || v == "1";

// forma 2D a partir de uma lista de contornos (regra par-ímpar: os buracos são contornos dentro)
function _offs(c, i) = i <= 0 ? 0 : _offs(c, i - 1) + len(c[i - 1]);
module forma2d(c) {
    polygon(points = [for (q = c, p = q) p],
            paths = [for (i = [0 : len(c) - 1]) [for (j = [0 : len(c[i]) - 1]) _offs(c, i) + j]]);
}

// placa vertical no plano XZ (a forma 2D tem y para cima), centrada em y, espessura e
module placa_xz(e) { rotate([90, 0, 0]) linear_extrude(height = e, center = true) children(); }

// ── sólido de revolução com relevo: r = rp(k, a, z) ──
// Cada modelo define rp(k, a, z) (k distingue as peças do mesmo modelo). As linhas não são
// igualmente espaçadas: z = H·sin(90·t) aperta-as perto do topo, onde o perfil fecha.
// Fecha em baixo (z = 0) e em cima (z = H) com um leque até ao eixo. O eixo pode desviar-se em x:
// cx(k, z) (cada modelo define-a; 0 = eixo direito).
function _zs(H, t, curva) = curva ? H * sin(90 * t) : H * t;
module solido_polar(k, H, N, K, curva = true) {
    R = K + 1;
    pts = concat(
        [for (i = [0 : N - 1], j = [0 : K]) let(a = i * 360 / N, z = _zs(H, j / K, curva), r = rp(k, a, z)) [cx(k, z) + r * cos(a), r * sin(a), z]],
        [[cx(k, 0), 0, 0], [cx(k, H), 0, H]]);
    B = N * R; T = B + 1;
    faces = concat(
        [for (i = [0 : N - 1], j = [0 : K - 1], f = [[i * R + j, (i + 1) % N * R + j + 1, (i + 1) % N * R + j],
                                                    [i * R + j, i * R + j + 1, (i + 1) % N * R + j + 1]]) f],
        [for (i = [0 : N - 1]) [T, (i + 1) % N * R + K, i * R + K]],
        [for (i = [0 : N - 1]) [B, i * R, (i + 1) % N * R]]);
    polyhedron(points = pts, faces = faces, convexity = 4);
}

// ── casca de revolução aberta em baixo (gorro) ──
// fora: rp(k, a, z), z ∈ [0, H], fechada em cima; dentro: ri(k, z), z ∈ [0, Hi], fechada em cima.
// casca_dados devolve [pontos, faces]; poliedro() junta várias num só polyhedron — corpos
// separados num só polyhedron não precisam de união (CGAL), por isso gera em 1–2 s.
function casca_dados(k, H, Hi, N, K, Ki, inverter = false) = let(
    R = K + 1, Ri = Ki + 1,
    zf = function(z) inverter ? H - z : z,
    fora = [for (i = [0 : N - 1], j = [0 : K]) let(a = i * 360 / N, z = H * j / K, r = rp(k, a, z)) [cx(k, z) + r * cos(a), r * sin(a), zf(z)]],
    dent = [for (i = [0 : N - 1], j = [0 : Ki]) let(a = i * 360 / N, z = Hi * j / Ki, r = ri(k, z)) [cx(k, z) + r * cos(a), r * sin(a), zf(z)]],
    O = N * R, T = O + N * Ri, Ti = T + 1,
    pts = concat(fora, dent, [[cx(k, H), 0, zf(H)], [cx(k, Hi), 0, zf(Hi)]]),
    faces = concat(
        [for (i = [0 : N - 1], j = [0 : K - 1], f = [[i * R + j, (i + 1) % N * R + j + 1, (i + 1) % N * R + j],
                                                    [i * R + j, i * R + j + 1, (i + 1) % N * R + j + 1]]) f],
        [for (i = [0 : N - 1], j = [0 : Ki - 1], f = [[O + i * Ri + j, O + (i + 1) % N * Ri + j, O + (i + 1) % N * Ri + j + 1],
                                                     [O + i * Ri + j, O + (i + 1) % N * Ri + j + 1, O + i * Ri + j + 1]]) f],
        [for (i = [0 : N - 1]) [T, (i + 1) % N * R + K, i * R + K]],
        [for (i = [0 : N - 1]) [Ti, O + i * Ri + Ki, O + (i + 1) % N * Ri + Ki]],
        [for (i = [0 : N - 1], f = [[i * R, (i + 1) % N * R, O + (i + 1) % N * Ri], [i * R, O + (i + 1) % N * Ri, O + i * Ri]]) f])
) [pts, inverter ? [for (f = faces) [f[0], f[2], f[1]]] : faces];
module casca_polar(k, H, Hi, N, K, Ki) { d = casca_dados(k, H, Hi, N, K, Ki); polyhedron(points = d[0], faces = d[1], convexity = 6); }
// junta [pontos, faces] de vários corpos num só polyhedron (desloca[i] = [dx, dy, dz] de cada um)
function _somas(L, i) = i <= 0 ? 0 : _somas(L, i - 1) + len(L[i - 1][0]);
module poliedro(L, desloca) {
    polyhedron(
        points = [for (i = [0 : len(L) - 1], p = L[i][0]) p + desloca[i]],
        faces = [for (i = [0 : len(L) - 1], f = L[i][1]) [for (v = f) v + _somas(L, i)]],
        convexity = 8);
}

// ── base com ranhura e cavidades para velas LED ──
// A placa (arte 2D com y para cima) encaixa de pé na ranhura; a ranhura é a própria forma de
// baixo da placa com 0,2 mm de folga, por isso a placa fica apertada.
// Wb × Db × hb; ranhura com profundidade prof em y = ys; velas: lista de [x, y], diâmetro dv.
BASE_FOLGA = 0.2;
module base_vela(Wb, Db, hb, prof, ys, e, velas, dv) {
    rc = 6;
    difference() {
        hull() for (sx = [-1, 1], sy = [-1, 1]) translate([sx * (Wb / 2 - rc), sy * (Db / 2 - rc), 0]) cylinder(r = rc, h = hb, $fn = 32);
        // ranhura (a placa assenta a hb - prof)
        translate([0, ys, hb - prof]) placa_xz(e + 2 * BASE_FOLGA)
            offset(delta = BASE_FOLGA) intersection() { children(); translate([-500, -1]) square([1000, prof + 1.5]); }
        for (v = velas) translate([v[0], v[1], hb - 6]) cylinder(d = dv, h = 10, $fn = 72);
    }
}
