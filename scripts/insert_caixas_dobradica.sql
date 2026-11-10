-- Caixas com dobradiça print-in-place e fecho (3 designs, mesmo template). Re-executável.
-- Ficam em RASCUNHO até haver protótipo impresso. Template: templates/caixa_dobradica.scad;
-- pré-visualização: Maker_Pro_Frontend_Prod/lib/caixaDobradica.ts.

INSERT INTO prod_designs (id, nome, descricao, familia, estado, tags, generation_schema, parametros_default, scad_template, base_template_id, usa_modo, disponivel_consumidor, gratuito, preco_creditos, licenca, qualidade_preview, qualidade_final, default_fonte)
VALUES ('caixa-dobradica', $t$Caixa com Dobradiça e Fecho$t$, $t$Caixa paramétrica com dobradiça print-in-place (imprime já montada) e fecho de encaixe. Medidas, divisórias e texto na tampa à tua medida.$t$, 'caixas', 'rascunho', ARRAY['caixa', 'dobradica', 'print-in-place', 'fecho', 'arrumacao']::text[], $j${"engine": "openscad", "version": 1, "entry": "inline", "modes": {"final": {"quality_fn": 100}, "preview": {"quality_fn": 36}}, "parameters": {"caixa_dobradica": {"ui": {"widget": "hidden"}, "order": 0, "default": "generica"}, "largura": {"ui": {"step": 1, "label": "Largura (interior)", "widget": "slider"}, "min": 20, "max": 250, "type": "number", "order": 1, "default": 80, "unit": "mm"}, "profundidade": {"ui": {"step": 1, "label": "Profundidade (interior)", "widget": "slider"}, "min": 20, "max": 250, "type": "number", "order": 2, "default": 60, "unit": "mm"}, "altura": {"ui": {"step": 1, "label": "Altura (interior)", "widget": "slider"}, "min": 12, "max": 120, "type": "number", "order": 3, "default": 35, "unit": "mm"}, "divisoes_x": {"ui": {"step": 1, "label": "Compartimentos na largura", "widget": "slider"}, "min": 1, "max": 8, "type": "number", "order": 4, "default": 1}, "divisoes_y": {"ui": {"step": 1, "label": "Compartimentos na profundidade", "widget": "slider"}, "min": 1, "max": 8, "type": "number", "order": 5, "default": 1}, "fecho": {"ui": {"label": "Fecho de encaixe na frente", "widget": "checkbox"}, "type": "boolean", "order": 7, "default": true}, "texto": {"ui": {"label": "Texto gravado na tampa (opcional)", "widget": "text"}, "order": 8, "default": ""}, "fonte": {"ui": {"label": "Tipo de letra", "widget": "select", "options": ["Open Sans", "Aladin", "Amarante", "Anton", "Baloo 2", "Benne", "Chewy", "Gloria Hallelujah", "Lobster", "Luckiest Guy", "Oswald", "Pacifico", "Press Start 2P", "Racing Sans One", "Sigmar One"]}, "order": 9, "default": "Open Sans"}, "tamanho_texto": {"ui": {"step": 1, "label": "Tamanho do texto", "widget": "slider"}, "min": 4, "max": 40, "type": "number", "order": 10, "default": 10, "unit": "mm"}, "parede": {"ui": {"step": 0.2, "label": "Espessura da parede", "widget": "slider"}, "min": 1.2, "max": 4, "type": "number", "order": 11, "default": 2, "unit": "mm"}, "fundo": {"ui": {"step": 0.2, "label": "Espessura do fundo", "widget": "slider"}, "min": 1.2, "max": 4, "type": "number", "order": 12, "default": 1.6, "unit": "mm"}, "folga": {"ui": {"step": 0.05, "label": "Folga da dobradiça (0,35 em PLA; mais se ficar presa)", "widget": "slider"}, "min": 0.2, "max": 0.7, "type": "number", "order": 13, "default": 0.35, "unit": "mm"}, "folga_tampa": {"ui": {"step": 0.05, "label": "Folga da tampa", "widget": "slider"}, "min": 0.1, "max": 0.6, "type": "number", "order": 14, "default": 0.25, "unit": "mm"}, "info_dobradica": {"ui": {"widget": "info", "text": "📦 Imprime numa só peça, já montada e aberta (a tampa deitada atrás da caixa), sem suportes. A dobradiça tem um pino contínuo com folga: depois de imprimir, abre e fecha a tampa com alguma força umas vezes até rodar livre. Se a dobradiça ficar presa na tua impressora, aumenta a folga (0,4–0,5). O texto fica gravado no topo da tampa (a face que assenta na mesa)."}, "order": 99, "default": null}}}$j$::jsonb, '{}'::jsonb, $scad$// ── CAIXA COM DOBRADIÇA (print-in-place) E FECHO DE ENCAIXE ──
// Usada pelos designs caixa-dobradica, caixa-dobradica-bijuteria e caixa-dobradica-arrumacao
// (mudam só os valores por defeito e os parâmetros visíveis do generation_schema).
// A pré-visualização (Maker_Pro_Frontend_Prod/lib/caixaDobradica.ts) faz exactamente as
// mesmas contas: se mudares uma medida aqui, muda lá também.
//
// Parâmetros injectados pelo backend (todos lidos por funções, a ordem é indiferente):
//   largura, profundidade, altura    interior da caixa (mm)
//   parede, fundo                    espessuras
//   folga                            folga da dobradiça (radial e axial) — 0.35 em PLA
//   folga_tampa                      folga do rebordo da tampa dentro da caixa
//   fecho                            fecho de encaixe na frente (1/0)
//   divisoes_x, divisoes_y           nº de compartimentos (1 = sem divisórias)
//   apoio_aneis                      fila da frente com ranhuras para anéis (1/0)
//   texto, fonte, tamanho_texto      texto gravado no topo da tampa (vazio = sem texto)
//   modo                             "" = impressão (aberta, peça única) | "fechada"
//
// Como funciona (coordenadas com a caixa FECHADA, origem no canto da frente-esquerda-baixo):
//   * dobradiça com eixo paralelo a X, atrás da parede de trás, a meia altura da caixa
//     fechada (za = (HB + LIDT) / 2). Rodar a tampa 180° em torno deste eixo põe-na deitada
//     na mesa, atrás da caixa, com o rebordo para cima: é assim que se imprime.
//   * nós alternados: os pares (0, 2, 4…) são da caixa e estão ligados por um pino contínuo
//     (raio RP); os ímpares são da tampa, com furo RP + folga. Entre nós há folga axial.
//   * fecho: patilha flexível na frente da tampa com um gancho que encaixa por baixo de um
//     ressalto (topo a 45°, baixo plano) na parede da frente.
// Imprime sem suportes. Depois de imprimir, abrir/fechar com força algumas vezes solta a dobradiça.

function _n(v, d) = is_num(v) ? v : d;
function _b(v, d) = is_undef(v) ? d : (v == true || v == 1 || v == "true");
function _s(v, d) = is_string(v) ? v : d;
function _c(v, a, b) = min(max(v, a), b);

function W()     = _c(_n(largura, 80), 20, 250);
function D()     = _c(_n(profundidade, 60), 20, 250);
function H()     = _c(_n(altura, 35), 12, 120);
function WALL()  = _c(_n(parede, 2), 1.2, 4);
function BOT()   = _c(_n(fundo, 1.6), 1.2, 4);
function FOLGA() = _c(_n(folga, 0.35), 0.2, 0.7);
function GAPT()  = _c(_n(folga_tampa, 0.25), 0.1, 0.6);
function FECHO() = _b(fecho, true);
function NX()    = round(_c(_n(divisoes_x, 1), 1, 8));
function NY()    = round(_c(_n(divisoes_y, 1), 1, 8));
function ANEIS() = _b(apoio_aneis, false);
function TXT()   = _s(texto, "");
function FONTE() = _s(fonte, "Open Sans");
function TS()    = _c(_n(tamanho_texto, 10), 4, 40);
function MODO()  = is_undef(modo) ? "" : modo;

// medidas exteriores
function EW()   = W() + 2 * WALL();
function EL()   = D() + 2 * WALL();
function HB()   = BOT() + H();                 // altura do corpo
function LIDT() = max(WALL(), 1.6);            // espessura da tampa
function LIPH() = min(3, H() - 4);             // altura do rebordo da tampa (dentro da caixa)
function LIPT() = 1.2;                         // espessura do rebordo

// dobradiça
function RP()   = 1.4;                                   // raio do pino
function R()    = RP() + FOLGA() + 1.5;                  // raio dos nós
function CL()   = FOLGA() + 0.2;                         // folga nó da tampa ↔ parede de trás
function YA()   = EL() + R() + CL();                     // eixo: y
function ZA()   = (HB() + LIDT()) / 2;                   // eixo: z (tampa abre para a mesa)
function HM()   = 2;                                     // margem nas pontas
function SPAN() = EW() - 2 * HM();
function NSEG() = max(3, 2 * floor(SPAN() / 12 / 2) + 1); // nº ímpar de nós, ~12 mm cada
function SEG()  = SPAN() / NSEG();
function GA()   = FOLGA() + 0.1;                         // folga axial entre nós

// fecho
function LW()   = 12;                     // largura da patilha
function TT()   = 1.6;                    // espessura da patilha
function DR()   = 0.8;                    // saliência do ressalto / gancho
function ZR()   = HB() - 4;               // base do ressalto
function NFECHOS() = EW() > 140 ? 2 : 1;
function xfecho(i) = NFECHOS() == 1 ? EW() / 2 : EW() * (i + 1) / 3;

// divisórias
function DT()   = 1.2;
function HD()   = max(H() - LIPH() - 0.6, 3); // altura das divisórias (abaixo do rebordo)

// ── corpo ──
module cavidade() { translate([WALL(), WALL(), BOT()]) cube([W(), D(), H() + 1]); }

module divisorias() {
    if (NX() > 1) for (i = [1 : NX() - 1])
        translate([WALL() + i * W() / NX() - DT() / 2, WALL() - 0.01, BOT() - 0.01]) cube([DT(), D() + 0.02, HD() + 0.01]);
    if (NY() > 1) for (j = [1 : NY() - 1])
        translate([WALL() - 0.01, WALL() + j * D() / NY() - DT() / 2, BOT() - 0.01]) cube([W() + 0.02, DT(), HD() + 0.01]);
}

// fila da frente (j = 0) com barras arredondadas: os anéis entalam nas ranhuras de 2 mm
module apoio_aneis() {
    y0 = WALL(); y1 = WALL() + D() / max(NY(), 2) - (NY() > 1 ? DT() / 2 : 0);
    hb = max(HD() * 0.7, 4);
    for (y = [y0 + 1.5 + 1.5 : 5 : y1 - 1.5])
        translate([WALL() - 0.01, y, BOT() - 0.01]) {
            translate([0, -1.5, 0]) cube([W() + 0.02, 3, hb - 1.5]);
            translate([0, 0, hb - 1.5]) rotate([0, 90, 0]) cylinder(h = W() + 0.02, r = 1.5, $fn = 20);
        }
}

module ressalto(xc) {          // perfil (y, z): base plana em ZR, topo a 45°
    translate([xc - LW() / 2, 0, 0]) rotate([90, 0, 90])
        linear_extrude(LW()) polygon([[0, ZR()], [-DR(), ZR()], [0, ZR() + DR() * 1.6]]);
}

module no_corpo(i) {
    x0 = HM() + i * SEG();
    x1 = x0 + SEG();
    hull() {
        translate([x0, YA(), ZA()]) rotate([0, 90, 0]) cylinder(h = x1 - x0, r = R(), $fn = 40);
        translate([x0, EL() - WALL(), 0]) cube([x1 - x0, WALL(), ZA() + R()]);
    }
}

module corpo() {
    difference() { cube([EW(), EL(), HB()]); cavidade(); }
    divisorias();
    if (ANEIS()) apoio_aneis();
    if (FECHO()) for (i = [0 : NFECHOS() - 1]) ressalto(xfecho(i));
    for (i = [0 : 2 : NSEG() - 1]) no_corpo(i);
    // pino contínuo (passa pelos nós da tampa, com folga)
    translate([HM(), YA(), ZA()]) rotate([0, 90, 0]) cylinder(h = SPAN(), r = RP(), $fn = 24);
}

// ── tampa (posição fechada) ──
module no_tampa(i) {
    x0 = HM() + i * SEG() + GA();
    x1 = HM() + (i + 1) * SEG() - GA();
    difference() {
        union() {
            hull() {
                translate([x0, YA(), ZA()]) rotate([0, 90, 0]) cylinder(h = x1 - x0, r = R(), $fn = 40);
                translate([x0, YA() - R(), HB()]) cube([x1 - x0, 2 * R(), LIDT()]);
            }
            translate([x0, EL() - 1, HB()]) cube([x1 - x0, YA() - EL() + 1, LIDT()]);   // aba até à placa
        }
        translate([x0 - 1, YA(), ZA()]) rotate([0, 90, 0]) cylinder(h = x1 - x0 + 2, r = RP() + FOLGA(), $fn = 24);
    }
}

module patilha(xc) {
    yi = -(DR() + 0.2);                       // face interior da patilha
    zb = ZR() - DR() * 1.6 - 2;               // ponta de baixo
    translate([xc - LW() / 2, 0, 0]) {
        translate([0, yi - TT(), zb]) cube([LW(), TT(), HB() + LIDT() - zb]);
        translate([0, yi - TT(), HB()]) cube([LW(), TT() - yi + 0.01, LIDT()]);   // liga à placa
        // gancho: topo plano 0.25 abaixo do ressalto, baixo a 45°
        rotate([90, 0, 90]) linear_extrude(LW())
            polygon([[yi - 0.3, ZR() - 0.25], [-0.2, ZR() - 0.25], [-0.2, ZR() - 0.45], [yi - 0.3, ZR() - 0.25 - DR() * 1.6 - 0.3]]);
    }
}

module texto_tampa() {
    if (len(TXT()) > 0)
        translate([EW() / 2, EL() / 2, HB() + LIDT() - 0.6])
            linear_extrude(1) text(TXT(), size = TS(), font = FONTE(), halign = "center", valign = "center");
}

module tampa_fechada() {
    difference() {
        union() {
            translate([0, 0, HB()]) cube([EW(), EL(), LIDT()]);
            // rebordo que entra na cavidade
            difference() {
                translate([WALL() + GAPT(), WALL() + GAPT(), HB() - LIPH()]) cube([W() - 2 * GAPT(), D() - 2 * GAPT(), LIPH() + 0.01]);
                translate([WALL() + GAPT() + LIPT(), WALL() + GAPT() + LIPT(), HB() - LIPH() - 1])
                    cube([W() - 2 * GAPT() - 2 * LIPT(), D() - 2 * GAPT() - 2 * LIPT(), LIPH() + 1]);
            }
            for (i = [1 : 2 : NSEG() - 1]) no_tampa(i);
            if (FECHO()) for (i = [0 : NFECHOS() - 1]) patilha(xfecho(i));
        }
        texto_tampa();
    }
}

// rodar 180° em torno do eixo da dobradiça: tampa aberta, deitada atrás da caixa
module tampa_aberta() {
    translate([0, YA(), ZA()]) rotate([180, 0, 0]) translate([0, -YA(), -ZA()]) tampa_fechada();
}

module main() {
    if (MODO() == "fechada") { corpo(); tampa_fechada(); }
    else { corpo(); tampa_aberta(); }
}

main();
$scad$, NULL, false, false, false, 1, 'CC-BY-NC', 36, 100, 'OpenSans')
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, generation_schema = EXCLUDED.generation_schema, scad_template = EXCLUDED.scad_template, tags = EXCLUDED.tags;

INSERT INTO prod_designs (id, nome, descricao, familia, estado, tags, generation_schema, parametros_default, scad_template, base_template_id, usa_modo, disponivel_consumidor, gratuito, preco_creditos, licenca, qualidade_preview, qualidade_final, default_fonte)
SELECT 'caixa-dobradica-bijuteria', $t$Caixa de Bijuteria com Dobradiça$t$, $t$Caixa para brincos, anéis e colares, com dobradiça print-in-place, fecho de encaixe, compartimentos e apoio para anéis. Ideal para oferta.$t$, 'caixas', 'rascunho', ARRAY['caixa', 'bijuteria', 'joias', 'brincos', 'aneis', 'dobradica', 'prenda']::text[], $j${"engine": "openscad", "version": 1, "entry": "inline", "modes": {"final": {"quality_fn": 100}, "preview": {"quality_fn": 36}}, "parameters": {"caixa_dobradica": {"ui": {"widget": "hidden"}, "order": 0, "default": "bijuteria"}, "largura": {"ui": {"step": 1, "label": "Largura (interior)", "widget": "slider"}, "min": 20, "max": 250, "type": "number", "order": 1, "default": 120, "unit": "mm"}, "profundidade": {"ui": {"step": 1, "label": "Profundidade (interior)", "widget": "slider"}, "min": 20, "max": 250, "type": "number", "order": 2, "default": 80, "unit": "mm"}, "altura": {"ui": {"step": 1, "label": "Altura (interior)", "widget": "slider"}, "min": 12, "max": 120, "type": "number", "order": 3, "default": 35, "unit": "mm"}, "divisoes_x": {"ui": {"step": 1, "label": "Compartimentos na largura", "widget": "slider"}, "min": 1, "max": 8, "type": "number", "order": 4, "default": 3}, "divisoes_y": {"ui": {"step": 1, "label": "Compartimentos na profundidade", "widget": "slider"}, "min": 1, "max": 8, "type": "number", "order": 5, "default": 2}, "fecho": {"ui": {"label": "Fecho de encaixe na frente", "widget": "checkbox"}, "type": "boolean", "order": 7, "default": true}, "texto": {"ui": {"label": "Texto gravado na tampa (opcional)", "widget": "text"}, "order": 8, "default": "Joias"}, "fonte": {"ui": {"label": "Tipo de letra", "widget": "select", "options": ["Open Sans", "Aladin", "Amarante", "Anton", "Baloo 2", "Benne", "Chewy", "Gloria Hallelujah", "Lobster", "Luckiest Guy", "Oswald", "Pacifico", "Press Start 2P", "Racing Sans One", "Sigmar One"]}, "order": 9, "default": "Pacifico"}, "tamanho_texto": {"ui": {"step": 1, "label": "Tamanho do texto", "widget": "slider"}, "min": 4, "max": 40, "type": "number", "order": 10, "default": 14, "unit": "mm"}, "parede": {"ui": {"step": 0.2, "label": "Espessura da parede", "widget": "slider"}, "min": 1.2, "max": 4, "type": "number", "order": 11, "default": 2, "unit": "mm"}, "fundo": {"ui": {"step": 0.2, "label": "Espessura do fundo", "widget": "slider"}, "min": 1.2, "max": 4, "type": "number", "order": 12, "default": 1.6, "unit": "mm"}, "folga": {"ui": {"step": 0.05, "label": "Folga da dobradiça (0,35 em PLA; mais se ficar presa)", "widget": "slider"}, "min": 0.2, "max": 0.7, "type": "number", "order": 13, "default": 0.35, "unit": "mm"}, "folga_tampa": {"ui": {"step": 0.05, "label": "Folga da tampa", "widget": "slider"}, "min": 0.1, "max": 0.6, "type": "number", "order": 14, "default": 0.25, "unit": "mm"}, "info_dobradica": {"ui": {"widget": "info", "text": "📦 Imprime numa só peça, já montada e aberta (a tampa deitada atrás da caixa), sem suportes. A dobradiça tem um pino contínuo com folga: depois de imprimir, abre e fecha a tampa com alguma força umas vezes até rodar livre. Se a dobradiça ficar presa na tua impressora, aumenta a folga (0,4–0,5). O texto fica gravado no topo da tampa (a face que assenta na mesa)."}, "order": 99, "default": null}, "apoio_aneis": {"ui": {"label": "Fila da frente com apoio para anéis", "widget": "checkbox"}, "type": "boolean", "order": 6, "default": true}}}$j$::jsonb, '{}'::jsonb, (SELECT scad_template FROM prod_designs WHERE id = 'caixa-dobradica'), NULL, false, false, false, 1, 'CC-BY-NC', 36, 100, 'OpenSans'
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, generation_schema = EXCLUDED.generation_schema, scad_template = EXCLUDED.scad_template, tags = EXCLUDED.tags;

INSERT INTO prod_designs (id, nome, descricao, familia, estado, tags, generation_schema, parametros_default, scad_template, base_template_id, usa_modo, disponivel_consumidor, gratuito, preco_creditos, licenca, qualidade_preview, qualidade_final, default_fonte)
SELECT 'caixa-dobradica-arrumacao', $t$Caixa de Arrumação com Dobradiça$t$, $t$Caixa organizadora para parafusos, pontas e peças pequenas, com grelha de compartimentos, dobradiça print-in-place e fecho de encaixe.$t$, 'caixas', 'rascunho', ARRAY['caixa', 'organizador', 'parafusos', 'makers', 'dobradica', 'arrumacao']::text[], $j${"engine": "openscad", "version": 1, "entry": "inline", "modes": {"final": {"quality_fn": 100}, "preview": {"quality_fn": 36}}, "parameters": {"caixa_dobradica": {"ui": {"widget": "hidden"}, "order": 0, "default": "arrumacao"}, "largura": {"ui": {"step": 1, "label": "Largura (interior)", "widget": "slider"}, "min": 20, "max": 250, "type": "number", "order": 1, "default": 160, "unit": "mm"}, "profundidade": {"ui": {"step": 1, "label": "Profundidade (interior)", "widget": "slider"}, "min": 20, "max": 250, "type": "number", "order": 2, "default": 100, "unit": "mm"}, "altura": {"ui": {"step": 1, "label": "Altura (interior)", "widget": "slider"}, "min": 12, "max": 120, "type": "number", "order": 3, "default": 40, "unit": "mm"}, "divisoes_x": {"ui": {"step": 1, "label": "Compartimentos na largura", "widget": "slider"}, "min": 1, "max": 8, "type": "number", "order": 4, "default": 4}, "divisoes_y": {"ui": {"step": 1, "label": "Compartimentos na profundidade", "widget": "slider"}, "min": 1, "max": 8, "type": "number", "order": 5, "default": 3}, "fecho": {"ui": {"label": "Fecho de encaixe na frente", "widget": "checkbox"}, "type": "boolean", "order": 7, "default": true}, "texto": {"ui": {"label": "Texto gravado na tampa (opcional)", "widget": "text"}, "order": 8, "default": ""}, "fonte": {"ui": {"label": "Tipo de letra", "widget": "select", "options": ["Open Sans", "Aladin", "Amarante", "Anton", "Baloo 2", "Benne", "Chewy", "Gloria Hallelujah", "Lobster", "Luckiest Guy", "Oswald", "Pacifico", "Press Start 2P", "Racing Sans One", "Sigmar One"]}, "order": 9, "default": "Oswald"}, "tamanho_texto": {"ui": {"step": 1, "label": "Tamanho do texto", "widget": "slider"}, "min": 4, "max": 40, "type": "number", "order": 10, "default": 12, "unit": "mm"}, "parede": {"ui": {"step": 0.2, "label": "Espessura da parede", "widget": "slider"}, "min": 1.2, "max": 4, "type": "number", "order": 11, "default": 2, "unit": "mm"}, "fundo": {"ui": {"step": 0.2, "label": "Espessura do fundo", "widget": "slider"}, "min": 1.2, "max": 4, "type": "number", "order": 12, "default": 1.6, "unit": "mm"}, "folga": {"ui": {"step": 0.05, "label": "Folga da dobradiça (0,35 em PLA; mais se ficar presa)", "widget": "slider"}, "min": 0.2, "max": 0.7, "type": "number", "order": 13, "default": 0.35, "unit": "mm"}, "folga_tampa": {"ui": {"step": 0.05, "label": "Folga da tampa", "widget": "slider"}, "min": 0.1, "max": 0.6, "type": "number", "order": 14, "default": 0.25, "unit": "mm"}, "info_dobradica": {"ui": {"widget": "info", "text": "📦 Imprime numa só peça, já montada e aberta (a tampa deitada atrás da caixa), sem suportes. A dobradiça tem um pino contínuo com folga: depois de imprimir, abre e fecha a tampa com alguma força umas vezes até rodar livre. Se a dobradiça ficar presa na tua impressora, aumenta a folga (0,4–0,5). O texto fica gravado no topo da tampa (a face que assenta na mesa)."}, "order": 99, "default": null}}}$j$::jsonb, '{}'::jsonb, (SELECT scad_template FROM prod_designs WHERE id = 'caixa-dobradica'), NULL, false, false, false, 1, 'CC-BY-NC', 36, 100, 'OpenSans'
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, generation_schema = EXCLUDED.generation_schema, scad_template = EXCLUDED.scad_template, tags = EXCLUDED.tags;
