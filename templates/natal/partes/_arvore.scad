// ── ÁRVORE POLAR (comum às árvores espiral, camadas e texturizada) ──
// A árvore é UM polyhedron gerado por fórmula (sem booleanas): parede de fora, tampa na ponta
// e fundo — ou, se for oca por baixo (para meter uma vela LED), um anel no fundo, a parede da
// cavidade e o tecto da cavidade. Cada modelo define:
//   _NA()          colunas
//   _zrows()       alturas das linhas da parede de fora (a primeira é 0, a última é o topo)
//   r_at(a, z)     distância ao centro da parede de fora (a em graus)
//   _linha(z), r_at_linha(a, z, c)  o mesmo com a parte que só depende de z calculada uma vez por
//                  linha (c = _linha(z)); quem não precisa: _linha(z) = 0 e r_at_linha = r_at
//   _oco()         true = oca por baixo
//   _zirows()      alturas das linhas da cavidade (a primeira é 0)
//   rc_at(z)       raio da cavidade; a cavidade acaba na primeira linha com menos de 3 mm
//   _topo_alt(), _r_max()  para a estrela (ver _estrela_topo.scad)

function _ang(i) = i * 360 / _NA();

module arvore() {
    NA = _NA(); ZR = _zrows(); K = len(ZR) - 1; R = K + 1;
    LZ = [for (z = ZR) _linha(z)];                                     // o que só depende de z, calculado uma vez por linha
    ext = [for (i = [0 : NA - 1], k = [0 : K]) let(a = _ang(i), r = r_at_linha(a, ZR[k], LZ[k])) [r * cos(a), r * sin(a), ZR[k]]];
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
