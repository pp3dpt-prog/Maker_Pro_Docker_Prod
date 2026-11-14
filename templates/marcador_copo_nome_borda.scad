// ── MARCADORES DE COPO — NOME NA BORDA ──
// Peça plana numa só impressão: o nome assente numa barra que acaba num "U" (gancho).
// A barra do nome fica por fora do copo, o "U" passa por cima da borda e a perna curta fica
// por dentro, a apertar o vidro (a folga vai fechando do "U" para a ponta, que abre um pouco
// para entrar bem). O nome fica espetado para fora do copo, como uma barbatana.
// Até 12 nomes de uma vez, já arrumados na mesa.
//
// Parâmetros:
//   quantidade         1–12
//   nome_1 … nome_12   nomes; esc_nome_<i> (0–1) é calculado pelo servidor (lib/textFit.js,
//                      generation_schema.ajuste_texto) para o nome caber na largura
//   fonte, tamanho_nome (mm), largura (zona do nome, mm)
//   espessura          espessura da peça (mm)
//   espessura_vidro    espessura do vidro na borda do copo (mm)
//   modo               "corpo" (barra e gancho) | "nome" | "uma_peca" | "tudo"

function _q()     = is_undef(quantidade) ? 6 : max(1, min(12, round(quantidade)));
function _fonte() = is_undef(fonte) ? "Luckiest Guy" : fonte;
function _tam()   = is_undef(tamanho_nome) ? 8 : max(5, min(16, tamanho_nome));
function _larg()  = is_undef(largura) ? 45 : max(25, min(80, largura));
function _esp()   = is_undef(espessura) ? 3 : max(2, min(5, espessura));
function _vidro() = is_undef(espessura_vidro) ? 2.5 : max(1, min(6, espessura_vidro));
function _modo()  = is_undef(modo) ? "tudo" : modo;

function _nome(i) =
    i == 0 ? (is_undef(nome_1)  ? "" : nome_1)  : i == 1 ? (is_undef(nome_2)  ? "" : nome_2)  :
    i == 2 ? (is_undef(nome_3)  ? "" : nome_3)  : i == 3 ? (is_undef(nome_4)  ? "" : nome_4)  :
    i == 4 ? (is_undef(nome_5)  ? "" : nome_5)  : i == 5 ? (is_undef(nome_6)  ? "" : nome_6)  :
    i == 6 ? (is_undef(nome_7)  ? "" : nome_7)  : i == 7 ? (is_undef(nome_8)  ? "" : nome_8)  :
    i == 8 ? (is_undef(nome_9)  ? "" : nome_9)  : i == 9 ? (is_undef(nome_10) ? "" : nome_10) :
    i == 10 ? (is_undef(nome_11) ? "" : nome_11) : (is_undef(nome_12) ? "" : nome_12);
function _esc(i) =
    i == 0 ? (is_undef(esc_nome_1)  ? 1 : esc_nome_1)  : i == 1 ? (is_undef(esc_nome_2)  ? 1 : esc_nome_2)  :
    i == 2 ? (is_undef(esc_nome_3)  ? 1 : esc_nome_3)  : i == 3 ? (is_undef(esc_nome_4)  ? 1 : esc_nome_4)  :
    i == 4 ? (is_undef(esc_nome_5)  ? 1 : esc_nome_5)  : i == 5 ? (is_undef(esc_nome_6)  ? 1 : esc_nome_6)  :
    i == 6 ? (is_undef(esc_nome_7)  ? 1 : esc_nome_7)  : i == 7 ? (is_undef(esc_nome_8)  ? 1 : esc_nome_8)  :
    i == 8 ? (is_undef(esc_nome_9)  ? 1 : esc_nome_9)  : i == 9 ? (is_undef(esc_nome_10) ? 1 : esc_nome_10) :
    i == 10 ? (is_undef(esc_nome_11) ? 1 : esc_nome_11) : (is_undef(esc_nome_12) ? 1 : esc_nome_12);

W        = 2.0;    // largura da barra e do gancho (mm)
SOBRE    = 0.4;    // quanto as letras entram na barra (para ficarem agarradas)
PERNA    = 22;     // comprimento da perna de dentro (mm)
PONTA    = 3;      // aba da ponta, aberta para fora (mm)

// folgas (entre as faces de dentro): no "U" um pouco mais do que o vidro (a borda é
// arredondada), na ponta um pouco menos (para apertar)
function _gU()    = _vidro() + 1.2;
function _gP()    = max(0.6, _vidro() - 0.6);
function _rc()    = (_gU() + W) / 2;                  // raio da linha central do "U"
function _xi()    = -4 - _larg() - 2;                 // início da barra

module osso(a, b, r) { hull() { translate(a) circle(r); translate(b) circle(r); } }

module gancho2d() {
    rc = _rc();
    osso([_xi(), 0], [0, 0], W/2);                                    // barra do nome
    translate([0, -rc]) intersection() {                              // "U"
        difference() { circle(rc + W/2); circle(rc - W/2); }
        translate([0, -rc - W]) square([rc + W, 2*rc + 2*W]);
    }
    a = [0, -2*rc]; b = [-PERNA, -(_gP() + W)];                       // perna de dentro
    osso(a, b, W/2);
    osso(b, b + [-PONTA*cos(30), -PONTA*sin(30)], W/2);              // ponta aberta
}

module texto2d(i) {
    text(_nome(i), size=_tam()*_esc(i), font=_fonte(), halign="center", valign="baseline");
}

// Medidas das fontes do servidor (fração do size do OpenSCAD), feitas com o opentype.js:
//   [fonte, limiar, esticão, base]
//   limiar  = topo da maiúscula mais alta + 0.01 — o que fica acima disto são acentos
//   esticão = maior distância acento→letra + 0.06: os acentos (Ã, É, Ê, Ó…) ficariam soltos e
//             sairiam como bocadinhos separados, por isso a parte acima do limiar é "esticada" para
//             baixo até entrar um pouco na letra (o topo das letras fica abaixo do limiar e os
//             buracos do O/A/B não enchem)
//   base    = quanto a letra mais "levantada" fica acima da linha de base (Luckiest Guy salta)
// Para acrescentar uma fonte: medir com scripts/medir_fontes_borda.mjs e juntar aqui e no select.
FONTES = [
    ["Luckiest Guy", 1.015, 0.162, 0.066],
    ["Anton", 1.214, 0.135, 0.001],
    ["Sigmar One", 0.984, 0.153, 0.006],
    ["Oswald", 1.15, 0.185, 0],
    ["Racing Sans One", 0.906, 0.164, 0],
    ["Baloo 2", 0.875, 0.15, 0],
    ["Chewy", 1.072, 0.156, 0],
    ["Pacifico", 1.228, 0.156, 0],
    ["Lobster", 1.061, 0.156, 0],
    ["Aladin", 1.025, 0.122, 0],
    ["Amarante", 1.095, 0.179, 0],
    ["Press Start 2P", 1.399, 0, 0.174],
    ["Open Sans", 1.017, 0.161, 0.001]];
function _fm() = let(m = [for (a = FONTES) if (a[0] == _fonte()) a]) len(m) ? m[0] : ["", 1.02, 0.19, 0.07];

module nome2d(i) {
    s = _tam()*_esc(i); a = _fm();
    if (_nome(i) != "")
        translate([_xi() + 2 + _larg()/2, W/2 - SOBRE - a[3]*s]) intersection() {
          // nada passa para baixo da barra (é o lado do vidro): corta a cedilha do Ç e as pernas do g/p/j
          translate([-500, -W + SOBRE + a[3]*s]) square([1000, 100]);
          offset(delta=0.01) union() {
            texto2d(i);
            minkowski() {
                intersection() { texto2d(i); translate([-500, a[1]*s]) square([1000, 2*s]); }
                translate([-0.01, -a[2]*s]) square([0.02, a[2]*s]);
            }
          }
        }
}

module corpo1()  { linear_extrude(_esp()) gancho2d(); }
module nome1(i)  { linear_extrude(_esp()) difference() { nome2d(i); gancho2d(); } }
module junto1(i) { linear_extrude(_esp()) union() { gancho2d(); nome2d(i); } }   // uma só peça, letras agarradas à barra

// ---------- arrumação na mesa (em coluna, como na foto; duas colunas a partir de 7) ----------
function _porcol() = _q() > 6 ? ceil(_q() / 2) : _q();
function _passoY() = _tam()*1.55 + 2*_rc() + W + 2;   // 1.55: acentos altos (Anton, Press Start)
function _passoX() = _larg() + 6 + 2*_rc() + W + 8;
function pos(i) = [floor(i / _porcol()) * _passoX(), -(i % _porcol()) * _passoY()];

if (_modo() == "corpo")
    for (i=[0:_q()-1]) translate(pos(i)) corpo1();
if (_modo() == "nome")
    for (i=[0:_q()-1]) translate(pos(i)) nome1(i);
if (_modo() == "uma_peca" || _modo() == "tudo")
    for (i=[0:_q()-1]) translate(pos(i)) junto1(i);
