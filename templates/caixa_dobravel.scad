// ── CAIXA DOBRÁVEL (impressa plana, dobradiças finas) ──
// Uma peça só, plana: base, frente, trás, laterais duplas, tampa. Imprime com a face de baixo
// na mesa (fica por FORA da caixa). Entre painéis há um V (chanfros a 45°) e, no fundo, uma tira
// fina (a dobradiça, `dobradica` mm) que dobra 90°. Fecha sem cola:
//   1. dobra a frente e a trás para cima e as abas delas para dentro;
//   2. dobra as laterais para cima, o lombo por cima e a parte de dentro (SI) para baixo, por
//      dentro das abas: as patilhas da SI entram nas ranhuras da base e prendem tudo;
//   3. fecha a tampa e mete a aba de fecho por dentro da frente.
// Melhor em PETG (ou PP/TPU); em PLA a dobradiça aguenta poucas aberturas.
// A mesma planificação está em Maker_Pro_Frontend_Prod/lib/caixaDobravel.ts (pré-visualização).
//
// Parâmetros (mm): largura, profundidade, altura (medidas por fora, fechada), espessura (painéis),
//   dobradica (espessura da tira)

function _n(v, d, a, b) = is_undef(v) ? d : max(a, min(b, v));

// Tudo dentro do módulo: os parâmetros do servidor são acrescentados no fim do ficheiro e só
// existem quando o módulo é chamado (as variáveis de topo seriam calculadas antes).
module caixa() {
    L = is_undef(largura) ? 80 : _n(largura, 80, 30, 220);
    P = is_undef(profundidade) ? 60 : _n(profundidade, 60, 30, 220);
    A = is_undef(altura) ? 40 : _n(altura, 40, 15, 150);
    t = is_undef(espessura) ? 1.2 : _n(espessura, 1.2, 0.8, 2.4);
    h = is_undef(dobradica) ? 0.4 : _n(dobradica, 0.4, 0.2, 0.8);
    c = 0.3;                         // folga entre camadas
    g = 1.0;                         // largura da tira da dobradiça
    aS = A - t - c;                  // altura da lateral (fica abaixo da tampa)
    lombo = 3 * t + 2 * c;           // lateral + aba + SI
    lSI = aS - t - c;                // SI: da esquina do lombo até à base
    df = min(P * 0.4, 25);           // abas da frente/trás
    tf = min(A * 0.5, 22);           // aba de fecho
    prof = P - t - c;                // tampa
    xIn = t + c;                     // frente/trás entre as laterais
    z0 = t + c; z1 = aS - t - c;     // altura útil das abas
    yT = P + A;
    mTf = 3 * t + 3 * c;
    yIn0 = t + c; yIn1 = P - t - c; comp = yIn1 - yIn0;
    wPat = min(10, comp / 4);
    patY = [yIn0 + comp * 0.25, yIn0 + comp * 0.75];
    s0 = 2 * t + 2 * c - 0.2; s1 = 3 * t + 2 * c + 0.2;
    d0 = aS + lombo; d1 = d0 + lSI;

    // painel [x0,y0,x1,y1] com chanfro (V) nos lados marcados [y0, x1, y1, x0]
    module painel(r, ch) {
        e = 0.01;
        function ins(k, v) = ch[k] ? v : 0;
        b = g / 2;  s = g / 2 + (t - h);
        hull() {
            translate([r[0] + ins(3, b), r[1] + ins(0, b), 0])
                cube([r[2] - r[0] - ins(3, b) - ins(1, b), r[3] - r[1] - ins(0, b) - ins(2, b), h]);
            translate([r[0] + ins(3, s), r[1] + ins(0, s), t - e])
                cube([r[2] - r[0] - ins(3, s) - ins(1, s), r[3] - r[1] - ins(0, s) - ins(2, s), e]);
        }
    }
    // tira da dobradiça sobre o segmento (horizontal ou vertical) [x0,y0,x1,y1]
    module tira(q) {
        w = g / 2 + 0.3;
        if (q[1] == q[3]) translate([q[0], q[1] - w, 0]) cube([q[2] - q[0], 2 * w, h]);
        else translate([q[0] - w, q[1], 0]) cube([2 * w, q[3] - q[1], h]);
    }
    module bloco(r) { translate([r[0], r[1], 0]) cube([r[2] - r[0], r[3] - r[1], t]); }

    // base com as ranhuras das patilhas
    difference() {
        painel([0, 0, L, P], [1, 1, 1, 1]);
        for (yc = patY) {
            translate([s0, yc - wPat / 2 - 0.2, -1]) cube([s1 - s0, wPat + 0.4, t + 2]);
            translate([L - s1, yc - wPat / 2 - 0.2, -1]) cube([s1 - s0, wPat + 0.4, t + 2]);
        }
    }
    // frente, trás e abas
    painel([xIn, -A, L - xIn, 0], [0, 1, 1, 1]);              tira([xIn, 0, L - xIn, 0]);
    painel([xIn - df, -z1, xIn, -z0], [0, 1, 0, 0]);          tira([xIn, -z1, xIn, -z0]);
    painel([L - xIn, -z1, L - xIn + df, -z0], [0, 0, 0, 1]);  tira([L - xIn, -z1, L - xIn, -z0]);
    painel([xIn, P, L - xIn, P + A], [1, 1, 1, 1]);           tira([xIn, P, L - xIn, P]);
    painel([xIn - df, P + z0, xIn, P + z1], [0, 1, 0, 0]);    tira([xIn, P + z0, xIn, P + z1]);
    painel([L - xIn, P + z0, L - xIn + df, P + z1], [0, 0, 0, 1]); tira([L - xIn, P + z0, L - xIn, P + z1]);
    // tampa e aba de fecho
    painel([0, yT, L, yT + prof], [1, 0, 1, 0]);              tira([xIn, yT, L - xIn, yT]);
    painel([mTf, yT + prof, L - mTf, yT + prof + tf], [1, 0, 0, 0]); tira([mTf, yT + prof, L - mTf, yT + prof]);
    // laterais duplas (esquerda e direita)
    painel([-aS, 0, 0, P], [0, 1, 0, 1]);                     tira([0, 0, 0, P]);
    painel([-(aS + lombo), yIn0, -aS, yIn1], [0, 1, 0, 1]);   tira([-aS, yIn0, -aS, yIn1]);
    painel([-d1, yIn0, -d0, yIn1], [0, 1, 0, 0]);             tira([-d0, yIn0, -d0, yIn1]);
    for (yc = patY) bloco([-(d1 + t), yc - wPat / 2, -d1 + 0.01, yc + wPat / 2]);
    painel([L, 0, L + aS, P], [0, 1, 0, 1]);                  tira([L, 0, L, P]);
    painel([L + aS, yIn0, L + aS + lombo, yIn1], [0, 1, 0, 1]); tira([L + aS, yIn0, L + aS, yIn1]);
    painel([L + d0, yIn0, L + d1, yIn1], [0, 0, 0, 1]);       tira([L + d0, yIn0, L + d0, yIn1]);
    for (yc = patY) bloco([L + d1 - 0.01, yc - wPat / 2, L + d1 + t, yc + wPat / 2]);
}

caixa();
