// ── BASE PARA COPOS (padrão em relevo + nome opcional) ──
//
// Base plana com um padrão em relevo no topo (hexágonos, riscas, grelha, losangos, pontos ou
// ondas), rebordo opcional e um nome/monograma ao centro. O padrão abre-se à volta das letras
// (margem `halo`) para o nome se ler bem.
//
// Partes (modo), para o 3MF multicor (generation_schema.multicor):
//   "base"    placa, z 0..espessura
//   "padrao"  padrão + rebordo, z espessura..espessura+relevo
//   "texto"   nome, z espessura..espessura+relevo+relevo_texto_extra
//   "tudo"    tudo junto (omissão; "preview" = "tudo")
// As partes tocam-se sem se sobreporem. esc_texto vem do servidor (lib/textFit.js,
// generation_schema.ajuste_texto) para o nome caber na largura útil.
//
// As injectadas são lidas por funções (avaliadas só na instanciação), por isso a ordem de
// injecção (antes ou depois do template) é indiferente.

function _forma()   = is_undef(forma) ? "Redonda" : forma;
function _L()       = is_undef(largura) ? 95 : largura;
function _esp()     = is_undef(espessura) ? 3.5 : espessura;
function _padrao()  = is_undef(padrao) ? "Hexágonos" : padrao;
function _cel()     = is_undef(tamanho_padrao) ? 8 : tamanho_padrao;
function _linha()   = is_undef(linha) ? 1.2 : linha;
function _relevo()  = is_undef(relevo) ? 0.8 : relevo;
function _reb()     = !is_undef(rebordo) && (rebordo == true || rebordo == 1);
function _reb_l()   = is_undef(rebordo_largura) ? 3 : rebordo_largura;
function _texto()   = is_undef(texto) ? "" : texto;
function _fonte()   = is_undef(fonte) ? "Luckiest Guy" : fonte;
function _fs()      = is_undef(fontSize) ? 14 : fontSize;
function _esc()     = is_undef(esc_texto) ? 1 : esc_texto;
function _halo()    = is_undef(halo) ? 2 : halo;
function _extra()   = is_undef(relevo_texto_extra) ? 0.4 : relevo_texto_extra;
function _modo()    = is_undef(modo) ? "tudo" : modo;
function _sob()     = (_modo() == "base" || _modo() == "padrao" || _modo() == "texto") ? 0 : 0.01;

module forma2d() {
    if (_forma() == "Quadrada")
        offset(r = 8, $fn = 48) square(_L() - 16, center = true);
    else if (_forma() == "Hexagonal")
        rotate(30) circle(d = _L() / cos(30), $fn = 6);      // largura = distância entre lados
    else
        circle(d = _L(), $fn = 160);
}

// zona onde o padrão pode existir: dentro do rebordo (ou a 1,5 mm da beira, sem rebordo)
module interior2d() { offset(delta = -(_reb() ? _reb_l() : 1.5)) forma2d(); }

module texto2d() {
    if (len(_texto()) > 0)
        scale(_esc()) offset(delta = 0.01)
            text(_texto(), size = _fs(), font = _fonte(), halign = "center", valign = "center");
}

// ── padrões (2D, a cobrir um quadrado de lado ~L, depois recortados) ──
function _n() = ceil(_L() / _cel() / 2) + 2;

module hexagonos() {                      // favo: anéis hexagonais (meia linha cada → linha inteira entre vizinhos)
    R = _cel() / 2;
    for (i = [-_n() : _n()], j = [-_n() : _n()])
        translate([i * 1.5 * R, (j + (abs(i) % 2) / 2) * sqrt(3) * R])
            difference() {
                circle(r = R, $fn = 6);
                offset(delta = -_linha() / 2) circle(r = R, $fn = 6);
            }
}
module riscas(ang = 45) {
    rotate(ang) for (i = [-2 * _n() : 2 * _n()])
        translate([i * _cel() / 2 - _linha() / 2, -_L()]) square([_linha(), 2 * _L()]);
}
module grelha() {
    for (i = [-_n() : _n()]) {
        translate([i * _cel() - _linha() / 2, -_L()]) square([_linha(), 2 * _L()]);
        translate([-_L(), i * _cel() - _linha() / 2]) square([2 * _L(), _linha()]);
    }
}
module losangos() { rotate(45) grelha(); }
module pontos() {
    for (i = [-_n() : _n()], j = [-2 * _n() : 2 * _n()])
        translate([(i + (abs(j) % 2) / 2) * _cel(), j * _cel() * sqrt(3) / 2])
            circle(r = _cel() * 0.28, $fn = 24);
}
module ondas() {
    A = _cel() * 0.3; lambda = _cel() * 2.4; L = _L();
    for (k = [-2 * _n() : 2 * _n()]) {
        y0 = k * _cel() / 2;
        polygon(concat(
            [for (x = [-L : 1 : L]) [x, y0 + A * sin(360 * x / lambda) + _linha() / 2]],
            [for (x = [L : -1 : -L]) [x, y0 + A * sin(360 * x / lambda) - _linha() / 2]]));
    }
}
module padrao2d_bruto() {
    p = _padrao();
    if (p == "Hexágonos") hexagonos();
    else if (p == "Riscas") riscas();
    else if (p == "Grelha") grelha();
    else if (p == "Losangos") losangos();
    else if (p == "Pontos") pontos();
    else if (p == "Ondas") ondas();
}

module padrao2d() {
    difference() {
        intersection() { interior2d(); padrao2d_bruto(); }
        if (len(_texto()) > 0) offset(r = _halo(), $fn = 24) texto2d();
    }
}
module rebordo2d() { if (_reb()) difference() { forma2d(); interior2d(); } }

module base()   { linear_extrude(_esp()) forma2d(); }
module padrao() {
    // offset(delta = 0.01) funde linhas que só se tocam num vértice (favo, riscas, ondas): sem ele a
    // malha não fecha e o OpenSCAD não junta o padrão à base. O intersection mantém-no dentro da base.
    translate([0, 0, _esp() - _sob()]) linear_extrude(_relevo() + _sob())
        intersection() { forma2d(); offset(delta = 0.01) union() { padrao2d(); rebordo2d(); } }
}
module nome() {
    if (len(_texto()) > 0)
        translate([0, 0, _esp() - _sob()]) linear_extrude(_relevo() + _extra() + _sob())
            intersection() { interior2d(); texto2d(); }
}

if (_modo() == "base") base();
else if (_modo() == "padrao") padrao();
else if (_modo() == "texto") nome();
else {
    color(is_undef(cor_base) ? "#FFFFFF" : cor_base) base();
    color(is_undef(cor_padrao) ? "#1E3A8A" : cor_padrao) padrao();
    color(is_undef(cor_texto) ? "#DC2626" : cor_texto) nome();
}
