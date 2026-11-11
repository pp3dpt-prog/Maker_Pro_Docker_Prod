
// ── RENA COM ESTRIAS ──
// Corpo de revolução com estrias verticais e cabeça em cúpula, hastes e orelhas em placas.
// Imprime de pé, sem suportes (as hastes e as orelhas sobem a mais de 40°).
// Parâmetros: altura, largura (diâmetro), estrias, relevo, hastes (%), orelhas, olhos, modo
// A frente é o lado −y (os olhos são duas covinhas na cabeça, para pintar ou deixar assim).
// As hastes e as orelhas podem sair à parte e encaixar: cada uma tem uma lingueta vertical por
// baixo que entra numa ranhura na cabeça (folga FOLGA_ENC). Imprimem-se deitadas, sem suportes.
//   modo "tudo"   a rena numa peça (como antes, mais os olhos)
//   modo "corpo"  o corpo com as ranhuras (hastes e orelhas à parte)
//   modo "pecas"  as duas hastes e as duas orelhas, deitadas (as do outro lado são a mesma peça
//                 virada ao contrário)
function _H()  = _cl((is_undef(altura) ? 130 : altura), 60, 220);
function _R()  = _cl((is_undef(largura) ? 60 : largura), 30, 120) / 2;
function _ne() = round(_cl((is_undef(estrias) ? 24 : estrias), 8, 60));
function _re() = _cl((is_undef(relevo) ? 1.5 : relevo), 0, 4);
function _hs() = _cl((is_undef(hastes) ? 100 : hastes), 50, 160) / 100;
function _hh() = min(0.3 * _H(), 0.95 * _R());      // meia-altura da cabeça
function _rh() = 0.84 * _R();                         // raio da cabeça
function _zc() = _H() - _hh();                        // centro da cabeça
function _ss(a, b, x) = let(t = _cl((x - a) / (b - a), 0, 1)) t * t * (3 - 2 * t);
// corpo: largo em baixo, cintura no pescoço; cabeça: elipsóide; o perfil é o maior dos dois
function corpo(z) = _R() * (1 - 0.05 * z / _H()) * (1 - 0.3 * _ss(0.3 * _zc(), _zc(), z));
function cabeca(z) = let(t = (z - _zc()) / _hh()) abs(t) >= 1 ? 0 : _rh() * sqrt(1 - t * t);
function perfil(z) = z > _zc() ? cabeca(z) : max(corpo(z), cabeca(z));
function cx(k, z) = 0;
function rp(k, a, z) = let(b = perfil(z)) max(0.05, b - _re() * (0.5 + 0.5 * cos(_ne() * a)) * min(1, 1.6 * b / _R()));
// altura no alto da cabeça em que o raio é f·rh
function _zcup(f) = _zc() + _hh() * sqrt(1 - f * f);

FOLGA_ENC = 0.2;
function _s()  = 1.25 * _hs() * _R() / 30;          // escala das hastes
function _so() = 1.3 * _R() / 30;                    // escala das orelhas
function _th() = 3.6 * max(1, _s() * 0.8);           // espessura das hastes
TO = 2.6;                                             // espessura das orelhas
function _zsup(x) = _zc() + _hh() * sqrt(max(0, 1 - pow(x / _rh(), 2)));   // alto da cabeça (sem estrias) em x
// linguetas (no plano XZ): [x do centro, largura, fundura]
function _lh() = [0.34 * _rh() + 1.6 * _s(), 3.2 * _s(), 6 * _s()];
function _lo() = [0.76 * _rh(), 2.4 * _so(), 4.5];

// formas 2D no plano XZ (x, z), lado +x
module haste2d() { translate([0.34 * _rh(), _zcup(0.4) - 2 * _s()]) rotate(6) scale(_s()) forma2d(NATAL_HASTE); }
module orelha2d() { translate([0.7 * _rh(), _zcup(0.8)]) rotate(32) scale(_so()) forma2d(NATAL_ORELHA); }
// o corpo cortado pelo plano das placas, pelo lado de fora das estrias (a peça nunca entra no corpo;
// no fundo das estrias fica uma frestazinha)
module cabeca2d() {
    K = 120;
    polygon(concat([for (k = [0 : K]) let(z = _H() * k / K) [perfil(z) + 0.05, z]],
                   [for (k = [K : -1 : 0]) let(z = _H() * k / K) [-perfil(z) - 0.05, z]]));
}
module lingueta2d(L) { z = _zsup(L[0]); translate([L[0] - L[1] / 2, z - L[2]]) square([L[1], L[2] + 1.5]); }
// peça à parte = a parte de fora da cabeça + a lingueta
module haste_peca2d()  { union() { difference() { haste2d(); cabeca2d(); } lingueta2d(_lh()); } }
module orelha_peca2d() { union() { difference() { orelha2d(); cabeca2d(); } lingueta2d(_lo()); } }
module ranhura(L, t) {
    z = _zsup(L[0]);
    translate([L[0] - L[1] / 2 - FOLGA_ENC, -t / 2 - FOLGA_ENC, z - L[2] - FOLGA_ENC]) cube([L[1] + 2 * FOLGA_ENC, t + 2 * FOLGA_ENC, L[2] + 20]);
}

function _com_orelhas() = _sim(is_undef(orelhas) ? true : orelhas);
function _com_olhos() = _sim(is_undef(olhos) ? true : olhos);
// olhos: covinhas na frente (−y) da cabeça, a ±24° e um pouco acima do meio da cabeça
function _ro() = 0.1 * _rh();
module olhos() {
    z = _zc() + 0.22 * _hh();
    for (sx = [-1, 1]) let(a = 270 + sx * 24, r = rp(0, a, z) + 0.25 * _ro())
        translate([r * cos(a), r * sin(a), z]) sphere(r = _ro(), $fn = 32);
}
module corpo_polar() { solido_polar(0, _H(), max(96, 6 * _ne()), 70); }

module rena() {
    difference() {
        union() {
            corpo_polar();
            for (m = [0, 1]) mirror([m, 0, 0]) {
                placa_xz(_th()) haste2d();
                if (_com_orelhas()) placa_xz(TO) orelha2d();
            }
        }
        if (_com_olhos()) olhos();
    }
}
module corpo_com_ranhuras() {
    difference() {
        corpo_polar();
        for (m = [0, 1]) mirror([m, 0, 0]) {
            ranhura(_lh(), _th());
            if (_com_orelhas()) ranhura(_lo(), TO);
        }
        if (_com_olhos()) olhos();
    }
}
// as peças deitadas, lado a lado (z = 0 na mesa)
module pecas_deitadas() {
    g = 6;
    for (k = [0, 1]) translate([k * (32 * _s() + g), 0, 0]) linear_extrude(height = _th())
        translate([-0.34 * _rh(), -_zcup(0.4) + 6 * _s()]) haste_peca2d();
    if (_com_orelhas()) for (k = [0, 1]) translate([2 * (32 * _s() + g) + k * (16 * _so() + g), 0, 0]) linear_extrude(height = TO)
        translate([-0.7 * _rh(), -_zcup(0.8) + 5]) orelha_peca2d();
}

function _modo() = is_undef(modo) ? "tudo" : modo;
if (_modo() == "corpo") corpo_com_ranhuras();
else if (_modo() == "pecas") pecas_deitadas();
else rena();
