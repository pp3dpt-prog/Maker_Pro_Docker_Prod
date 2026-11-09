
// ── GORRO PORTA-BOMBOM ──
// Gorro de Natal com dobra canelada e pompom, que se põe por cima de um bombom (tipo Ferrero
// Rocher), e uma base canelada onde o bombom assenta. Duas peças, impressas lado a lado (o gorro
// de pé, aberto em baixo; a base de pé, aberta em cima), sem suportes.
// Parâmetros: diametro_bombom, altura (do gorro), estrias, pompom, pecas ("Gorro e base" | "Só o gorro" | "Só a base")
function _d()  = _cl(is_undef(diametro_bombom) ? 31 : diametro_bombom, 18, 50);
function _Hg() = _cl(is_undef(altura) ? 45 : altura, 25, 100);
function _ne() = round(_cl(is_undef(estrias) ? 28 : estrias, 12, 60));
function _pp() = _sim(is_undef(pompom) ? true : pompom);
function _pecas() = is_undef(pecas) ? "Gorro e base" : pecas;
PAREDE_G = 1.6;
function _rd() = _d() / 2;
function _Rb() = 0.92 * _rd() + 2.6;          // raio da dobra do gorro (por fora)
function _hb() = max(6, 0.24 * _Hg());          // altura da dobra
function _rpp() = _pp() ? max(4, 0.13 * _Hg() + 0.08 * _d()) : 0;   // raio do pompom
function _rt() = _pp() ? 0.65 * _rpp() : 2;     // raio do topo do cone
function _Hc() = _Hg() - (_pp() ? 0.2 * _rpp() : 0);   // altura do cone
// copo (base): raio por fora e altura
function _Rcp() = 0.8 * _rd() + 3;
function _hcp() = max(8, 0.34 * _d());
function cone(z) = let(r0 = 0.88 * _Rb()) z <= _hb() ? _Rb() : r0 + (_rt() - r0) * (z - _hb()) / (_Hc() - _hb());
// ponta do gorro caída para o lado (+x); inclinação do eixo ≤ 30°, para imprimir sem suportes
function cx(k, z) = k == 0 && z > _hb() ? 0.2 * _Hg() * pow((z - _hb()) / (_Hc() - _hb()), 2) : 0;
// k = 0: gorro; k = 1: copo
function rp(k, a, z) = k == 0
    ? (z <= _hb() ? _Rb() - 1.1 * (0.5 + 0.5 * cos(_ne() * a)) * _cl(min(z, _hb() - z) / 0.6, 0, 1) : cone(z))
    : _Rcp() - 1 * (0.5 + 0.5 * cos(_ne() * a)) * _cl(min(z, _hcp() - z) / 0.6, 0, 1);
// dentro do gorro: assenta no bombom a 0,86·raio; cone paralelo ao de fora
function ri(k, z) = k == 0 ? max(0.4, min(0.86 * _rd() + 0.0001 * z, cone(z) - PAREDE_G))
                           : 0.8 * _rd();
function _Hi() = _Hc() - 2.2;

module gorro() {
    N = max(96, 6 * _ne());
    casca_polar(0, _Hc(), _Hi(), N, 60, 40);
    if (_pp()) translate([cx(0, _Hc()), 0, _Hc() + 0.2 * _rpp()]) sphere(r = _rpp(), $fn = 40);
}
module copo() {
    N = max(96, 6 * _ne());
    // é um "gorro" virado ao contrário: a cavidade abre em cima
    translate([0, 0, _hcp()]) mirror([0, 0, 1]) casca_polar(1, _hcp(), _hcp() - 2, N, 8, 4);
}
// posições montadas (só para a pré-visualização): centro do bombom e altura do gorro
function _zbombom() = _hcp() + sqrt(_rd() * _rd() - pow(0.8 * _rd(), 2));
function _zgorro() = _zbombom() + sqrt(_rd() * _rd() - pow(0.86 * _rd(), 2));

module gorro_bombom() {
    p = _pecas();
    so_g = p == "Só o gorro";
    so_b = p == "Só a base";
    if (!so_b) gorro();
    if (!so_g) translate([so_b ? 0 : -(_Rb() + _Rcp() + 6), 0, 0]) copo();
}
gorro_bombom();
