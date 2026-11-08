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
