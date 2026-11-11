// ── ORGANIZADOR DE GAVETA (módulos à medida) ──
// O cliente escolhe módulos de uma lista e coloca-os na gaveta no editor do configurador
// (Maker_Pro_Frontend_Prod/components/EditorGaveta.tsx). A pré-visualização
// (lib/organizadorGaveta.ts) faz exactamente as mesmas contas que este ficheiro.
//
// Parâmetros injectados pelo backend:
//   gaveta_largura, gaveta_profundidade, gaveta_altura   interior da gaveta (mm)
//   altura_modulos      altura dos módulos (limitada à altura da gaveta)
//   parede, fundo, raio espessuras e raio dos cantos
//   folga               espaço total entre módulos vizinhos (metade para cada lado)
//   modulos             lista de [x, y, largura, profundidade, div_x, div_y, tipo]
//                       x, y a partir do canto frente-esquerda da gaveta (mm);
//                       tipo 0 = normal, 1 = fundo côncavo na frente (peças pequenas)
//   modo                "montado" = na posição da gaveta | outro = espalhados para imprimir
//
// Para imprimir: no slicer, "Dividir em objetos" e "Organizar" (vários pratos se preciso).

function _n(v, d) = is_num(v) ? v : d;
function _c(v, a, b) = min(max(v, a), b);

function GW()   = _c(_n(gaveta_largura, 300), 40, 1000);
function GD()   = _c(_n(gaveta_profundidade, 400), 40, 1000);
function GH()   = _c(_n(gaveta_altura, 60), 15, 300);
function HM()   = min(_c(_n(altura_modulos, 50), 10, 250), GH() - 1);
function WALL() = _c(_n(parede, 1.6), 0.8, 4);
function BOT()  = _c(_n(fundo, 1.2), 0.8, 4);
function RAIO() = _c(_n(raio, 4), 0.5, 15);
function FOLGA()= _c(_n(folga, 0.6), 0, 3);
function DT()   = 1.2;                         // espessura das divisórias
function MODO() = is_undef(modo) ? "" : modo;

// módulos válidos (dentro da gaveta, medidas mínimas); máximo 60
function _ok(m) = is_list(m) && len(m) >= 4 && is_num(m[0]) && is_num(m[1]) && is_num(m[2]) && is_num(m[3])
                  && m[2] >= 10 && m[3] >= 10 && m[0] >= 0 && m[1] >= 0
                  && m[0] + m[2] <= GW() + 0.01 && m[1] + m[3] <= GD() + 0.01;
function MODS() = let(l = is_list(modulos) ? modulos : []) [for (i = [0 : min(len(l), 60) - 1]) if (_ok(l[i])) l[i]];

function DIVX(m) = round(_c(len(m) > 4 && is_num(m[4]) ? m[4] : 1, 1, 10));
function DIVY(m) = round(_c(len(m) > 5 && is_num(m[5]) ? m[5] : 1, 1, 10));
function TIPO(m) = len(m) > 6 && is_num(m[6]) ? round(m[6]) : 0;

// pegada real: cada módulo encolhe folga/2 de cada lado
function FX(m) = m[0] + FOLGA() / 2;
function FY(m) = m[1] + FOLGA() / 2;
function FW(m) = m[2] - FOLGA();
function FD(m) = m[3] - FOLGA();
function RR(m) = min(RAIO(), FW(m) / 2 - 0.01, FD(m) / 2 - 0.01);

module rrect(w, d, r, h) {
    if (r <= 0.05) cube([w, d, h]);
    else hull() for (x = [r, w - r], y = [r, d - r]) translate([x, y, 0]) cylinder(h = h, r = r, $fn = 32);
}

// um módulo na origem (canto frente-esquerda, z = 0)
module modulo(m) {
    w = FW(m); d = FD(m); r = RR(m);
    iw = w - 2 * WALL(); id = d - 2 * WALL();
    ri = max(r - WALL(), 0.01);
    union() {
        difference() {
            rrect(w, d, r, HM());
            translate([WALL(), WALL(), BOT()]) rrect(iw, id, ri, HM());
        }
        // divisórias (um pouco abaixo do topo, para os dedos)
        hd = HM() - BOT() - 2;
        if (DIVX(m) > 1) for (i = [1 : DIVX(m) - 1])
            translate([WALL() + i * iw / DIVX(m) - DT() / 2, WALL() - 0.01, BOT() - 0.01]) cube([DT(), id + 0.02, hd]);
        if (DIVY(m) > 1) for (j = [1 : DIVY(m) - 1])
            translate([WALL() - 0.01, WALL() + j * id / DIVY(m) - DT() / 2, BOT() - 0.01]) cube([iw + 0.02, DT(), hd]);
        // fundo côncavo junto à parede da frente de cada fila (rampa em quarto de círculo)
        if (TIPO(m) == 1) {
            rc = min(15, (HM() - BOT()) * 0.6, id / DIVY(m) * 0.6);
            for (j = [0 : DIVY(m) - 1])
                translate([WALL() - 0.01, WALL() + j * id / DIVY(m) + (j > 0 ? DT() / 2 : 0) - 0.01, BOT() - 0.01])
                    difference() {
                        cube([iw + 0.02, rc, rc]);
                        translate([-1, rc, rc]) rotate([0, 90, 0]) cylinder(h = iw + 2.04, r = rc, $fn = 48);
                    }
        }
    }
}

// espalhado para imprimir: cada módulo afasta-se 6 mm por cada módulo que lhe fica atrás/à esquerda
// (nunca se tocam: dois módulos estão sempre separados em x ou em y na gaveta)
function _rx(m) = len([for (o = MODS()) if (o[0] < m[0] - 0.01) 1]);
function _ry(m) = len([for (o = MODS()) if (o[1] < m[1] - 0.01) 1]);

module main() {
    for (m = MODS()) {
        if (MODO() == "montado") translate([FX(m), FY(m), 0]) modulo(m);
        else translate([FX(m) + 6 * _rx(m), FY(m) + 6 * _ry(m), 0]) modulo(m);
    }
}

main();
