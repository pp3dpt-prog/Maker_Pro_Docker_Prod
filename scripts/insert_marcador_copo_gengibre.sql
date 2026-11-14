-- Marcadores de copo — boneco de gengibre (2026-11-14), em RASCUNHO, família Decoração
-- (ao lado de marcadores_copo_clip; mesmas flags: acesso gratuito, 1 crédito, CC-BY-NC).
-- Template em templates/marcador_copo_gengibre.scad. Pré-visualização no servidor por partes
-- (preview_servidor + preview_por_partes), como os marcadores com clip.
-- Multicor: corpo / cobertura / laco_1…laco_8 (agrupar_por_cor); sem AMS: bonecos.stl + um STL por laço.
-- O generation_schema é posto a seguir por insert_marcador_copo_gengibre_schema.sql.
-- Para publicar: miniatura (Admin → Miniaturas) e estado = 'ativo'.
insert into prod_designs (id, nome, descricao, familia, estado, acesso_maker, disponivel_consumidor, capa_familia, usa_modo,
  licenca, preco_creditos, tags, scad_template, generation_schema, parametros_default)
values ('marcador_copo_gengibre', 'Marcadores de copo — boneco de gengibre', 'Marcadores de copo em forma de boneco de gengibre: argola na mão que prende no pé do copo, cara e linhas de açúcar em relevo noutra cor, nome opcional na barriga e um laço de cor diferente em cada um, impresso à parte e colado numa saliência do pescoço. Até 8 de uma vez, 3MF multicor.',
  'Decoração', 'rascunho', 'gratuito', false, false, false, 'CC-BY-NC', 1,
  array['marcador', 'copo', 'natal', 'gengibre', 'boneco', 'festa', 'nome', 'argola', 'laço', 'personalizado', '3mf', 'multicor'],
  $tpl$// ── MARCADORES DE COPO — BONECO DE GENGIBRE ──
// Boneco plano com uma argola em C na mão levantada (prende no pé do copo), cobertura de
// açúcar em relevo (olhos, sorriso, linhas nos pulsos e tornozelos e nome opcional na barriga)
// e um lacinho impresso à parte, de cor diferente em cada marcador, que encaixa numa saliência
// no pescoço e se cola. Até 8 marcadores de uma vez, já arrumados na mesa.
//
// Parâmetros:
//   quantidade        1–8 marcadores
//   nome_1 … nome_8   nome opcional na barriga; esc_nome_<i> (0–1) é calculado pelo servidor
//                     (lib/textFit.js, generation_schema.ajuste_texto) para caber na barriga
//   fonte             tipo de letra do nome
//   altura_boneco     altura do boneco (mm) — escala o desenho; a argola não escala
//   espessura         espessura do boneco (mm) — sem AMS é a altura da troca de cor
//   diametro_pe       diâmetro do pé do copo (mm); a abertura da argola é 75 % disto
//   folga             folga do encaixe do laço na saliência (mm)
//   modo              "corpo" | "cobertura" | "laco_<i>" | "lacos" | "uma_peca" | "tudo"

function _q()     = is_undef(quantidade) ? 4 : max(1, min(8, round(quantidade)));
function _alt()   = is_undef(altura_boneco) ? 38 : max(28, min(55, altura_boneco));
function _esp()   = is_undef(espessura) ? 3 : max(2.4, min(4, espessura));
function _pe()    = is_undef(diametro_pe) ? 8 : max(4, min(14, diametro_pe));
function _folga() = is_undef(folga) ? 0.2 : max(0.05, min(0.5, folga));
function _fonte() = is_undef(fonte) ? "Luckiest Guy" : fonte;
function _modo()  = is_undef(modo) ? "tudo" : modo;

function _nomes() = [ is_undef(nome_1) ? "" : nome_1, is_undef(nome_2) ? "" : nome_2,
          is_undef(nome_3) ? "" : nome_3, is_undef(nome_4) ? "" : nome_4,
          is_undef(nome_5) ? "" : nome_5, is_undef(nome_6) ? "" : nome_6,
          is_undef(nome_7) ? "" : nome_7, is_undef(nome_8) ? "" : nome_8 ];
function _escs() = [ is_undef(esc_nome_1) ? 1 : esc_nome_1, is_undef(esc_nome_2) ? 1 : esc_nome_2,
          is_undef(esc_nome_3) ? 1 : esc_nome_3, is_undef(esc_nome_4) ? 1 : esc_nome_4,
          is_undef(esc_nome_5) ? 1 : esc_nome_5, is_undef(esc_nome_6) ? 1 : esc_nome_6,
          is_undef(esc_nome_7) ? 1 : esc_nome_7, is_undef(esc_nome_8) ? 1 : esc_nome_8 ];

NOMINAL     = 36;    // altura para que o desenho foi feito (mm)
function _k() = _alt() / NOMINAL;   // (funções: os parâmetros do cliente vêm no fim do ficheiro)
ALT_COB     = 0.6;   // relevo da cobertura (mm)
LINHA       = 0.9;   // largura das linhas de açúcar (mm)
PAREDE      = 1.8;   // largura do anel da argola (mm)
ABERTURA    = 0.75;  // abertura da argola, em fração do diâmetro do pé
ANG_ABERT   = 145;   // direção da abertura (graus)
TAM_NOME    = 3.2;   // tamanho da letra do nome, no desenho nominal (mm)
LARG_NOME   = 11;    // largura útil da barriga, no desenho nominal (mm) — igual ao ajuste_texto
L_LACO      = 9.5;   // largura do laço, no desenho nominal (mm)
ESP_LACO    = 2;     // espessura do laço (mm)
ALT_SAL     = 1.0;   // altura da saliência do pescoço (mm)
SAL         = [4.2, 2.4];   // saliência (rectângulo arredondado — trava a rotação do laço)
MAO         = [-12.5, 8.5];
PESCOCO     = [0, 4.6];

// ---------- 2D (desenho nominal, 36 mm) ----------
module osso(a, b, r) { hull() { translate(a) circle(r); translate(b) circle(r); } }

module silhueta() {
    offset(r=-1.2) offset(r=1.2) union() {
        translate([0, 11]) circle(7.2);               // cabeça
        osso([0, 2], [0, -3.5], 6.6);                 // tronco
        osso([-4, 3.5], MAO, 3.3);                    // braço levantado
        osso([4, 3.5], [12, 1.5], 3.3);               // braço
        osso([-3, -5], [-6.5, -14.5], 3.7);           // pernas
        osso([3, -5], [6.5, -14.5], 3.7);
    }
}

module onda(c, ang, L, n=2, amp=0.7) {               // linha de açúcar ondulada
    pts = [for (i=[0:24*n]) let(t=i/(24*n)) [(t-0.5)*L, amp*sin(360*n*t)]];
    translate(c) rotate(ang) for (i=[0:len(pts)-2]) osso(pts[i], pts[i+1], LINHA/2/_k());
}

module laco2d(t=0) {
    w = L_LACO; h = w*0.62;
    offset(r=t) offset(r=0.8) offset(r=-0.8) union() {
        for (s=[-1,1]) hull() {
            square([2.4, h*0.45], center=true);
            translate([s*w/2*0.82,  h*0.32]) circle(w*0.09);
            translate([s*w/2*0.82, -h*0.32]) circle(w*0.09);
        }
        square([w*0.28, h*0.62], center=true);
    }
}

module saliencia2d(t=0) { offset(r=0.6+t) square(SAL - [1.2, 1.2], center=true); }

// argola em mm reais (não escala com o boneco: o pé do copo é o que é)
module argola2d() {
    ri = _pe()/2; ro = ri + PAREDE;
    dir = [-0.62, 0.78];
    cc = MAO*_k() + dir*(ro + 1.6*_k());
    a2 = 2*asin(min(0.99, ABERTURA*_pe()/2/(ri + PAREDE/2)));
    translate(cc) difference() {
        circle(ro);
        circle(ri);
        rotate(ANG_ABERT) polygon([[0,0], [3*ro*cos(-a2/2), 3*ro*sin(-a2/2)], [3*ro*cos(a2/2), 3*ro*sin(a2/2)]]);
    }
    for (s=[-1,1]) translate(cc) rotate(ANG_ABERT + s*a2/2) translate([ri + PAREDE/2, 0]) circle(PAREDE/2);
    hull() { translate(MAO*_k()) circle(2.4*_k()); translate(cc - dir*(ro - 0.6)) circle(1.6); }
}

module cobertura2d(i) {
    scale(_k()) difference() {
        union() {
            translate([-2.6, 12.4]) circle(1.0);      // olhos
            translate([ 2.6, 12.4]) circle(1.0);
            intersection() {                          // sorriso
                translate([0, 10.2]) difference() { circle(3.0); circle(3.0 - LINHA/_k()); }
                translate([-5, 2]) square([10, 8.2]);
            }
            onda([-11.0, 7.6], 59, 5.6);              // pulsos
            onda([10.4, 1.9], 104, 5.6);
            onda([-5.5, -12.0], 21, 6.4, 2.5);        // tornozelos
            onda([5.5, -12.0], -21, 6.4, 2.5);
            if (_nomes()[i] != "")
                translate([0, -2.6]) offset(delta=0.01)
                    text(_nomes()[i], size=TAM_NOME*_escs()[i], font=_fonte(), halign="center", valign="center");
        }
        translate(PESCOCO) laco2d(0.3);              // não pisa a zona do laço
    }
}

// ---------- peças (na origem de cada marcador) ----------
module corpo1() {
    linear_extrude(_esp()) union() { scale(_k()) silhueta(); argola2d(); }
    translate([PESCOCO[0]*_k(), PESCOCO[1]*_k(), _esp() - 0.01]) linear_extrude(ALT_SAL + 0.01) saliencia2d();
}
module cobertura1(i) { translate([0, 0, _esp() - 0.01]) linear_extrude(ALT_COB + 0.01) cobertura2d(i); }
module laco1() {   // imprime-se com o encaixe virado para a mesa
    lk = L_LACO*_k(); hk = lk*0.62;
    difference() {
        union() {
            linear_extrude(ESP_LACO) scale(_k()) laco2d();
            translate([0, 0, ESP_LACO - 0.01]) linear_extrude(0.5)
                offset(r=0.4) offset(r=-0.4) square([lk*0.28, hk*0.62], center=true);
            for (s=[-1,1]) translate([s*lk*0.3, 0, ESP_LACO - 0.01])
                linear_extrude(0.35) rotate(s*25) square([0.7, hk*0.4], center=true);
        }
        translate([0, 0, -0.01]) linear_extrude(ALT_SAL + _folga() + 0.01) saliencia2d(_folga());
    }
}

// ---------- arrumação na mesa ----------
function _cols()  = min(_q(), 4);
function _passo() = [44*_k() + _pe()/2 + PAREDE + 4, 42*_k() + 4];
function pos(i)  = [(i % _cols())*_passo()[0], -floor(i / _cols())*_passo()[1]];
function posL(i) = pos(i) + [19*_k() + 1, -13*_k()];        // laço ao lado dos pés

if (_modo() == "corpo" || _modo() == "uma_peca" || _modo() == "tudo")
    for (i=[0:_q()-1]) translate(pos(i)) corpo1();
if (_modo() == "cobertura" || _modo() == "uma_peca" || _modo() == "tudo")
    for (i=[0:_q()-1]) translate(pos(i)) cobertura1(i);
if (_modo() == "lacos" || _modo() == "tudo")
    for (i=[0:_q()-1]) translate(posL(i)) laco1();
for (i=[0:7]) if (_modo() == str("laco_", i+1) && i < _q()) translate(posL(i)) laco1();
$tpl$,
  '{}'::jsonb, '{}'::jsonb);
