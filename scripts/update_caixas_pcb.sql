-- Caixas PCB (universal, Raspberry Pi 4, Raspberry Pi Zero): corrige os 3 designs.
-- SQL editor do Supabase. Re-executável (UPDATE por id).
--
-- O que estava mal:
--   * generation_schema só tinha metadados (sem "parameters"): o formulário aparecia vazio;
--     o schema completo estava em ui_schema, que a aplicação não lê
--   * scad_template das caixas rpi4 e rpi-zero estava corrompido (linhas cortadas a meio)
--   * no template antigo: a tampa saía oca (só moldura), os postes eram furos, as orelhas não
--     apareciam, e o seletor "Tipo USB" não tinha opções (options fora de ui)
--   * os valores por defeito do Pi 4 / Pi Zero (parametros_default) não chegavam ao formulário
-- Ordem: aplicar depois do deploy do backend (não há dependência, mas o template novo é lido
-- da base de dados, por isso podes aplicar já). Os 3 designs usam o MESMO template.

UPDATE prod_designs SET
  scad_template = $scad$
// ── CAIXA PCB PARAMÉTRICA COM TAMPA ──
// Usada pelos designs caixa-pcb-universal, caixa-pcb-rpi4 e caixa-pcb-rpi-zero (mudam só
// os valores por defeito do generation_schema).
//
// Parâmetros injectados pelo backend:
//   pcb_w, pcb_l, pcb_h     interior (X, Y) e altura livre acima do fundo
//   wall, bottom, lid_gap   parede, fundo e folga da tampa
//   screw_posts, post_d, post_h   postes para a PCB (furo-piloto M3 de 2.5 mm)
//   vent_slots, vent_w      ranhuras nas paredes compridas (x = 0 e x = EXT_W)
//   gpio_cutout, gpio_w, gpio_h   recorte na parede curta da frente (y = 0)
//   usb_cutout, usb_type    recorte na parede comprida da esquerda (x = 0)
//   mount_ears, ear_hole_d  orelhas de fixação nos lados
//   hinge_type              "pin" (nós + pino de filamento) ou "living" (tira flexível)
//   hinge_count, hinge_pin_d
//   modo                    "corpo" | "tampa" | "preview" | (vazio = corpo + tampa)
//
// Todas as injectadas são lidas por funções (avaliadas só na instanciação), por isso a
// ordem de injecção — antes ou depois deste texto — é indiferente. Não há variáveis de
// topo derivadas das injectadas.
//
// Peças (orientação de impressão, sem suportes):
//   corpo  — caixa com postes, ranhuras, recortes, orelhas e (pin) nós da dobradiça
//   tampa  — placa com rebordo que encaixa no interior; (pin) nós, (living) tira ligada
// "pin": passa-se um bocado de filamento 1.75 mm (hinge_pin_d + folga) por todos os nós.
// "living": a tampa sai ligada ao corpo por uma tira de 0.6 mm que dobra ao longo da
//           parede de trás e fecha sobre a caixa.

// ── leitura segura dos parâmetros ──
function _n(v, d) = is_num(v) ? v : d;
function _b(v, d) = is_undef(v) ? d : (v == true || v == 1 || v == "true");
function _s(v, d) = is_string(v) ? v : d;

function PW()   = max(_n(pcb_w, 50), 10);
function PL()   = max(_n(pcb_l, 70), 10);
function PH()   = max(_n(pcb_h, 12), 3);
function WALL() = max(_n(wall, 2.5), 1.2);
function BOT()  = max(_n(bottom, 2), 1.2);
function GAP()  = max(_n(lid_gap, 0.25), 0.1);

function EW()  = PW() + 2 * WALL();
function EL()  = PL() + 2 * WALL();
function HB()  = BOT() + PH();                 // altura do corpo
function LIDT() = max(WALL(), 1.6);            // espessura da tampa
function LIPH() = min(2.5, PH() - 1);          // altura do rebordo
function LIPT() = 1.2;                         // espessura do rebordo

function POSTS()  = _b(screw_posts, true);
function POSTD()  = max(_n(post_d, 4.5), 3.2);
function POSTH()  = min(max(_n(post_h, 6), 2), PH() - 1);
function POSTIN() = 3.5;                       // furo da PCB a 3.5 mm do bordo
function ZP()     = BOT() + (POSTS() ? POSTH() : 0);   // cota da face de baixo da PCB

function VENTS()  = _b(vent_slots, false);
function VENTW()  = max(_n(vent_w, 1.5), 0.8);

function GPIO()   = _b(gpio_cutout, false);
function GPIOW()  = min(max(_n(gpio_w, 15), 1), PW() - 2);
function GPIOH()  = max(min(_n(gpio_h, 8), HB() - ZP() - 1), 1);

function USB()    = _b(usb_cutout, false);
function USBT()   = _s(usb_type, "c");
function USBDIM() = USBT() == "micro" ? [7.5, 2.8] :
                    USBT() == "mini"  ? [8.0, 3.5] :
                    USBT() == "usb_a" ? [12.5, 5.5] : [9.0, 3.2];   // c por defeito
function USBH()   = max(min(USBDIM()[1] + 1, HB() - ZP() - 1), 1);

function EARS()   = _b(mount_ears, false);
function EARD()   = max(_n(ear_hole_d, 4.2), 3);

function LIVING() = _s(hinge_type, "pin") == "living";
function HN()     = round(min(max(_n(hinge_count, 2), 2), 4));
function PIND()   = max(_n(hinge_pin_d, 1.6), 1.2);
function KR()     = PIND() / 2 + 1.4;                   // raio dos nós
function KDY()    = KR() + 0.2;                         // eixo atrás da parede
function HGAP()   = 0.3;                                // folga tampa/corpo na dobradiça
function ZA()     = HB() + HGAP() + LIDT() - KR();      // cota do eixo (fechado)
function PITCH()  = EW() / HN();
function LK()     = min(8, (PITCH() - 3) / 2);          // comprimento de um nó
function STRAP_T() = 0.6;
function STRAP_L() = HB() + LIDT() + 2;                 // da base de trás ao rebordo da tampa

function _modo() = is_undef(modo) ? "" : modo;

// ── blocos ──
module rcube(p, s) { translate(p) cube(s); }

module cavidade() {
    translate([WALL(), WALL(), BOT()]) cube([PW(), PL(), PH() + 1]);
}

module posicoes_postes() {
    for (x = [WALL() + POSTIN(), WALL() + PW() - POSTIN()],
         y = [WALL() + POSTIN(), WALL() + PL() - POSTIN()])
        translate([x, y, 0]) children();
}

module ranhuras() {
    h = HB() - BOT() - 4;
    pitch = VENTW() * 2.5;
    n = floor((PL() - 8) / pitch);
    if (h >= 2 && n >= 1)
        for (i = [0 : n - 1]) {
            y = WALL() + PL() / 2 + (i - (n - 1) / 2) * pitch - VENTW() / 2;
            translate([-1, y, BOT() + 2]) cube([WALL() + 2, VENTW(), h]);
            translate([EW() - WALL() - 1, y, BOT() + 2]) cube([WALL() + 2, VENTW(), h]);
        }
}

module recorte_gpio() {
    translate([EW() / 2 - GPIOW() / 2, -1, ZP()]) cube([GPIOW(), WALL() + 2, GPIOH()]);
}

module recorte_usb() {
    translate([-1, EL() / 2 - USBDIM()[0] / 2, ZP()]) cube([WALL() + 2, USBDIM()[0], USBH()]);
}

// orelhas: no plano do fundo, para fora das paredes compridas
function EARL() = 10;
function EART() = max(BOT(), 2);
function earys() = EL() >= 50 ? [EL() * 0.25, EL() * 0.75] : [EL() / 2];
module orelha_solida(lado, y) {
    cx = lado < 0 ? -EARL() + 5 - 0 : EW() + EARL() - 5;      // centro do furo
    hull() {
        translate([cx, y, 0]) cylinder(h = EART(), r = 5, $fn = 32);
        translate([lado < 0 ? 0 : EW() - 0.01, y - 5, 0]) cube([0.01, 10, EART()]);
    }
}
module orelhas() {
    for (l = [-1, 1], y = earys()) orelha_solida(l, y);
}
module furos_orelhas() {
    for (l = [-1, 1], y = earys())
        translate([l < 0 ? -EARL() + 5 : EW() + EARL() - 5, y, -1])
            cylinder(h = EART() + 2, d = EARD(), $fn = 32);
}

// ── dobradiça de pino ──
module no_corpo(xc) {
    x0 = xc - LK() - 0.2;
    hull() {
        translate([x0, EL() + KDY(), ZA()]) rotate([0, 90, 0]) cylinder(h = LK(), r = KR(), $fn = 40);
        translate([x0, EL() - WALL(), HB() - 0.01]) cube([LK(), WALL(), 0.01]);
    }
}
module no_tampa(xc) {                        // orientação de impressão (placa em z = 0)
    // Mesmas posições x que os nós do corpo: a tampa fecha-se virando-a como a página de um
    // livro (espelho em x, o bordo da dobradiça fica atrás), o que a põe nas posições
    // intercaladas com as do corpo.
    x0 = xc - LK() - 0.2;
    hull() {
        translate([x0, EL() + KDY(), KR()]) rotate([0, 90, 0]) cylinder(h = LK(), r = KR(), $fn = 40);
        translate([x0, EL() - 0.01, 0]) cube([LK(), 0.01, LIDT()]);
    }
}
module furo_pino() {
    translate([-1, EL() + KDY(), ZA()]) rotate([0, 90, 0])
        cylinder(h = EW() + 2, d = PIND() + 0.25, $fn = 24);
}

// ── peças ──
module corpo() {
    difference() {
        union() {
            difference() {
                cube([EW(), EL(), HB()]);
                cavidade();
                if (VENTS()) ranhuras();
                if (GPIO()) recorte_gpio();
                if (USB()) recorte_usb();
            }
            if (POSTS())
                posicoes_postes() translate([0, 0, BOT() - 0.01]) cylinder(h = POSTH() + 0.01, d = POSTD(), $fn = 40);
            if (EARS()) orelhas();
            if (!LIVING()) for (i = [0 : HN() - 1]) no_corpo(PITCH() * (i + 0.5));
            if (LIVING())
                translate([2, EL() - 1, 0]) cube([EW() - 4, STRAP_L() + 1, STRAP_T()]);
        }
        if (POSTS())
            posicoes_postes() translate([0, 0, BOT()]) cylinder(h = POSTH() + 1, d = 2.5, $fn = 24);
        if (EARS()) furos_orelhas();
        if (!LIVING()) {
            // o furo do pino só atravessa os nós, não a parede
            intersection() {
                furo_pino();
                union() for (i = [0 : HN() - 1]) {
                    translate([PITCH() * (i + 0.5) - LK() - 0.2 - 0.5, EL(), 0]) cube([LK() + 1, 2 * KR() + 1, HB() + 20]);
                }
            }
        }
    }
}

// Tampa em orientação de impressão: placa em z = 0, rebordo para cima.
module tampa_chapa() {
    cube([EW(), EL(), LIDT()]);
    // rebordo que encaixa na cavidade com folga lid_gap (e recortado nos postes)
    difference() {
        translate([WALL() + GAP(), WALL() + GAP(), LIDT() - 0.01])
            cube([PW() - 2 * GAP(), PL() - 2 * GAP(), LIPH() + 0.01]);
        translate([WALL() + GAP() + LIPT(), WALL() + GAP() + LIPT(), LIDT() - 1])
            cube([PW() - 2 * GAP() - 2 * LIPT(), PL() - 2 * GAP() - 2 * LIPT(), LIPH() + 2]);
        if (POSTS())
            posicoes_postes() translate([0, 0, LIDT() - 1]) cylinder(h = LIPH() + 2, d = POSTD() + 2 * GAP() + 1, $fn = 40);
    }
}

module tampa() {
    difference() {
        union() {
            tampa_chapa();
            if (!LIVING()) for (i = [0 : HN() - 1]) no_tampa(PITCH() * (i + 0.5));
        }
        // folga para os nós do corpo (que, com a tampa fechada, ficam nestes intervalos de x)
        if (!LIVING())
            for (i = [0 : HN() - 1])
                translate([PITCH() * (i + 0.5) + 0.2 - 0.3, EL() - WALL(), -1])
                    cube([LK() + 0.6, WALL() + 1, LIDT() + 2]);
        if (!LIVING())
            intersection() {
                translate([-1, EL() + KDY(), KR()]) rotate([0, 90, 0])
                    cylinder(h = EW() + 2, d = PIND() + 0.25, $fn = 24);
                union() for (i = [0 : HN() - 1])
                    translate([PITCH() * (i + 0.5) - LK() - 0.2 - 0.5, EL(), -1]) cube([LK() + 1, 2 * KR() + 1, 20]);
            }
    }
    if (LIVING()) translate([2, -STRAP_L() - 1, 0]) cube([EW() - 4, STRAP_L() + 1.01, STRAP_T()]);
}
// Fechado, para a pré-visualização: a tampa vira-se 180° como a página de um livro
// (em torno do eixo Y), por isso o bordo da dobradiça continua atrás.
module tampa_fechada() {
    translate([EW(), 0, HB() + HGAP() + LIDT()]) rotate([0, 180, 0]) tampa();
}

module pcb_fantasma() {
    color([0, 0.5, 0, 0.35]) translate([WALL() + 0.1, WALL() + 0.1, ZP() + 0.05]) cube([PW() - 0.2, PL() - 0.2, 1.6]);
}

module lado_a_lado() {
    corpo();
    if (LIVING())
        translate([0, EL() + STRAP_L() + 1, 0]) tampa();
    else
        translate([EW() + 25, 0, 0]) tampa();
}

module main() {
    m = _modo();
    if (m == "corpo" || m == "base_pinos") corpo();
    else if (m == "tampa" || m == "tampa_simples") tampa();
    else if (m == "preview") { corpo(); if (LIVING()) translate([0, EL() + STRAP_L() + 1, 0]) tampa(); else tampa_fechada(); pcb_fantasma(); }
    else lado_a_lado();
}

main();
$scad$,
  generation_schema = $json${
  "name": "Caixa PCB Universal v2",
  "tags": [
    "pcb",
    "enclosure",
    "electronics",
    "project-box",
    "hinged"
  ],
  "entry": "inline",
  "modes": {
    "final": {
      "quality_fn": 100
    },
    "preview": {
      "quality_fn": 36
    }
  },
  "engine": "openscad",
  "version": 2,
  "category": "eletronica",
  "parameters": {
    "pcb_w": {
      "ui": {
        "step": 1,
        "label": "Largura PCB",
        "widget": "slider"
      },
      "max": 300,
      "min": 20,
      "type": "number",
      "unit": "mm",
      "order": 1,
      "default": 50,
      "required": true
    },
    "pcb_l": {
      "ui": {
        "step": 1,
        "label": "Comprimento PCB",
        "widget": "slider"
      },
      "max": 300,
      "min": 20,
      "type": "number",
      "unit": "mm",
      "order": 2,
      "default": 70,
      "required": true
    },
    "pcb_h": {
      "ui": {
        "step": 0.5,
        "label": "Altura livre componentes",
        "widget": "slider"
      },
      "max": 50,
      "min": 3,
      "type": "number",
      "unit": "mm",
      "order": 3,
      "default": 12,
      "required": true
    },
    "wall": {
      "ui": {
        "step": 0.2,
        "label": "Espessura parede",
        "widget": "slider"
      },
      "max": 8,
      "min": 1.2,
      "type": "number",
      "unit": "mm",
      "order": 4,
      "default": 2.5
    },
    "bottom": {
      "ui": {
        "step": 0.2,
        "label": "Espessura fundo",
        "widget": "slider"
      },
      "max": 8,
      "min": 1.2,
      "type": "number",
      "unit": "mm",
      "order": 5,
      "default": 2
    },
    "lid_gap": {
      "ui": {
        "step": 0.05,
        "label": "Folga tampa",
        "widget": "slider"
      },
      "max": 0.6,
      "min": 0.1,
      "type": "number",
      "unit": "mm",
      "order": 6,
      "default": 0.25
    },
    "screw_posts": {
      "ui": {
        "label": "Postes para parafuso M3",
        "widget": "checkbox"
      },
      "type": "boolean",
      "order": 7,
      "default": true
    },
    "post_d": {
      "ui": {
        "step": 0.1,
        "label": "Diâmetro poste",
        "widget": "slider",
        "visible_when": {
          "screw_posts": {
            "eq": 1
          }
        }
      },
      "max": 6,
      "min": 3.2,
      "type": "number",
      "unit": "mm",
      "order": 8,
      "default": 4.5
    },
    "post_h": {
      "ui": {
        "step": 1,
        "label": "Altura poste",
        "widget": "slider",
        "visible_when": {
          "screw_posts": {
            "eq": 1
          }
        }
      },
      "max": 20,
      "min": 4,
      "type": "number",
      "unit": "mm",
      "order": 9,
      "default": 6
    },
    "vent_slots": {
      "ui": {
        "label": "Ranhuras ventilação laterais",
        "widget": "checkbox"
      },
      "type": "boolean",
      "order": 10,
      "default": false
    },
    "vent_w": {
      "ui": {
        "step": 0.2,
        "label": "Largura ranhura",
        "widget": "slider",
        "visible_when": {
          "vent_slots": {
            "eq": 1
          }
        }
      },
      "max": 5,
      "min": 1,
      "type": "number",
      "unit": "mm",
      "order": 11,
      "default": 1.5
    },
    "gpio_cutout": {
      "ui": {
        "label": "Recorte GPIO (lado curto)",
        "widget": "checkbox"
      },
      "type": "boolean",
      "order": 12,
      "default": false
    },
    "gpio_w": {
      "ui": {
        "step": 1,
        "label": "Largura recorte GPIO",
        "widget": "slider",
        "visible_when": {
          "gpio_cutout": {
            "eq": 1
          }
        }
      },
      "max": 50,
      "min": 5,
      "type": "number",
      "unit": "mm",
      "order": 13,
      "default": 15
    },
    "gpio_h": {
      "ui": {
        "step": 0.5,
        "label": "Altura recorte GPIO",
        "widget": "slider",
        "visible_when": {
          "gpio_cutout": {
            "eq": 1
          }
        }
      },
      "max": 20,
      "min": 3,
      "type": "number",
      "unit": "mm",
      "order": 14,
      "default": 8
    },
    "usb_cutout": {
      "ui": {
        "label": "Recorte USB (lado longo)",
        "widget": "checkbox"
      },
      "type": "boolean",
      "order": 15,
      "default": false
    },
    "usb_type": {
      "ui": {
        "label": "Tipo USB",
        "widget": "select",
        "options": [
          "c",
          "micro",
          "mini",
          "usb_a"
        ],
        "visible_when": {
          "usb_cutout": {
            "eq": 1
          }
        }
      },
      "type": "select",
      "order": 16,
      "default": "c"
    },
    "mount_ears": {
      "ui": {
        "label": "Orelhas fixação parede",
        "widget": "checkbox"
      },
      "type": "boolean",
      "order": 17,
      "default": false
    },
    "ear_hole_d": {
      "ui": {
        "step": 0.1,
        "label": "Furo orelha",
        "widget": "slider",
        "visible_when": {
          "mount_ears": {
            "eq": 1
          }
        }
      },
      "max": 6,
      "min": 3,
      "type": "number",
      "unit": "mm",
      "order": 18,
      "default": 4.2
    },
    "hinge_type": {
      "ui": {
        "label": "Tipo dobradiça",
        "widget": "select",
        "options": [
          "pin",
          "living"
        ]
      },
      "type": "select",
      "order": 19,
      "default": "pin"
    },
    "hinge_count": {
      "ui": {
        "step": 1,
        "label": "Nº dobradiças",
        "widget": "slider"
      },
      "max": 4,
      "min": 2,
      "type": "number",
      "order": 20,
      "default": 2
    },
    "hinge_pin_d": {
      "ui": {
        "step": 0.1,
        "label": "Diâmetro pino",
        "widget": "slider"
      },
      "max": 3,
      "min": 1.2,
      "type": "number",
      "unit": "mm",
      "order": 21,
      "default": 1.6
    }
  },
  "description": "Caixa paramétrica para PCB com postes de parafuso, ventilação opcional, recortes GPIO/USB personalizáveis e dobradiças integradas (pino print-in-place ou living hinge)",
  "validations": [
    {
      "rule": "wall < pcb_w / 2 && wall < pcb_l / 2",
      "message": "Parede demasiado grossa para o tamanho da PCB"
    },
    {
      "rule": "bottom < pcb_h + 5",
      "message": "Fundo não deve exceder altura interna"
    },
    {
      "rule": "post_h <= pcb_h + bottom - 2",
      "message": "Poste demasiado alto para a caixa"
    }
  ]
}$json$::jsonb
WHERE id = 'caixa-pcb-universal';

UPDATE prod_designs SET
  scad_template = $scad$
// ── CAIXA PCB PARAMÉTRICA COM TAMPA ──
// Usada pelos designs caixa-pcb-universal, caixa-pcb-rpi4 e caixa-pcb-rpi-zero (mudam só
// os valores por defeito do generation_schema).
//
// Parâmetros injectados pelo backend:
//   pcb_w, pcb_l, pcb_h     interior (X, Y) e altura livre acima do fundo
//   wall, bottom, lid_gap   parede, fundo e folga da tampa
//   screw_posts, post_d, post_h   postes para a PCB (furo-piloto M3 de 2.5 mm)
//   vent_slots, vent_w      ranhuras nas paredes compridas (x = 0 e x = EXT_W)
//   gpio_cutout, gpio_w, gpio_h   recorte na parede curta da frente (y = 0)
//   usb_cutout, usb_type    recorte na parede comprida da esquerda (x = 0)
//   mount_ears, ear_hole_d  orelhas de fixação nos lados
//   hinge_type              "pin" (nós + pino de filamento) ou "living" (tira flexível)
//   hinge_count, hinge_pin_d
//   modo                    "corpo" | "tampa" | "preview" | (vazio = corpo + tampa)
//
// Todas as injectadas são lidas por funções (avaliadas só na instanciação), por isso a
// ordem de injecção — antes ou depois deste texto — é indiferente. Não há variáveis de
// topo derivadas das injectadas.
//
// Peças (orientação de impressão, sem suportes):
//   corpo  — caixa com postes, ranhuras, recortes, orelhas e (pin) nós da dobradiça
//   tampa  — placa com rebordo que encaixa no interior; (pin) nós, (living) tira ligada
// "pin": passa-se um bocado de filamento 1.75 mm (hinge_pin_d + folga) por todos os nós.
// "living": a tampa sai ligada ao corpo por uma tira de 0.6 mm que dobra ao longo da
//           parede de trás e fecha sobre a caixa.

// ── leitura segura dos parâmetros ──
function _n(v, d) = is_num(v) ? v : d;
function _b(v, d) = is_undef(v) ? d : (v == true || v == 1 || v == "true");
function _s(v, d) = is_string(v) ? v : d;

function PW()   = max(_n(pcb_w, 50), 10);
function PL()   = max(_n(pcb_l, 70), 10);
function PH()   = max(_n(pcb_h, 12), 3);
function WALL() = max(_n(wall, 2.5), 1.2);
function BOT()  = max(_n(bottom, 2), 1.2);
function GAP()  = max(_n(lid_gap, 0.25), 0.1);

function EW()  = PW() + 2 * WALL();
function EL()  = PL() + 2 * WALL();
function HB()  = BOT() + PH();                 // altura do corpo
function LIDT() = max(WALL(), 1.6);            // espessura da tampa
function LIPH() = min(2.5, PH() - 1);          // altura do rebordo
function LIPT() = 1.2;                         // espessura do rebordo

function POSTS()  = _b(screw_posts, true);
function POSTD()  = max(_n(post_d, 4.5), 3.2);
function POSTH()  = min(max(_n(post_h, 6), 2), PH() - 1);
function POSTIN() = 3.5;                       // furo da PCB a 3.5 mm do bordo
function ZP()     = BOT() + (POSTS() ? POSTH() : 0);   // cota da face de baixo da PCB

function VENTS()  = _b(vent_slots, false);
function VENTW()  = max(_n(vent_w, 1.5), 0.8);

function GPIO()   = _b(gpio_cutout, false);
function GPIOW()  = min(max(_n(gpio_w, 15), 1), PW() - 2);
function GPIOH()  = max(min(_n(gpio_h, 8), HB() - ZP() - 1), 1);

function USB()    = _b(usb_cutout, false);
function USBT()   = _s(usb_type, "c");
function USBDIM() = USBT() == "micro" ? [7.5, 2.8] :
                    USBT() == "mini"  ? [8.0, 3.5] :
                    USBT() == "usb_a" ? [12.5, 5.5] : [9.0, 3.2];   // c por defeito
function USBH()   = max(min(USBDIM()[1] + 1, HB() - ZP() - 1), 1);

function EARS()   = _b(mount_ears, false);
function EARD()   = max(_n(ear_hole_d, 4.2), 3);

function LIVING() = _s(hinge_type, "pin") == "living";
function HN()     = round(min(max(_n(hinge_count, 2), 2), 4));
function PIND()   = max(_n(hinge_pin_d, 1.6), 1.2);
function KR()     = PIND() / 2 + 1.4;                   // raio dos nós
function KDY()    = KR() + 0.2;                         // eixo atrás da parede
function HGAP()   = 0.3;                                // folga tampa/corpo na dobradiça
function ZA()     = HB() + HGAP() + LIDT() - KR();      // cota do eixo (fechado)
function PITCH()  = EW() / HN();
function LK()     = min(8, (PITCH() - 3) / 2);          // comprimento de um nó
function STRAP_T() = 0.6;
function STRAP_L() = HB() + LIDT() + 2;                 // da base de trás ao rebordo da tampa

function _modo() = is_undef(modo) ? "" : modo;

// ── blocos ──
module rcube(p, s) { translate(p) cube(s); }

module cavidade() {
    translate([WALL(), WALL(), BOT()]) cube([PW(), PL(), PH() + 1]);
}

module posicoes_postes() {
    for (x = [WALL() + POSTIN(), WALL() + PW() - POSTIN()],
         y = [WALL() + POSTIN(), WALL() + PL() - POSTIN()])
        translate([x, y, 0]) children();
}

module ranhuras() {
    h = HB() - BOT() - 4;
    pitch = VENTW() * 2.5;
    n = floor((PL() - 8) / pitch);
    if (h >= 2 && n >= 1)
        for (i = [0 : n - 1]) {
            y = WALL() + PL() / 2 + (i - (n - 1) / 2) * pitch - VENTW() / 2;
            translate([-1, y, BOT() + 2]) cube([WALL() + 2, VENTW(), h]);
            translate([EW() - WALL() - 1, y, BOT() + 2]) cube([WALL() + 2, VENTW(), h]);
        }
}

module recorte_gpio() {
    translate([EW() / 2 - GPIOW() / 2, -1, ZP()]) cube([GPIOW(), WALL() + 2, GPIOH()]);
}

module recorte_usb() {
    translate([-1, EL() / 2 - USBDIM()[0] / 2, ZP()]) cube([WALL() + 2, USBDIM()[0], USBH()]);
}

// orelhas: no plano do fundo, para fora das paredes compridas
function EARL() = 10;
function EART() = max(BOT(), 2);
function earys() = EL() >= 50 ? [EL() * 0.25, EL() * 0.75] : [EL() / 2];
module orelha_solida(lado, y) {
    cx = lado < 0 ? -EARL() + 5 - 0 : EW() + EARL() - 5;      // centro do furo
    hull() {
        translate([cx, y, 0]) cylinder(h = EART(), r = 5, $fn = 32);
        translate([lado < 0 ? 0 : EW() - 0.01, y - 5, 0]) cube([0.01, 10, EART()]);
    }
}
module orelhas() {
    for (l = [-1, 1], y = earys()) orelha_solida(l, y);
}
module furos_orelhas() {
    for (l = [-1, 1], y = earys())
        translate([l < 0 ? -EARL() + 5 : EW() + EARL() - 5, y, -1])
            cylinder(h = EART() + 2, d = EARD(), $fn = 32);
}

// ── dobradiça de pino ──
module no_corpo(xc) {
    x0 = xc - LK() - 0.2;
    hull() {
        translate([x0, EL() + KDY(), ZA()]) rotate([0, 90, 0]) cylinder(h = LK(), r = KR(), $fn = 40);
        translate([x0, EL() - WALL(), HB() - 0.01]) cube([LK(), WALL(), 0.01]);
    }
}
module no_tampa(xc) {                        // orientação de impressão (placa em z = 0)
    // Mesmas posições x que os nós do corpo: a tampa fecha-se virando-a como a página de um
    // livro (espelho em x, o bordo da dobradiça fica atrás), o que a põe nas posições
    // intercaladas com as do corpo.
    x0 = xc - LK() - 0.2;
    hull() {
        translate([x0, EL() + KDY(), KR()]) rotate([0, 90, 0]) cylinder(h = LK(), r = KR(), $fn = 40);
        translate([x0, EL() - 0.01, 0]) cube([LK(), 0.01, LIDT()]);
    }
}
module furo_pino() {
    translate([-1, EL() + KDY(), ZA()]) rotate([0, 90, 0])
        cylinder(h = EW() + 2, d = PIND() + 0.25, $fn = 24);
}

// ── peças ──
module corpo() {
    difference() {
        union() {
            difference() {
                cube([EW(), EL(), HB()]);
                cavidade();
                if (VENTS()) ranhuras();
                if (GPIO()) recorte_gpio();
                if (USB()) recorte_usb();
            }
            if (POSTS())
                posicoes_postes() translate([0, 0, BOT() - 0.01]) cylinder(h = POSTH() + 0.01, d = POSTD(), $fn = 40);
            if (EARS()) orelhas();
            if (!LIVING()) for (i = [0 : HN() - 1]) no_corpo(PITCH() * (i + 0.5));
            if (LIVING())
                translate([2, EL() - 1, 0]) cube([EW() - 4, STRAP_L() + 1, STRAP_T()]);
        }
        if (POSTS())
            posicoes_postes() translate([0, 0, BOT()]) cylinder(h = POSTH() + 1, d = 2.5, $fn = 24);
        if (EARS()) furos_orelhas();
        if (!LIVING()) {
            // o furo do pino só atravessa os nós, não a parede
            intersection() {
                furo_pino();
                union() for (i = [0 : HN() - 1]) {
                    translate([PITCH() * (i + 0.5) - LK() - 0.2 - 0.5, EL(), 0]) cube([LK() + 1, 2 * KR() + 1, HB() + 20]);
                }
            }
        }
    }
}

// Tampa em orientação de impressão: placa em z = 0, rebordo para cima.
module tampa_chapa() {
    cube([EW(), EL(), LIDT()]);
    // rebordo que encaixa na cavidade com folga lid_gap (e recortado nos postes)
    difference() {
        translate([WALL() + GAP(), WALL() + GAP(), LIDT() - 0.01])
            cube([PW() - 2 * GAP(), PL() - 2 * GAP(), LIPH() + 0.01]);
        translate([WALL() + GAP() + LIPT(), WALL() + GAP() + LIPT(), LIDT() - 1])
            cube([PW() - 2 * GAP() - 2 * LIPT(), PL() - 2 * GAP() - 2 * LIPT(), LIPH() + 2]);
        if (POSTS())
            posicoes_postes() translate([0, 0, LIDT() - 1]) cylinder(h = LIPH() + 2, d = POSTD() + 2 * GAP() + 1, $fn = 40);
    }
}

module tampa() {
    difference() {
        union() {
            tampa_chapa();
            if (!LIVING()) for (i = [0 : HN() - 1]) no_tampa(PITCH() * (i + 0.5));
        }
        // folga para os nós do corpo (que, com a tampa fechada, ficam nestes intervalos de x)
        if (!LIVING())
            for (i = [0 : HN() - 1])
                translate([PITCH() * (i + 0.5) + 0.2 - 0.3, EL() - WALL(), -1])
                    cube([LK() + 0.6, WALL() + 1, LIDT() + 2]);
        if (!LIVING())
            intersection() {
                translate([-1, EL() + KDY(), KR()]) rotate([0, 90, 0])
                    cylinder(h = EW() + 2, d = PIND() + 0.25, $fn = 24);
                union() for (i = [0 : HN() - 1])
                    translate([PITCH() * (i + 0.5) - LK() - 0.2 - 0.5, EL(), -1]) cube([LK() + 1, 2 * KR() + 1, 20]);
            }
    }
    if (LIVING()) translate([2, -STRAP_L() - 1, 0]) cube([EW() - 4, STRAP_L() + 1.01, STRAP_T()]);
}
// Fechado, para a pré-visualização: a tampa vira-se 180° como a página de um livro
// (em torno do eixo Y), por isso o bordo da dobradiça continua atrás.
module tampa_fechada() {
    translate([EW(), 0, HB() + HGAP() + LIDT()]) rotate([0, 180, 0]) tampa();
}

module pcb_fantasma() {
    color([0, 0.5, 0, 0.35]) translate([WALL() + 0.1, WALL() + 0.1, ZP() + 0.05]) cube([PW() - 0.2, PL() - 0.2, 1.6]);
}

module lado_a_lado() {
    corpo();
    if (LIVING())
        translate([0, EL() + STRAP_L() + 1, 0]) tampa();
    else
        translate([EW() + 25, 0, 0]) tampa();
}

module main() {
    m = _modo();
    if (m == "corpo" || m == "base_pinos") corpo();
    else if (m == "tampa" || m == "tampa_simples") tampa();
    else if (m == "preview") { corpo(); if (LIVING()) translate([0, EL() + STRAP_L() + 1, 0]) tampa(); else tampa_fechada(); pcb_fantasma(); }
    else lado_a_lado();
}

main();
$scad$,
  generation_schema = $json${
  "name": "Caixa PCB Universal v2",
  "tags": [
    "pcb",
    "enclosure",
    "electronics",
    "project-box",
    "hinged"
  ],
  "entry": "inline",
  "modes": {
    "final": {
      "quality_fn": 100
    },
    "preview": {
      "quality_fn": 36
    }
  },
  "engine": "openscad",
  "version": 2,
  "category": "eletronica",
  "parameters": {
    "pcb_w": {
      "ui": {
        "step": 1,
        "label": "Largura PCB",
        "widget": "slider"
      },
      "max": 300,
      "min": 20,
      "type": "number",
      "unit": "mm",
      "order": 1,
      "default": 56,
      "required": true
    },
    "pcb_l": {
      "ui": {
        "step": 1,
        "label": "Comprimento PCB",
        "widget": "slider"
      },
      "max": 300,
      "min": 20,
      "type": "number",
      "unit": "mm",
      "order": 2,
      "default": 85,
      "required": true
    },
    "pcb_h": {
      "ui": {
        "step": 0.5,
        "label": "Altura livre componentes",
        "widget": "slider"
      },
      "max": 50,
      "min": 3,
      "type": "number",
      "unit": "mm",
      "order": 3,
      "default": 18,
      "required": true
    },
    "wall": {
      "ui": {
        "step": 0.2,
        "label": "Espessura parede",
        "widget": "slider"
      },
      "max": 8,
      "min": 1.2,
      "type": "number",
      "unit": "mm",
      "order": 4,
      "default": 2.5
    },
    "bottom": {
      "ui": {
        "step": 0.2,
        "label": "Espessura fundo",
        "widget": "slider"
      },
      "max": 8,
      "min": 1.2,
      "type": "number",
      "unit": "mm",
      "order": 5,
      "default": 2
    },
    "lid_gap": {
      "ui": {
        "step": 0.05,
        "label": "Folga tampa",
        "widget": "slider"
      },
      "max": 0.6,
      "min": 0.1,
      "type": "number",
      "unit": "mm",
      "order": 6,
      "default": 0.25
    },
    "screw_posts": {
      "ui": {
        "label": "Postes para parafuso M3",
        "widget": "checkbox"
      },
      "type": "boolean",
      "order": 7,
      "default": true
    },
    "post_d": {
      "ui": {
        "step": 0.1,
        "label": "Diâmetro poste",
        "widget": "slider",
        "visible_when": {
          "screw_posts": {
            "eq": 1
          }
        }
      },
      "max": 6,
      "min": 3.2,
      "type": "number",
      "unit": "mm",
      "order": 8,
      "default": 3.2
    },
    "post_h": {
      "ui": {
        "step": 1,
        "label": "Altura poste",
        "widget": "slider",
        "visible_when": {
          "screw_posts": {
            "eq": 1
          }
        }
      },
      "max": 20,
      "min": 4,
      "type": "number",
      "unit": "mm",
      "order": 9,
      "default": 6
    },
    "vent_slots": {
      "ui": {
        "label": "Ranhuras ventilação laterais",
        "widget": "checkbox"
      },
      "type": "boolean",
      "order": 10,
      "default": true
    },
    "vent_w": {
      "ui": {
        "step": 0.2,
        "label": "Largura ranhura",
        "widget": "slider",
        "visible_when": {
          "vent_slots": {
            "eq": 1
          }
        }
      },
      "max": 5,
      "min": 1,
      "type": "number",
      "unit": "mm",
      "order": 11,
      "default": 1.5
    },
    "gpio_cutout": {
      "ui": {
        "label": "Recorte GPIO (lado curto)",
        "widget": "checkbox"
      },
      "type": "boolean",
      "order": 12,
      "default": true
    },
    "gpio_w": {
      "ui": {
        "step": 1,
        "label": "Largura recorte GPIO",
        "widget": "slider",
        "visible_when": {
          "gpio_cutout": {
            "eq": 1
          }
        }
      },
      "max": 50,
      "min": 5,
      "type": "number",
      "unit": "mm",
      "order": 13,
      "default": 40
    },
    "gpio_h": {
      "ui": {
        "step": 0.5,
        "label": "Altura recorte GPIO",
        "widget": "slider",
        "visible_when": {
          "gpio_cutout": {
            "eq": 1
          }
        }
      },
      "max": 20,
      "min": 3,
      "type": "number",
      "unit": "mm",
      "order": 14,
      "default": 8
    },
    "usb_cutout": {
      "ui": {
        "label": "Recorte USB (lado longo)",
        "widget": "checkbox"
      },
      "type": "boolean",
      "order": 15,
      "default": true
    },
    "usb_type": {
      "ui": {
        "label": "Tipo USB",
        "widget": "select",
        "options": [
          "c",
          "micro",
          "mini",
          "usb_a"
        ],
        "visible_when": {
          "usb_cutout": {
            "eq": 1
          }
        }
      },
      "type": "select",
      "order": 16,
      "default": "c"
    },
    "mount_ears": {
      "ui": {
        "label": "Orelhas fixação parede",
        "widget": "checkbox"
      },
      "type": "boolean",
      "order": 17,
      "default": true
    },
    "ear_hole_d": {
      "ui": {
        "step": 0.1,
        "label": "Furo orelha",
        "widget": "slider",
        "visible_when": {
          "mount_ears": {
            "eq": 1
          }
        }
      },
      "max": 6,
      "min": 3,
      "type": "number",
      "unit": "mm",
      "order": 18,
      "default": 4.2
    },
    "hinge_type": {
      "ui": {
        "label": "Tipo dobradiça",
        "widget": "select",
        "options": [
          "pin",
          "living"
        ]
      },
      "type": "select",
      "order": 19,
      "default": "pin"
    },
    "hinge_count": {
      "ui": {
        "step": 1,
        "label": "Nº dobradiças",
        "widget": "slider"
      },
      "max": 4,
      "min": 2,
      "type": "number",
      "order": 20,
      "default": 2
    },
    "hinge_pin_d": {
      "ui": {
        "step": 0.1,
        "label": "Diâmetro pino",
        "widget": "slider"
      },
      "max": 3,
      "min": 1.2,
      "type": "number",
      "unit": "mm",
      "order": 21,
      "default": 1.6
    }
  },
  "description": "Caixa paramétrica para PCB com postes de parafuso, ventilação opcional, recortes GPIO/USB personalizáveis e dobradiças integradas (pino print-in-place ou living hinge)",
  "validations": [
    {
      "rule": "wall < pcb_w / 2 && wall < pcb_l / 2",
      "message": "Parede demasiado grossa para o tamanho da PCB"
    },
    {
      "rule": "bottom < pcb_h + 5",
      "message": "Fundo não deve exceder altura interna"
    },
    {
      "rule": "post_h <= pcb_h + bottom - 2",
      "message": "Poste demasiado alto para a caixa"
    }
  ]
}$json$::jsonb
WHERE id = 'caixa-pcb-rpi4';

UPDATE prod_designs SET
  scad_template = $scad$
// ── CAIXA PCB PARAMÉTRICA COM TAMPA ──
// Usada pelos designs caixa-pcb-universal, caixa-pcb-rpi4 e caixa-pcb-rpi-zero (mudam só
// os valores por defeito do generation_schema).
//
// Parâmetros injectados pelo backend:
//   pcb_w, pcb_l, pcb_h     interior (X, Y) e altura livre acima do fundo
//   wall, bottom, lid_gap   parede, fundo e folga da tampa
//   screw_posts, post_d, post_h   postes para a PCB (furo-piloto M3 de 2.5 mm)
//   vent_slots, vent_w      ranhuras nas paredes compridas (x = 0 e x = EXT_W)
//   gpio_cutout, gpio_w, gpio_h   recorte na parede curta da frente (y = 0)
//   usb_cutout, usb_type    recorte na parede comprida da esquerda (x = 0)
//   mount_ears, ear_hole_d  orelhas de fixação nos lados
//   hinge_type              "pin" (nós + pino de filamento) ou "living" (tira flexível)
//   hinge_count, hinge_pin_d
//   modo                    "corpo" | "tampa" | "preview" | (vazio = corpo + tampa)
//
// Todas as injectadas são lidas por funções (avaliadas só na instanciação), por isso a
// ordem de injecção — antes ou depois deste texto — é indiferente. Não há variáveis de
// topo derivadas das injectadas.
//
// Peças (orientação de impressão, sem suportes):
//   corpo  — caixa com postes, ranhuras, recortes, orelhas e (pin) nós da dobradiça
//   tampa  — placa com rebordo que encaixa no interior; (pin) nós, (living) tira ligada
// "pin": passa-se um bocado de filamento 1.75 mm (hinge_pin_d + folga) por todos os nós.
// "living": a tampa sai ligada ao corpo por uma tira de 0.6 mm que dobra ao longo da
//           parede de trás e fecha sobre a caixa.

// ── leitura segura dos parâmetros ──
function _n(v, d) = is_num(v) ? v : d;
function _b(v, d) = is_undef(v) ? d : (v == true || v == 1 || v == "true");
function _s(v, d) = is_string(v) ? v : d;

function PW()   = max(_n(pcb_w, 50), 10);
function PL()   = max(_n(pcb_l, 70), 10);
function PH()   = max(_n(pcb_h, 12), 3);
function WALL() = max(_n(wall, 2.5), 1.2);
function BOT()  = max(_n(bottom, 2), 1.2);
function GAP()  = max(_n(lid_gap, 0.25), 0.1);

function EW()  = PW() + 2 * WALL();
function EL()  = PL() + 2 * WALL();
function HB()  = BOT() + PH();                 // altura do corpo
function LIDT() = max(WALL(), 1.6);            // espessura da tampa
function LIPH() = min(2.5, PH() - 1);          // altura do rebordo
function LIPT() = 1.2;                         // espessura do rebordo

function POSTS()  = _b(screw_posts, true);
function POSTD()  = max(_n(post_d, 4.5), 3.2);
function POSTH()  = min(max(_n(post_h, 6), 2), PH() - 1);
function POSTIN() = 3.5;                       // furo da PCB a 3.5 mm do bordo
function ZP()     = BOT() + (POSTS() ? POSTH() : 0);   // cota da face de baixo da PCB

function VENTS()  = _b(vent_slots, false);
function VENTW()  = max(_n(vent_w, 1.5), 0.8);

function GPIO()   = _b(gpio_cutout, false);
function GPIOW()  = min(max(_n(gpio_w, 15), 1), PW() - 2);
function GPIOH()  = max(min(_n(gpio_h, 8), HB() - ZP() - 1), 1);

function USB()    = _b(usb_cutout, false);
function USBT()   = _s(usb_type, "c");
function USBDIM() = USBT() == "micro" ? [7.5, 2.8] :
                    USBT() == "mini"  ? [8.0, 3.5] :
                    USBT() == "usb_a" ? [12.5, 5.5] : [9.0, 3.2];   // c por defeito
function USBH()   = max(min(USBDIM()[1] + 1, HB() - ZP() - 1), 1);

function EARS()   = _b(mount_ears, false);
function EARD()   = max(_n(ear_hole_d, 4.2), 3);

function LIVING() = _s(hinge_type, "pin") == "living";
function HN()     = round(min(max(_n(hinge_count, 2), 2), 4));
function PIND()   = max(_n(hinge_pin_d, 1.6), 1.2);
function KR()     = PIND() / 2 + 1.4;                   // raio dos nós
function KDY()    = KR() + 0.2;                         // eixo atrás da parede
function HGAP()   = 0.3;                                // folga tampa/corpo na dobradiça
function ZA()     = HB() + HGAP() + LIDT() - KR();      // cota do eixo (fechado)
function PITCH()  = EW() / HN();
function LK()     = min(8, (PITCH() - 3) / 2);          // comprimento de um nó
function STRAP_T() = 0.6;
function STRAP_L() = HB() + LIDT() + 2;                 // da base de trás ao rebordo da tampa

function _modo() = is_undef(modo) ? "" : modo;

// ── blocos ──
module rcube(p, s) { translate(p) cube(s); }

module cavidade() {
    translate([WALL(), WALL(), BOT()]) cube([PW(), PL(), PH() + 1]);
}

module posicoes_postes() {
    for (x = [WALL() + POSTIN(), WALL() + PW() - POSTIN()],
         y = [WALL() + POSTIN(), WALL() + PL() - POSTIN()])
        translate([x, y, 0]) children();
}

module ranhuras() {
    h = HB() - BOT() - 4;
    pitch = VENTW() * 2.5;
    n = floor((PL() - 8) / pitch);
    if (h >= 2 && n >= 1)
        for (i = [0 : n - 1]) {
            y = WALL() + PL() / 2 + (i - (n - 1) / 2) * pitch - VENTW() / 2;
            translate([-1, y, BOT() + 2]) cube([WALL() + 2, VENTW(), h]);
            translate([EW() - WALL() - 1, y, BOT() + 2]) cube([WALL() + 2, VENTW(), h]);
        }
}

module recorte_gpio() {
    translate([EW() / 2 - GPIOW() / 2, -1, ZP()]) cube([GPIOW(), WALL() + 2, GPIOH()]);
}

module recorte_usb() {
    translate([-1, EL() / 2 - USBDIM()[0] / 2, ZP()]) cube([WALL() + 2, USBDIM()[0], USBH()]);
}

// orelhas: no plano do fundo, para fora das paredes compridas
function EARL() = 10;
function EART() = max(BOT(), 2);
function earys() = EL() >= 50 ? [EL() * 0.25, EL() * 0.75] : [EL() / 2];
module orelha_solida(lado, y) {
    cx = lado < 0 ? -EARL() + 5 - 0 : EW() + EARL() - 5;      // centro do furo
    hull() {
        translate([cx, y, 0]) cylinder(h = EART(), r = 5, $fn = 32);
        translate([lado < 0 ? 0 : EW() - 0.01, y - 5, 0]) cube([0.01, 10, EART()]);
    }
}
module orelhas() {
    for (l = [-1, 1], y = earys()) orelha_solida(l, y);
}
module furos_orelhas() {
    for (l = [-1, 1], y = earys())
        translate([l < 0 ? -EARL() + 5 : EW() + EARL() - 5, y, -1])
            cylinder(h = EART() + 2, d = EARD(), $fn = 32);
}

// ── dobradiça de pino ──
module no_corpo(xc) {
    x0 = xc - LK() - 0.2;
    hull() {
        translate([x0, EL() + KDY(), ZA()]) rotate([0, 90, 0]) cylinder(h = LK(), r = KR(), $fn = 40);
        translate([x0, EL() - WALL(), HB() - 0.01]) cube([LK(), WALL(), 0.01]);
    }
}
module no_tampa(xc) {                        // orientação de impressão (placa em z = 0)
    // Mesmas posições x que os nós do corpo: a tampa fecha-se virando-a como a página de um
    // livro (espelho em x, o bordo da dobradiça fica atrás), o que a põe nas posições
    // intercaladas com as do corpo.
    x0 = xc - LK() - 0.2;
    hull() {
        translate([x0, EL() + KDY(), KR()]) rotate([0, 90, 0]) cylinder(h = LK(), r = KR(), $fn = 40);
        translate([x0, EL() - 0.01, 0]) cube([LK(), 0.01, LIDT()]);
    }
}
module furo_pino() {
    translate([-1, EL() + KDY(), ZA()]) rotate([0, 90, 0])
        cylinder(h = EW() + 2, d = PIND() + 0.25, $fn = 24);
}

// ── peças ──
module corpo() {
    difference() {
        union() {
            difference() {
                cube([EW(), EL(), HB()]);
                cavidade();
                if (VENTS()) ranhuras();
                if (GPIO()) recorte_gpio();
                if (USB()) recorte_usb();
            }
            if (POSTS())
                posicoes_postes() translate([0, 0, BOT() - 0.01]) cylinder(h = POSTH() + 0.01, d = POSTD(), $fn = 40);
            if (EARS()) orelhas();
            if (!LIVING()) for (i = [0 : HN() - 1]) no_corpo(PITCH() * (i + 0.5));
            if (LIVING())
                translate([2, EL() - 1, 0]) cube([EW() - 4, STRAP_L() + 1, STRAP_T()]);
        }
        if (POSTS())
            posicoes_postes() translate([0, 0, BOT()]) cylinder(h = POSTH() + 1, d = 2.5, $fn = 24);
        if (EARS()) furos_orelhas();
        if (!LIVING()) {
            // o furo do pino só atravessa os nós, não a parede
            intersection() {
                furo_pino();
                union() for (i = [0 : HN() - 1]) {
                    translate([PITCH() * (i + 0.5) - LK() - 0.2 - 0.5, EL(), 0]) cube([LK() + 1, 2 * KR() + 1, HB() + 20]);
                }
            }
        }
    }
}

// Tampa em orientação de impressão: placa em z = 0, rebordo para cima.
module tampa_chapa() {
    cube([EW(), EL(), LIDT()]);
    // rebordo que encaixa na cavidade com folga lid_gap (e recortado nos postes)
    difference() {
        translate([WALL() + GAP(), WALL() + GAP(), LIDT() - 0.01])
            cube([PW() - 2 * GAP(), PL() - 2 * GAP(), LIPH() + 0.01]);
        translate([WALL() + GAP() + LIPT(), WALL() + GAP() + LIPT(), LIDT() - 1])
            cube([PW() - 2 * GAP() - 2 * LIPT(), PL() - 2 * GAP() - 2 * LIPT(), LIPH() + 2]);
        if (POSTS())
            posicoes_postes() translate([0, 0, LIDT() - 1]) cylinder(h = LIPH() + 2, d = POSTD() + 2 * GAP() + 1, $fn = 40);
    }
}

module tampa() {
    difference() {
        union() {
            tampa_chapa();
            if (!LIVING()) for (i = [0 : HN() - 1]) no_tampa(PITCH() * (i + 0.5));
        }
        // folga para os nós do corpo (que, com a tampa fechada, ficam nestes intervalos de x)
        if (!LIVING())
            for (i = [0 : HN() - 1])
                translate([PITCH() * (i + 0.5) + 0.2 - 0.3, EL() - WALL(), -1])
                    cube([LK() + 0.6, WALL() + 1, LIDT() + 2]);
        if (!LIVING())
            intersection() {
                translate([-1, EL() + KDY(), KR()]) rotate([0, 90, 0])
                    cylinder(h = EW() + 2, d = PIND() + 0.25, $fn = 24);
                union() for (i = [0 : HN() - 1])
                    translate([PITCH() * (i + 0.5) - LK() - 0.2 - 0.5, EL(), -1]) cube([LK() + 1, 2 * KR() + 1, 20]);
            }
    }
    if (LIVING()) translate([2, -STRAP_L() - 1, 0]) cube([EW() - 4, STRAP_L() + 1.01, STRAP_T()]);
}
// Fechado, para a pré-visualização: a tampa vira-se 180° como a página de um livro
// (em torno do eixo Y), por isso o bordo da dobradiça continua atrás.
module tampa_fechada() {
    translate([EW(), 0, HB() + HGAP() + LIDT()]) rotate([0, 180, 0]) tampa();
}

module pcb_fantasma() {
    color([0, 0.5, 0, 0.35]) translate([WALL() + 0.1, WALL() + 0.1, ZP() + 0.05]) cube([PW() - 0.2, PL() - 0.2, 1.6]);
}

module lado_a_lado() {
    corpo();
    if (LIVING())
        translate([0, EL() + STRAP_L() + 1, 0]) tampa();
    else
        translate([EW() + 25, 0, 0]) tampa();
}

module main() {
    m = _modo();
    if (m == "corpo" || m == "base_pinos") corpo();
    else if (m == "tampa" || m == "tampa_simples") tampa();
    else if (m == "preview") { corpo(); if (LIVING()) translate([0, EL() + STRAP_L() + 1, 0]) tampa(); else tampa_fechada(); pcb_fantasma(); }
    else lado_a_lado();
}

main();
$scad$,
  generation_schema = $json${
  "name": "Caixa PCB Universal v2",
  "tags": [
    "pcb",
    "enclosure",
    "electronics",
    "project-box",
    "hinged"
  ],
  "entry": "inline",
  "modes": {
    "final": {
      "quality_fn": 100
    },
    "preview": {
      "quality_fn": 36
    }
  },
  "engine": "openscad",
  "version": 2,
  "category": "eletronica",
  "parameters": {
    "pcb_w": {
      "ui": {
        "step": 1,
        "label": "Largura PCB",
        "widget": "slider"
      },
      "max": 300,
      "min": 20,
      "type": "number",
      "unit": "mm",
      "order": 1,
      "default": 30,
      "required": true
    },
    "pcb_l": {
      "ui": {
        "step": 1,
        "label": "Comprimento PCB",
        "widget": "slider"
      },
      "max": 300,
      "min": 20,
      "type": "number",
      "unit": "mm",
      "order": 2,
      "default": 65,
      "required": true
    },
    "pcb_h": {
      "ui": {
        "step": 0.5,
        "label": "Altura livre componentes",
        "widget": "slider"
      },
      "max": 50,
      "min": 3,
      "type": "number",
      "unit": "mm",
      "order": 3,
      "default": 12,
      "required": true
    },
    "wall": {
      "ui": {
        "step": 0.2,
        "label": "Espessura parede",
        "widget": "slider"
      },
      "max": 8,
      "min": 1.2,
      "type": "number",
      "unit": "mm",
      "order": 4,
      "default": 2
    },
    "bottom": {
      "ui": {
        "step": 0.2,
        "label": "Espessura fundo",
        "widget": "slider"
      },
      "max": 8,
      "min": 1.2,
      "type": "number",
      "unit": "mm",
      "order": 5,
      "default": 1.5
    },
    "lid_gap": {
      "ui": {
        "step": 0.05,
        "label": "Folga tampa",
        "widget": "slider"
      },
      "max": 0.6,
      "min": 0.1,
      "type": "number",
      "unit": "mm",
      "order": 6,
      "default": 0.2
    },
    "screw_posts": {
      "ui": {
        "label": "Postes para parafuso M3",
        "widget": "checkbox"
      },
      "type": "boolean",
      "order": 7,
      "default": true
    },
    "post_d": {
      "ui": {
        "step": 0.1,
        "label": "Diâmetro poste",
        "widget": "slider",
        "visible_when": {
          "screw_posts": {
            "eq": 1
          }
        }
      },
      "max": 6,
      "min": 3.2,
      "type": "number",
      "unit": "mm",
      "order": 8,
      "default": 3.2
    },
    "post_h": {
      "ui": {
        "step": 1,
        "label": "Altura poste",
        "widget": "slider",
        "visible_when": {
          "screw_posts": {
            "eq": 1
          }
        }
      },
      "max": 20,
      "min": 4,
      "type": "number",
      "unit": "mm",
      "order": 9,
      "default": 5
    },
    "vent_slots": {
      "ui": {
        "label": "Ranhuras ventilação laterais",
        "widget": "checkbox"
      },
      "type": "boolean",
      "order": 10,
      "default": false
    },
    "vent_w": {
      "ui": {
        "step": 0.2,
        "label": "Largura ranhura",
        "widget": "slider",
        "visible_when": {
          "vent_slots": {
            "eq": 1
          }
        }
      },
      "max": 5,
      "min": 1,
      "type": "number",
      "unit": "mm",
      "order": 11,
      "default": 1.5
    },
    "gpio_cutout": {
      "ui": {
        "label": "Recorte GPIO (lado curto)",
        "widget": "checkbox"
      },
      "type": "boolean",
      "order": 12,
      "default": true
    },
    "gpio_w": {
      "ui": {
        "step": 1,
        "label": "Largura recorte GPIO",
        "widget": "slider",
        "visible_when": {
          "gpio_cutout": {
            "eq": 1
          }
        }
      },
      "max": 50,
      "min": 5,
      "type": "number",
      "unit": "mm",
      "order": 13,
      "default": 30
    },
    "gpio_h": {
      "ui": {
        "step": 0.5,
        "label": "Altura recorte GPIO",
        "widget": "slider",
        "visible_when": {
          "gpio_cutout": {
            "eq": 1
          }
        }
      },
      "max": 20,
      "min": 3,
      "type": "number",
      "unit": "mm",
      "order": 14,
      "default": 6
    },
    "usb_cutout": {
      "ui": {
        "label": "Recorte USB (lado longo)",
        "widget": "checkbox"
      },
      "type": "boolean",
      "order": 15,
      "default": true
    },
    "usb_type": {
      "ui": {
        "label": "Tipo USB",
        "widget": "select",
        "options": [
          "c",
          "micro",
          "mini",
          "usb_a"
        ],
        "visible_when": {
          "usb_cutout": {
            "eq": 1
          }
        }
      },
      "type": "select",
      "order": 16,
      "default": "micro"
    },
    "mount_ears": {
      "ui": {
        "label": "Orelhas fixação parede",
        "widget": "checkbox"
      },
      "type": "boolean",
      "order": 17,
      "default": false
    },
    "ear_hole_d": {
      "ui": {
        "step": 0.1,
        "label": "Furo orelha",
        "widget": "slider",
        "visible_when": {
          "mount_ears": {
            "eq": 1
          }
        }
      },
      "max": 6,
      "min": 3,
      "type": "number",
      "unit": "mm",
      "order": 18,
      "default": 3.2
    },
    "hinge_type": {
      "ui": {
        "label": "Tipo dobradiça",
        "widget": "select",
        "options": [
          "pin",
          "living"
        ]
      },
      "type": "select",
      "order": 19,
      "default": "pin"
    },
    "hinge_count": {
      "ui": {
        "step": 1,
        "label": "Nº dobradiças",
        "widget": "slider"
      },
      "max": 4,
      "min": 2,
      "type": "number",
      "order": 20,
      "default": 2
    },
    "hinge_pin_d": {
      "ui": {
        "step": 0.1,
        "label": "Diâmetro pino",
        "widget": "slider"
      },
      "max": 3,
      "min": 1.2,
      "type": "number",
      "unit": "mm",
      "order": 21,
      "default": 1.6
    }
  },
  "description": "Caixa paramétrica para PCB com postes de parafuso, ventilação opcional, recortes GPIO/USB personalizáveis e dobradiças integradas (pino print-in-place ou living hinge)",
  "validations": [
    {
      "rule": "wall < pcb_w / 2 && wall < pcb_l / 2",
      "message": "Parede demasiado grossa para o tamanho da PCB"
    },
    {
      "rule": "bottom < pcb_h + 5",
      "message": "Fundo não deve exceder altura interna"
    },
    {
      "rule": "post_h <= pcb_h + bottom - 2",
      "message": "Poste demasiado alto para a caixa"
    }
  ]
}$json$::jsonb
WHERE id = 'caixa-pcb-rpi-zero';
