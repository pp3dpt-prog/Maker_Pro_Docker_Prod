// ── ESTRELA DO TOPO (comum às árvores de Natal) ──
// Não usa union(): a estrela entra no MESMO polyhedron que a árvore, como uma segunda
// casca fechada (as booleanas do OpenSCAD com malhas grandes demoram 10× mais). Os
// fatiadores juntam as cascas que se sobrepõem.
//   estrela_topo = "No topo"               estrela de pé, com 2 mm enterrados na ponta
//                  "À parte (para colar)"  estrela facetada deitada, ao lado da árvore
//                  "Sem estrela"
// Cada modelo define _topo_alt() (altura da ponta) e _r_max() (raio máximo da árvore).
// A mesma conta está em Maker_Pro_Frontend_Prod/lib/arvoresNatal.ts (pré-visualização).

function _q(a, b, c, d) = [[a, b, c], [a, c, d]];
function _prev() = !is_undef(modo) && modo == "preview";

// estrela de np pontas no plano XY: costas em z = 0, lados até z = b, bico até z = b + h
function _ept(i, np, R, ri, z, a0) = let(a = a0 + i * 180 / np, r = (i % 2 == 0) ? R : ri) [r * cos(a), r * sin(a), z];
function estrela_pts(np, R, ri, b, h, a0) = let(M = 2 * np)
    concat([for (i = [0 : M - 1]) _ept(i, np, R, ri, 0, a0)], [for (i = [0 : M - 1]) _ept(i, np, R, ri, b, a0)],
           [[0, 0, 0], [0, 0, b + h]]);
function estrela_faces(np, o) = let(M = 2 * np, C = o + 2 * M, A = C + 1) concat(
    [for (i = [0 : M - 1]) [C, o + (i + 1) % M, o + i]],
    [for (i = [0 : M - 1], t = _q(o + i, o + (i + 1) % M, o + M + (i + 1) % M, o + M + i)) t],
    [for (i = [0 : M - 1]) [A, o + M + i, o + M + (i + 1) % M]]);

function _topo_tipo() = is_undef(estrela_topo) ? "No topo" : estrela_topo;
function _rs() = is_undef(tamanho_estrela) ? 15 : tamanho_estrela;
function _topo_pts() =
    _topo_tipo() == "No topo" ?
        // de pé (plano XZ), uma ponta para baixo enterrada 2 mm na ponta da árvore; 3 mm de espessura
        let(e = 3, zc = _topo_alt() - 2 + _rs())
        [for (p = estrela_pts(5, _rs(), 0.45 * _rs(), e, 0, 270)) [p[0], -p[2] + e / 2, p[1] + zc]]
  : _topo_tipo() == "À parte (para colar)" ?
        let(dx = _r_max() + 6 + _rs())
        [for (p = estrela_pts(5, _rs(), 0.45 * _rs(), 1.6, 0.35 * _rs(), 90)) [p[0] + dx, p[1], p[2]]]
  : [];
function _topo_faces(o) = len(_topo_pts()) == 0 ? [] : estrela_faces(5, o);
// ── ÁRVORE LOW-POLY ──
// Árvore facetada: anéis de N vértices, cada um rodado meio lado em relação ao de baixo e com
// uma irregularidade "aleatória" (fixa pela semente), até à ponta. Tronco opcional que abre a 45°.
//
// Parâmetros: lados, aneis, raio, altura, irregularidade (%), semente, raio_tronco (0 = sem),
//   altura_tronco, estrela_topo, tamanho_estrela

function _n()   = is_undef(lados) ? 7 : max(3, round(lados));
function _M()   = is_undef(aneis) ? 6 : max(2, round(aneis));
function _R()   = is_undef(raio) ? 45 : raio;
function _H()   = is_undef(altura) ? 140 : altura;
function _irr() = (is_undef(irregularidade) ? 12 : irregularidade) / 100;
function _sem() = is_undef(semente) ? 7 : semente;
function _rtr() = is_undef(raio_tronco) ? 0 : raio_tronco;
function _htr() = is_undef(altura_tronco) ? 12 : altura_tronco;
function _tronco() = _rtr() > 0 && _htr() > 0;
function _topo_alt() = _H();
function _r_max() = _R() * (1 + _irr());

// número pseudo-aleatório 0..1 (a mesma conta no JS)
function _hash(i, j, c) = let(v = sin(i * 127.1 + j * 311.7 + c * 74.7 + _sem() * 17.3) * 43758.5453) v - floor(v);
function _seg() = 360 / _n();
function _zc0() = _tronco() ? _htr() + (_R() - _rtr()) * 1.05 : 0;     // fundo da copa (abertura a ~45°)
// anel k (0..): tronco (2 anéis) e depois a copa; cada anel roda meio lado
function _naneis() = (_tronco() ? 2 : 0) + _M();
function _vert(k, i) =
    let(rot = k * _seg() / 2, j = k - (_tronco() ? 2 : 0))
    j < 0 ? let(a = rot + i * _seg()) [_rtr() * cos(a), _rtr() * sin(a), j == -2 ? 0 : _htr()]
    : let(hz = (_H() - _zc0()) / _M(),
          fr = j == 0 ? 0.3 : 1,                                         // o anel de baixo mexe pouco (abertura)
          r  = _R() * (1 - j / _M()) * (1 + fr * _irr() * (2 * _hash(i, j, 0) - 1)),
          a  = rot + i * _seg() + _irr() * _seg() / 2 * (2 * _hash(i, j, 1) - 1),
          z  = _zc0() + j * hz + (j == 0 ? 0 : _irr() * hz * 0.5 * (2 * _hash(i, j, 2) - 1)))
      [r * cos(a), r * sin(a), z];

module arvore_lowpoly() {
    n = _n(); NK = _naneis();
    pts = concat([for (k = [0 : NK - 1], i = [0 : n - 1]) _vert(k, i)], [[0, 0, 0], [0, 0, _H()]]);
    B = NK * n; A = B + 1;
    faces = concat(
        [for (i = [0 : n - 1]) [B, (i + 1) % n, i]],                                                 // fundo
        [for (k = [0 : NK - 2], i = [0 : n - 1], t = [[k * n + i, k * n + (i + 1) % n, (k + 1) * n + i],
                                                     [(k + 1) * n + i, k * n + (i + 1) % n, (k + 1) * n + (i + 1) % n]]) t],
        [for (i = [0 : n - 1]) [A, (NK - 1) * n + i, (NK - 1) * n + (i + 1) % n]]);                  // ponta
    tp = _topo_pts();
    tf = _topo_faces(len(pts));
    polyhedron(points = concat(pts, tp), faces = [for (f = concat(faces, tf)) [f[2], f[1], f[0]]], convexity = 4);
}

arvore_lowpoly();
