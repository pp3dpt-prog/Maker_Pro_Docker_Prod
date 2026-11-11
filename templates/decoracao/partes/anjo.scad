
// ── ANJO COM ESTRIAS ──
// Saia de revolução com estrias, cabeça esférica, asas em placa atrás e auréola de pé por
// trás da cabeça. Imprime de pé, sem suportes.
// Parâmetros: altura, largura (diâmetro da base), estrias, relevo, asas (%), aureola, olhos, modo
// A auréola é uma peça à parte (generation_schema.multicor), recortada pela cabeça — encosta
// nela sem se sobrepor:
//   modo "corpo"            o anjo sem auréola
//   modo "aureola"          a auréola no sítio (com AMS: as duas no mesmo 3MF, cada uma na sua cor)
//   modo "aureola_deitada"  a auréola deitada na mesa, para imprimir à parte e colar (sem AMS);
//                           o recorte côncavo encaixa na parte de trás da cabeça
//   sem modo / "tudo"       tudo junto (pré-visualização)
function _H()  = _cl(is_undef(altura) ? 110 : altura, 60, 200);
function _R()  = _cl(is_undef(largura) ? 60 : largura, 30, 120) / 2;
function _ne() = round(_cl(is_undef(estrias) ? 24 : estrias, 8, 60));
function _re() = _cl(is_undef(relevo) ? 1.5 : relevo, 0, 4);
function _as() = _cl(is_undef(asas) ? 100 : asas, 50, 160) / 100;
function _rc() = max(6, min(0.14 * _H(), 0.55 * _R()));   // raio da cabeça
function _Hb() = _H() - 1.85 * _rc();                       // altura da saia
function _rn() = 0.7 * _rc();                               // raio do pescoço
function _zh() = _Hb() + 0.85 * _rc();                      // centro da cabeça
function saia(z) = let(u = z / _Hb()) _rn() + (_R() - _rn()) * pow(1 - u, 1.35) + 0.05 * _R() * pow(1 - u, 8);
function cx(k, z) = 0;
function cabeca(z) = let(t = z - _zh()) abs(t) < _rc() ? sqrt(_rc() * _rc() - t * t) : 0;
function _Ht() = _zh() + _rc();
// saia (com estrias) e cabeça num só perfil (o maior dos dois): um corpo só, menos trabalho ao CGAL
function rp(k, a, z) = let(f = _cl((_Hb() - z) / (0.18 * _Hb()), 0, 1))
    max(0.05, z <= _Hb() ? saia(z) - _re() * (0.5 + 0.5 * cos(_ne() * a)) * f : 0, cabeca(z));

module asa() {
    s = 1.6 * _as() * _R() / 30;
    zw = 0.56 * _Hb();
    translate([1.5, 0.42 * saia(zw), zw]) placa_xz(3) scale(s) forma2d(NATAL_ASA);
}
module aureola_anel() {
    rc = _rc();
    translate([0, 0.4 * rc, _zh() + 0.5 * rc]) placa_xz(2.4)
        difference() { circle(r = 1.12 * rc, $fn = 72); circle(r = 0.9 * rc, $fn = 72); }
}
// a auréola sem a parte que fica dentro da cabeça (a cabeça é uma esfera de raio _rc() em z = _zh())
module aureola() {
    difference() {
        aureola_anel();
        translate([0, 0, _zh()]) sphere(r = _rc(), $fn = 96);
    }
}
// olhos: duas covinhas na frente (−y) da cabeça (olhos fechados/serenos, para pintar ou deixar)
function _com_olhos() = _sim(is_undef(olhos) ? true : olhos);
module olhos() {
    rc = _rc(); ro = 0.1 * rc; z = _zh() + 0.08 * rc;
    for (sx = [-1, 1]) let(a = 270 + sx * 22, rr = sqrt(rc * rc - pow(z - _zh(), 2)) + 0.25 * ro)
        translate([rr * cos(a), rr * sin(a), z]) sphere(r = ro, $fn = 32);
}
module corpo_anjo() {
    // saia e cabeça num só corpo de revolução (ver rp)
    difference() {
        union() {
            solido_polar(0, _Ht(), max(96, 6 * _ne()), 100, false);
            for (m = [0, 1]) mirror([m, 0, 0]) asa();
        }
        if (_com_olhos()) olhos();
    }
}
function _com_aureola() = _sim(is_undef(aureola) ? true : aureola);
function _modo() = is_undef(modo) ? "tudo" : modo;
if (_modo() == "corpo") corpo_anjo();
else if (_modo() == "aureola") { if (_com_aureola()) aureola(); }
else if (_modo() == "aureola_deitada") {
    // deitada (a placa passa a ser horizontal), assente em z = 0
    if (_com_aureola()) translate([0, 0, 1.2]) rotate([-90, 0, 0]) translate([0, -0.4 * _rc(), -(_zh() + 0.5 * _rc())]) aureola();
}
else { corpo_anjo(); if (_com_aureola()) aureola(); }
