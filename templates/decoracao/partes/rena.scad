
// ── RENA COM ESTRIAS ──
// Corpo de revolução com estrias verticais e cabeça em cúpula, hastes e orelhas em placas.
// Imprime de pé, sem suportes (as hastes e as orelhas sobem a mais de 40°).
// Parâmetros: altura, largura (diâmetro), estrias, relevo, hastes (%), orelhas
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

module haste() {
    s = 1.25 * _hs() * _R() / 30;
    translate([0.4 * _rh(), 0, _zcup(0.4) - 2 * s]) rotate([0, -6, 0]) placa_xz(3.6 * max(1, s * 0.8)) scale(s) forma2d(NATAL_HASTE);
}
module orelha() {
    s = 1.3 * _R() / 30;
    translate([0.8 * _rh(), 0, _zcup(0.8)]) placa_xz(2.6) rotate(32) scale(s) forma2d(NATAL_ORELHA);
}
module rena() {
    N = max(96, 8 * _ne());
    solido_polar(0, _H(), N, 90);
    for (m = [0, 1]) mirror([m, 0, 0]) {
        haste();
        if (_sim(is_undef(orelhas) ? true : orelhas)) orelha();
    }
}
rena();
