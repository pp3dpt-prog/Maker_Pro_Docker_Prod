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
// ── ÁRVORE POLAR (comum às árvores espiral, camadas e texturizada) ──
// A árvore é UM polyhedron gerado por fórmula (sem booleanas): parede de fora, tampa na ponta
// e fundo — ou, se for oca por baixo (para meter uma vela LED), um anel no fundo, a parede da
// cavidade e o tecto da cavidade. Cada modelo define:
//   _NA()          colunas
//   _zrows()       alturas das linhas da parede de fora (a primeira é 0, a última é o topo)
//   r_at(a, z)     distância ao centro da parede de fora (a em graus)
//   _oco()         true = oca por baixo
//   _zirows()      alturas das linhas da cavidade (a primeira é 0)
//   rc_at(z)       raio da cavidade; a cavidade acaba na primeira linha com menos de 3 mm
//   _topo_alt(), _r_max()  para a estrela (ver _estrela_topo.scad)

function _ang(i) = i * 360 / _NA();

module arvore() {
    NA = _NA(); ZR = _zrows(); K = len(ZR) - 1; R = K + 1;
    ext = [for (i = [0 : NA - 1], k = [0 : K]) let(a = _ang(i), r = r_at(a, ZR[k])) [r * cos(a), r * sin(a), ZR[k]]];
    T = NA * R;                                                        // centro da tampa da ponta
    parede = [for (i = [0 : NA - 1], k = [0 : K - 1], t = _q(i * R + k, ((i + 1) % NA) * R + k, ((i + 1) % NA) * R + k + 1, i * R + k + 1)) t];
    tampa  = [for (i = [0 : NA - 1]) [T, i * R + K, ((i + 1) % NA) * R + K]];

    ZI = _oco() ? _zirows() : [0];
    RC = [for (z = ZI) _oco() ? rc_at(z) : -1];
    maus = [for (k = [0 : len(RC) - 1]) if (RC[k] < 3) k];
    kc = len(maus) == 0 ? len(RC) - 1 : maus[0] - 1;                  // última linha da cavidade
    oca = kc >= 1;
    Ri = kc + 1; O = T + 1; C = O + NA * Ri;
    pts = oca
        ? concat(ext, [[0, 0, ZR[K]]],
                 [for (i = [0 : NA - 1], k = [0 : kc]) let(a = _ang(i)) [RC[k] * cos(a), RC[k] * sin(a), ZI[k]]],
                 [[0, 0, ZI[kc]]])
        : concat(ext, [[0, 0, ZR[K]], [0, 0, 0]]);
    faces = oca
        ? concat(parede, tampa,
            [for (i = [0 : NA - 1], t = _q(i * R, O + i * Ri, O + ((i + 1) % NA) * Ri, ((i + 1) % NA) * R)) t],                 // anel do fundo
            [for (i = [0 : NA - 1], k = [0 : kc - 1], t = _q(O + i * Ri + k, O + i * Ri + k + 1, O + ((i + 1) % NA) * Ri + k + 1, O + ((i + 1) % NA) * Ri + k)) t],   // cavidade
            [for (i = [0 : NA - 1]) [C, O + ((i + 1) % NA) * Ri + kc, O + i * Ri + kc]])                                     // tecto
        : concat(parede, tampa, [for (i = [0 : NA - 1]) [T + 1, ((i + 1) % NA) * R, i * R]]);                                   // fundo
    tp = _topo_pts();
    tf = _topo_faces(len(pts));
    // faces escritas no sentido anti-horário vistas de fora (como no three.js); o OpenSCAD quer o inverso
    polyhedron(points = concat(pts, tp), faces = [for (f = concat(faces, tf)) [f[2], f[1], f[0]]], convexity = 6);
}
// ── ÁRVORE EM ESPIRAL ──
// Cone com secção em estrela (4 a 12 pontas) que roda ao subir. Sólida, para imprimir em modo
// vaso (spiralize), ou oca por baixo para pôr por cima de uma vela LED.
//
// Parâmetros: pontas, raio, altura, profundidade (% das pontas), torcao (graus), arredondar
//   (0 = pontas vivas … 1 = onduladas), curvatura (perfil: <1 cheio, >1 esguio), base_arvore,
//   parede, estrela_topo, tamanho_estrela

function _np() = is_undef(pontas) ? 6 : max(3, round(pontas));
function _R()  = is_undef(raio) ? 45 : raio;
function _H()  = is_undef(altura) ? 150 : altura;
function _p()  = (is_undef(profundidade) ? 30 : profundidade) / 100;
function _tw() = is_undef(torcao) ? 180 : torcao;
function _s()  = is_undef(arredondar) ? 0.3 : min(1, max(0, arredondar));
function _c()  = is_undef(curvatura) ? 1 : curvatura;
function _t()  = is_undef(parede) ? 2 : parede;
function _oco() = !is_undef(base_arvore) && base_arvore == "Oca por baixo (vela LED)";
function _NA() = 240;
function _topo_alt() = _H();
function _r_max() = _R();

function perfil(z)  = let(u = min(1, z / _H())) 1.5 + (_R() - 1.5) * pow(1 - u, _c());
function dperfil(z) = let(u = min(0.999, z / _H())) (_R() - 1.5) * _c() * pow(1 - u, _c() - 1) / _H();
function forma(a) = let(m = ((_np() * a) % 360 + 360) % 360, w = abs(m - 180) / 180)   // 1 nas pontas, 0 nos vales
    (1 - _s()) * w + _s() * (0.5 + 0.5 * cos(_np() * a));
function r_at(a, z) = perfil(z) * (1 - _p() * (1 - forma(a - _tw() * z / _H())));

function _zrows()  = let(K = max(24, ceil(_H() / (_prev() ? 3 : 1.5)))) [for (k = [0 : K]) _H() * k / K];
function _zirows() = let(K = max(8, ceil(_H() / 4))) [for (k = [0 : K]) _H() * k / K];
// cavidade: cone dentro dos vales, com a parede corrigida pela inclinação do perfil e da torção
function rc_at(z) = z > _H() - 6 ? -1 :
    let(rv = perfil(z) * (1 - _p()), d = dperfil(z) * (1 - _p()), ti = rv * _tw() * PI / 180 / _H())
    rv - _t() * sqrt(1 + d * d + ti * ti);

arvore();
