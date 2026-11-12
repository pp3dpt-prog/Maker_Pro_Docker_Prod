-- Suportes de telemóvel personalizados (só makers), 2026-11-12, em RASCUNHO, família
-- 'suportes', com o plano, preços e acesso do suporte_telemovel_personalizado (copiados dessa linha).
-- Templates em templates/<id>.scad; generation_schema gerado (multicor + logo + ajuste_texto, como o
-- suporte de monitor personalizado); suporte = "<modelo>_personalizado" (escondido) → pré-visualização
-- ao vivo no frontend (lib/suportesTelemovelExtra.ts).

-- suporte_telemovel_secretaria_personalizado (template md5 42d2b8d6bb7adf31a8e4189bfa4305d3)
INSERT INTO prod_designs (id, nome, descricao, familia, tags, licenca, estado, acesso_maker, requer_licenca_comercial,
  disponivel_consumidor, gratuito, preco_creditos, credit_price, pvp, preco_base, usa_modo, parametros_default,
  scad_template, generation_schema)
SELECT 'suporte_telemovel_secretaria_personalizado', 'Suporte de telemóvel de secretária — personalizado', 'Suporte clássico para a mesa (base, lábio, ranhura e encosto inclinado com reforço), com texto ou imagem embutidos à face no encosto e/ou no lábio, noutra cor. 3MF multicor (AMS) ou peças para colar.', familia,
  ARRAY['suporte', 'telemóvel', 'secretária', 'mesa', 'personalizado', 'texto', 'imagem', '3mf', 'multicor']::text[], licenca, 'rascunho', acesso_maker, requer_licenca_comercial,
  disponivel_consumidor, gratuito, preco_creditos, credit_price, pvp, preco_base, usa_modo, '{}'::jsonb,
  $scad$// ── SUPORTE DE TELEMÓVEL DE SECRETÁRIA — PERSONALIZADO (texto/imagem à face, 3MF) ──
//
// Suporte clássico para pousar na mesa: base, lábio à frente, ranhura para o telemóvel, encosto
// inclinado para trás e reforço por trás. O perfil (vista de lado) está em XY — x para trás a
// partir da frente, y para cima — e é extrudido pela largura em z: sai deitado de lado, que é como
// se imprime (sem suportes).
//
// Texto ou imagem embutidos À FACE, noutra cor, na frente do encosto (zona "encosto") e/ou na
// frente do lábio (zona "labio"). Sai em 3MF (generation_schema.multicor); o template corre uma
// vez por parte (modo):
//   "corpo"                  suporte com os rebaixos
//   "encosto" / "labio"      enchimento de cada zona (rente à face)
//   "encosto_solta" / "labio_solta"  sem AMS: o enchimento deitado na mesa, um pouco mais pequeno
//                            (folga_embutido) para imprimir noutra cor e colar no rebaixo
// (sem modo: tudo, com cores — só para ver no OpenSCAD).
// Do servidor: esc_texto_encosto / esc_texto_labio (lib/textFit.js) e encosto_pts / encosto_paths
//   / tem_encosto, labio_pts / labio_paths / tem_labio (lib/logo.js).
// Se mudares as fórmulas, muda também Maker_Pro_Frontend_Prod/lib/suportesTelemovelExtra.ts.

function _b(v, d) = is_undef(v) ? d : (v == true || v == 1 || v == "true");
function _W()   = is_undef(largura) ? 75 : largura;
function _a()   = is_undef(angulo) ? 22 : angulo;
function _Le()  = is_undef(altura_encosto) ? 110 : altura_encosto;
function _e()   = is_undef(espessura) ? 6 : espessura;
function _g()   = is_undef(espessura_telemovel) ? 12 : espessura_telemovel;
function _hl()  = max(_e() + 3, is_undef(altura_labio) ? 16 : altura_labio);
function _ref() = is_undef(reforco) ? "Inteiro" : reforco;
function _rc()  = _b(is_undef(ranhura_cabo) ? undef : ranhura_cabo, true);
function _wr()  = is_undef(largura_ranhura) ? 12 : largura_ranhura;

function _x0() = _e() + _g();                                        // frente do encosto, junto à base
function _V()  = [sin(_a()), cos(_a())];                             // ao longo do encosto, para cima
function _Nb() = [cos(_a()), -sin(_a())];                            // normal de trás do encosto
function _F0() = [_x0(), _e()];
function _Pk() = _F0() + 0.6 * _Le() * _V() + _e() * _Nb();          // onde o reforço toca no encosto
function _Lb() = max(is_undef(profundidade_base) ? 90 : profundidade_base,
                     _x0() + 0.75 * _Le() * sin(_a()) + _e() * cos(_a()) + _e(), _Pk()[0] + _e());

module perfil() {
    e = _e(); Lb = _Lb(); F0 = _F0(); V = _V(); Nb = _Nb(); Le = _Le();
    square([Lb, e]);                                                 // base
    square([e, _hl()]);                                              // lábio
    polygon([F0, F0 + Le * V, F0 + Le * V + e * Nb, F0 + e * Nb]);   // encosto
    if (_ref() == "Inteiro") polygon([F0, _Pk(), [Lb, e]]);
    else if (_ref() == "Barra") {
        Q = [Lb - 0.75 * e, e / 2]; d = (Q - _Pk()) / norm(Q - _Pk()); np = [-d[1], d[0]];
        polygon([_Pk() + e / 2 * np, Q + e / 2 * np, Q - e / 2 * np, _Pk() - e / 2 * np]);
    }
}

module suporte() {
    W = _W();
    difference() {
        linear_extrude(height = W) perfil();
        if (_rc())                                                   // ranhura do cabo (pelo lábio e pelo fundo)
            translate([-1, -1, (W - _wr()) / 2]) cube([_x0() + 1, _hl() + 2, _wr()]);
    }
}

// ══ personalização: texto/imagem à face ══
MARG = 4;                                                            // margem às arestas da largura (mm)
MV = 1;                                                              // margem às arestas em altura (mm)
function _modo()  = is_undef(modo) ? "tudo" : modo;
function _fonte() = is_undef(fonte) ? "Open Sans" : fonte;
function _dp()    = max(0.4, min(is_undef(profundidade_embutido) ? 1 : profundidade_embutido, _e() - 1.5));
function _conteudo(z) = z == "encosto" ? (is_undef(conteudo_encosto) ? "Texto" : conteudo_encosto)
                                       : (is_undef(conteudo_labio) ? "Nada" : conteudo_labio);
function _texto(z) = z == "encosto" ? (is_undef(texto_encosto) ? "pp3d" : texto_encosto) : (is_undef(texto_labio) ? "" : texto_labio);
function _tam(z)   = z == "encosto" ? (is_undef(tamanho_texto_encosto) ? 12 : tamanho_texto_encosto) : (is_undef(tamanho_texto_labio) ? 8 : tamanho_texto_labio);
function _esc(z)   = let(v = z == "encosto" ? (is_undef(esc_texto_encosto) ? 1 : esc_texto_encosto) : (is_undef(esc_texto_labio) ? 1 : esc_texto_labio)) max(0.05, min(1, v));
function _tem_img(z) = z == "encosto" ? (!is_undef(tem_encosto) && tem_encosto == true && !is_undef(encosto_pts) && len(encosto_pts) >= 3)
                                      : (!is_undef(tem_labio) && tem_labio == true && !is_undef(labio_pts) && len(labio_pts) >= 3);
function _ativa(z) = _conteudo(z) == "Texto" ? len(_texto(z)) > 0 : _conteudo(z) == "Imagem" ? _tem_img(z) : false;

function _sc() = _Le() * max(0, min(100, is_undef(posicao_encosto) ? 70 : posicao_encosto)) / 100;
// face → peça: (u, v, w), u = leitura, v = para cima, w para fora da face (rotação própria)
function _M(z) = let(a = _a(), c = cos(a), s = sin(a), W = _W())
    z == "encosto"
    ? let(O = _F0() + _sc() * _V()) [[0, s, -c, O[0]], [0, c, s, O[1]], [1, 0, 0, W / 2], [0, 0, 0, 1]]
    : [[0, 0, -1, 0], [0, 1, 0, _hl() / 2], [1, 0, 0, W / 2], [0, 0, 0, 1]];

// região útil de cada zona, no plano da face (u, v)
module zona(z) {
    W = _W();
    if (z == "encosto")
        translate([-(W / 2 - MARG), MV - _sc()]) square([W - 2 * MARG, _Le() - 2 * MV]);
    else difference() {
        translate([-(W / 2 - MARG), -(_hl() / 2 - MV)]) square([W - 2 * MARG, _hl() - 2 * MV]);
        if (_rc()) translate([-_wr() / 2 - 1, -_hl()]) square([_wr() + 2, 2 * _hl()]);
    }
}

module conteudo2d(z) {
    intersection() {
        zona(z);
        if (_conteudo(z) == "Texto")
            scale(_esc(z)) offset(delta = 0.01)
                text(_texto(z), size = _tam(z), font = _fonte(), halign = "center", valign = "center", $fn = 16);
        else if (_conteudo(z) == "Imagem" && _tem_img(z)) {
            if (z == "encosto") polygon(points = encosto_pts, paths = encosto_paths);
            else polygon(points = labio_pts, paths = labio_paths);
        }
    }
}
module na_face(z, w0, w1) { multmatrix(_M(z)) translate([0, 0, w0]) linear_extrude(height = w1 - w0) conteudo2d(z); }
module enchimento(z) { if (_ativa(z)) na_face(z, -_dp(), 0); }

function _fe() = max(0, min(0.5, is_undef(folga_embutido) ? 0.15 : folga_embutido));
module solta(z) { if (_ativa(z)) linear_extrude(height = _dp()) offset(delta = -_fe()) conteudo2d(z); }

module corpo() {
    difference() {
        suporte();
        for (z = ["encosto", "labio"]) if (_ativa(z)) na_face(z, -_dp(), 0.5);
    }
}

if (_modo() == "corpo") corpo();
else if (_modo() == "encosto") enchimento("encosto");
else if (_modo() == "labio") enchimento("labio");
else if (_modo() == "encosto_solta") solta("encosto");
else if (_modo() == "labio_solta") solta("labio");
else {
    color(is_undef(cor_suporte) ? "#111111" : cor_suporte) corpo();
    color(is_undef(cor_encosto) ? "#FFFFFF" : cor_encosto) enchimento("encosto");
    color(is_undef(cor_labio) ? "#FFFFFF" : cor_labio) enchimento("labio");
}
$scad$,
  $json${"engine":"openscad","version":1,"preview_por_partes":true,"logo":[{"param":"imagem_encosto","prefixo":"encosto","so_quando":{"conteudo_encosto":"Imagem"},"max_pontos":4000,"largura_param":"largura_imagem_encosto","simplificar_mm":0.1},{"param":"imagem_labio","prefixo":"labio","so_quando":{"conteudo_labio":"Imagem"},"max_pontos":4000,"largura_param":"largura_imagem_labio","simplificar_mm":0.1}],"multicor":{"partes":[{"modo":"corpo","nome":"Suporte","cor_param":"cor_suporte"},{"modo":"encosto","nome":"Encosto (texto/imagem)","cor_param":"cor_encosto"},{"modo":"labio","nome":"Lábio (texto/imagem)","cor_param":"cor_labio"}],"param_impressao":"impressao","sem_ams_ficheiros":[{"nome":"suporte.stl","params":{"modo":"corpo"}},{"nome":"encosto_peca_para_colar.stl","params":{"modo":"encosto_solta"}},{"nome":"labio_peca_para_colar.stl","params":{"modo":"labio_solta"}}],"texto_sem_ams":["Impressão sem AMS (uma cor de cada vez):","  1. suporte.stl — o suporte (imprime deitado de lado, como sai), com o texto/imagem em baixo-relevo (rebaixo).","     Se quiseres só uma cor, fica assim: o texto/imagem lê-se pelo rebaixo.","  2. *_peca_para_colar.stl — o texto/imagem para encher o rebaixo, já deitados na mesa e um pouco","     mais pequenos (folga). Imprime noutra cor e cola com cola de contacto ou CA.","","Dica: com AMS escolhe \"AMS (3MF multicor)\" e recebes um 3MF com tudo já montado e uma peça por cor."]},"ajuste_texto":{"campos":["texto_encosto","texto_labio"],"largura_util":67,"largura_util_param":"largura","largura_util_margem":8,"tamanho_param_por_campo":{"texto_encosto":"tamanho_texto_encosto","texto_labio":"tamanho_texto_labio"}},"parameters":{"suporte":{"ui":{"widget":"hidden"},"order":0,"default":"secretaria_personalizado"},"largura":{"ui":{"step":1,"label":"Largura do suporte","widget":"slider"},"max":140,"min":40,"type":"number","unit":"mm","order":2,"default":75},"angulo":{"ui":{"step":1,"label":"Inclinação do encosto (0° = vertical)","widget":"slider"},"max":45,"min":5,"type":"number","unit":"°","order":3,"default":22},"altura_encosto":{"ui":{"step":1,"label":"Comprimento do encosto","widget":"slider"},"max":170,"min":50,"type":"number","unit":"mm","order":4,"default":110},"espessura_telemovel":{"ui":{"step":0.5,"label":"Espessura do telemóvel com capa (ranhura)","widget":"slider"},"max":22,"min":6,"type":"number","unit":"mm","order":5,"default":12},"altura_labio":{"ui":{"step":1,"label":"Altura do lábio da frente","widget":"slider"},"max":35,"min":9,"type":"number","unit":"mm","order":6,"default":16},"profundidade_base":{"ui":{"step":1,"label":"Profundidade mínima da base","widget":"slider"},"max":170,"min":60,"type":"number","unit":"mm","order":7,"default":90},"reforco":{"ui":{"label":"Reforço por trás do encosto","widget":"select","options":["Inteiro","Barra","Sem"]},"order":8,"default":"Inteiro"},"espessura":{"ui":{"step":0.5,"label":"Espessura das paredes","widget":"slider"},"max":10,"min":4,"type":"number","unit":"mm","order":9,"default":6},"ranhura_cabo":{"ui":{"label":"Ranhura para o cabo de carregamento (a meio do lábio)","widget":"checkbox"},"order":10,"default":true},"largura_ranhura":{"ui":{"step":0.5,"label":"Largura da ranhura do cabo","widget":"slider","visible_when":{"ranhura_cabo":{"min":1}}},"max":30,"min":6,"type":"number","unit":"mm","order":11,"default":12},"conteudo_encosto":{"ui":{"label":"Encosto","widget":"select","options":["Nada","Texto","Imagem"]},"order":40,"default":"Texto"},"texto_encosto":{"ui":{"label":"Texto (encosto)","widget":"text","visible_when":{"conteudo_encosto":{"eq":"Texto"}}},"order":41,"default":"pp3d"},"tamanho_texto_encosto":{"ui":{"step":0.5,"label":"Tamanho das letras (encosto)","widget":"slider","visible_when":{"conteudo_encosto":{"eq":"Texto"}}},"max":40,"min":4,"type":"number","unit":"mm","order":42,"default":12},"imagem_encosto":{"ui":{"label":"Imagem (encosto) — PNG, JPG ou SVG","accept":"image/png,image/jpeg,image/webp,image/svg+xml","widget":"image_upload","visible_when":{"conteudo_encosto":{"eq":"Imagem"}}},"order":43,"default":""},"largura_imagem_encosto":{"ui":{"step":1,"label":"Largura da imagem (encosto)","widget":"slider","visible_when":{"conteudo_encosto":{"eq":"Imagem"}}},"max":130,"min":5,"type":"number","unit":"mm","order":44,"default":40},"cor_encosto":{"ui":{"label":"Cor do texto/imagem (encosto)","paleta":[{"hex":"#FFFFFF","nome":"Branco"},{"hex":"#111111","nome":"Preto"},{"hex":"#9CA3AF","nome":"Cinzento"},{"hex":"#DC2626","nome":"Vermelho"},{"hex":"#F97316","nome":"Laranja"},{"hex":"#FACC15","nome":"Amarelo"},{"hex":"#16A34A","nome":"Verde"},{"hex":"#38BDF8","nome":"Azul claro"},{"hex":"#1E3A8A","nome":"Azul"},{"hex":"#7C3AED","nome":"Roxo"},{"hex":"#F472B6","nome":"Rosa"}],"widget":"color","visible_when":{"conteudo_encosto":{"ne":"Nada"}}},"order":46,"default":"#FFFFFF"},"posicao_encosto":{"ui":{"step":1,"label":"Posição no encosto (0% = em baixo)","widget":"slider","visible_when":{"conteudo_encosto":{"ne":"Nada"}}},"max":100,"min":0,"type":"number","unit":"%","order":45,"default":70},"conteudo_labio":{"ui":{"label":"Lábio","widget":"select","options":["Nada","Texto","Imagem"]},"order":50,"default":"Nada"},"texto_labio":{"ui":{"label":"Texto (lábio)","widget":"text","visible_when":{"conteudo_labio":{"eq":"Texto"}}},"order":51,"default":""},"tamanho_texto_labio":{"ui":{"step":0.5,"label":"Tamanho das letras (lábio)","widget":"slider","visible_when":{"conteudo_labio":{"eq":"Texto"}}},"max":40,"min":4,"type":"number","unit":"mm","order":52,"default":8},"imagem_labio":{"ui":{"label":"Imagem (lábio) — PNG, JPG ou SVG","accept":"image/png,image/jpeg,image/webp,image/svg+xml","widget":"image_upload","visible_when":{"conteudo_labio":{"eq":"Imagem"}}},"order":53,"default":""},"largura_imagem_labio":{"ui":{"step":1,"label":"Largura da imagem (lábio)","widget":"slider","visible_when":{"conteudo_labio":{"eq":"Imagem"}}},"max":130,"min":5,"type":"number","unit":"mm","order":54,"default":30},"cor_labio":{"ui":{"label":"Cor do texto/imagem (lábio)","paleta":[{"hex":"#FFFFFF","nome":"Branco"},{"hex":"#111111","nome":"Preto"},{"hex":"#9CA3AF","nome":"Cinzento"},{"hex":"#DC2626","nome":"Vermelho"},{"hex":"#F97316","nome":"Laranja"},{"hex":"#FACC15","nome":"Amarelo"},{"hex":"#16A34A","nome":"Verde"},{"hex":"#38BDF8","nome":"Azul claro"},{"hex":"#1E3A8A","nome":"Azul"},{"hex":"#7C3AED","nome":"Roxo"},{"hex":"#F472B6","nome":"Rosa"}],"widget":"color","visible_when":{"conteudo_labio":{"ne":"Nada"}}},"order":56,"default":"#FFFFFF"},"impressao":{"ui":{"label":"Impressora","widget":"select","options":["AMS (3MF multicor)","Sem AMS (STL, peças para colar)"]},"order":37,"default":"AMS (3MF multicor)"},"fonte":{"ui":{"label":"Tipo de letra","widget":"select","options":["Open Sans","Aladin","Amarante","Anton","Baloo 2","Benne","Chewy","Gloria Hallelujah","Lobster","Luckiest Guy","Oswald","Pacifico","Press Start 2P","Racing Sans One","Sigmar One"]},"order":38,"default":"Open Sans"},"cor_suporte":{"ui":{"label":"Cor do suporte","paleta":[{"hex":"#FFFFFF","nome":"Branco"},{"hex":"#111111","nome":"Preto"},{"hex":"#9CA3AF","nome":"Cinzento"},{"hex":"#DC2626","nome":"Vermelho"},{"hex":"#F97316","nome":"Laranja"},{"hex":"#FACC15","nome":"Amarelo"},{"hex":"#16A34A","nome":"Verde"},{"hex":"#38BDF8","nome":"Azul claro"},{"hex":"#1E3A8A","nome":"Azul"},{"hex":"#7C3AED","nome":"Roxo"},{"hex":"#F472B6","nome":"Rosa"}],"widget":"color"},"order":36,"default":"#111111"},"profundidade_embutido":{"ui":{"step":0.1,"label":"Profundidade do texto/imagem embutido","widget":"slider"},"max":2,"min":0.4,"type":"number","unit":"mm","order":60,"default":1},"folga_embutido":{"ui":{"step":0.05,"label":"Folga das peças a colar (sem AMS)","widget":"slider","visible_when":{"impressao":{"eq":"Sem AMS (STL, peças para colar)"}}},"max":0.5,"min":0,"type":"number","unit":"mm","order":61,"default":0.15},"info_suporte":{"ui":{"text":"📱 Suporte de secretária: o telemóvel assenta na ranhura atrás do lábio e encosta ao encosto inclinado. Mede a espessura do telemóvel com a capa e põe um pouco mais. O texto/imagem fica embutido à face no encosto (usa a posição para o pôr acima do telemóvel, que tapa a parte de baixo) e/ou na frente do lábio — com a ranhura do cabo, o meio do lábio fica livre. Com AMS recebes um 3MF com uma peça por cor (suporte e texto/imagem de cada zona), já montadas — no Bambu Studio/Orca atribui um filamento do AMS a cada uma. Sem AMS recebes STL: o suporte com o texto/imagem em rebaixo e as peças para imprimir noutra cor e colar. Imprime deitado de lado (sai já assim, sem suportes).","widget":"info"},"order":99,"default":null}}}$json$::jsonb
FROM prod_designs WHERE id = 'suporte_telemovel_personalizado'
ON CONFLICT (id) DO UPDATE SET scad_template = EXCLUDED.scad_template, generation_schema = EXCLUDED.generation_schema,
  nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, tags = EXCLUDED.tags;

-- suporte_telemovel_dock_personalizado (template md5 88e8956882db6a96f67b5b2be4472668)
INSERT INTO prod_designs (id, nome, descricao, familia, tags, licenca, estado, acesso_maker, requer_licenca_comercial,
  disponivel_consumidor, gratuito, preco_creditos, credit_price, pvp, preco_base, usa_modo, parametros_default,
  scad_template, generation_schema)
SELECT 'suporte_telemovel_dock_personalizado', 'Dock vertical para carregar o telemóvel — personalizado', 'Bloco para a mesa onde o telemóvel fica de pé a carregar: ranhura inclinada, furo para a ficha (USB-C/Lightning) e canal do cabo por baixo. Texto ou imagem embutidos à face na frente e/ou na face inclinada, noutra cor. 3MF multicor (AMS) ou peças para colar.', familia,
  ARRAY['suporte', 'telemóvel', 'dock', 'carregador', 'usb-c', 'personalizado', 'texto', 'imagem', '3mf', 'multicor']::text[], licenca, 'rascunho', acesso_maker, requer_licenca_comercial,
  disponivel_consumidor, gratuito, preco_creditos, credit_price, pvp, preco_base, usa_modo, '{}'::jsonb,
  $scad$// ── DOCK VERTICAL PARA CARREGAR O TELEMÓVEL — PERSONALIZADO (texto/imagem à face, 3MF) ──
//
// Bloco para a mesa com uma ranhura em cima onde o telemóvel fica de pé (ligeiramente inclinado
// para trás) e um furo no fundo da ranhura para a ficha do cabo (USB-C/Lightning): a ficha entra
// por baixo e o cabo sai por um canal no fundo, para trás. O perfil (vista de lado) está em XY —
// x para trás a partir da frente, y para cima — e é extrudido pela largura em z: sai deitado de
// lado, que é como se imprime (sem suportes). A ranhura é aberta dos dois lados (cabe qualquer
// largura de telemóvel); o furo da ficha e o canal do cabo ficam a meio da largura.
//
// Texto ou imagem embutidos À FACE, noutra cor, na frente (zona "frente") e/ou na face inclinada
// de cima, à frente do telemóvel (zona "inclinada"). Sai em 3MF (generation_schema.multicor):
//   "corpo"  dock com os rebaixos      "frente" / "inclinada"  enchimento de cada zona
//   "frente_solta" / "inclinada_solta"  sem AMS: o enchimento deitado na mesa, com folga, para colar
// (sem modo: tudo, com cores — só para ver no OpenSCAD).
// Do servidor: esc_texto_frente / esc_texto_inclinada (lib/textFit.js) e frente_pts / frente_paths
//   / tem_frente, inclinada_pts / inclinada_paths / tem_inclinada (lib/logo.js).
// Se mudares as fórmulas, muda também Maker_Pro_Frontend_Prod/lib/suportesTelemovelExtra.ts.

function _W()  = is_undef(largura) ? 90 : largura;
function _D()  = is_undef(profundidade) ? 75 : profundidade;
function _H()  = is_undef(altura) ? 50 : altura;
function _Hf() = max(8, min(_H() - 5, is_undef(altura_frente) ? 28 : altura_frente));
function _a()  = is_undef(angulo) ? 12 : angulo;
function _g()  = is_undef(espessura_telemovel) ? 12 : espessura_telemovel;
function _ds() = min(_H() - 12, is_undef(profundidade_ranhura) ? 18 : profundidade_ranhura);
function _wf() = is_undef(largura_ficha) ? 13 : largura_ficha;
function _tf() = is_undef(espessura_ficha) ? 8 : espessura_ficha;
function _wc() = min(_wf(), is_undef(diametro_cabo) ? 5 : diametro_cabo);

function _Vp() = [sin(_a()), cos(_a())];                             // eixo do telemóvel, para cima
function _Np() = [cos(_a()), -sin(_a())];                            // normal (para trás)
function _gc() = _g() / (2 * cos(_a()));                             // meia largura da ranhura na horizontal
// ranhura: a meio da profundidade, mas com pelo menos 10 mm de parede atrás e 14 à frente
function _xs() = max(_gc() + 14, min(0.55 * _D(), _D() - _gc() - 10 - _ds() * sin(_a())));
function _B()  = [_xs(), _H()] - _ds() * _Vp();                      // fundo da ranhura (eixo)
function _xf() = _xs() - _gc() - 3;                                  // fim da face inclinada
function _Px() = _B()[0] - _B()[1] * tan(_a());                      // onde o furo da ficha sai em baixo

module bloco() { polygon([[0, 0], [_D(), 0], [_D(), _H()], [_xf(), _H()], [0, _Hf()]]); }
module ranhura() {
    B = _B(); g2 = _g() / 2; Np = _Np(); Vp = _Vp(); L = _ds() + 30;
    polygon([B - g2 * Np, B + g2 * Np, B + g2 * Np + L * Vp, B - g2 * Np + L * Vp]);
}
module furo_ficha() {
    B = _B(); t2 = _tf() / 2; Np = _Np(); Vp = _Vp(); L = (B[1] + 2) / cos(_a());
    polygon([B - t2 * Np + Vp, B + t2 * Np + Vp, B + t2 * Np - L * Vp, B - t2 * Np - L * Vp]);
}
module canal_cabo() { translate([_Px() - _wc() / 2, -1]) square([_D() - _Px() + _wc() / 2 + 1, _wc() + 1]); }

module dock() {
    W = _W();
    difference() {
        linear_extrude(height = W) difference() { bloco(); ranhura(); }
        translate([0, 0, (W - _wf()) / 2]) linear_extrude(height = _wf()) furo_ficha();
        translate([0, 0, (W - _wc()) / 2]) linear_extrude(height = _wc()) canal_cabo();
    }
}

// ══ personalização: texto/imagem à face ══
MARG = 4;                                                            // margem às arestas da largura (mm)
MV = 1;                                                              // margem às arestas em altura (mm)
function _modo()  = is_undef(modo) ? "tudo" : modo;
function _fonte() = is_undef(fonte) ? "Open Sans" : fonte;
function _dp()    = max(0.4, min(is_undef(profundidade_embutido) ? 1 : profundidade_embutido, 3));
function _conteudo(z) = z == "frente" ? (is_undef(conteudo_frente) ? "Texto" : conteudo_frente)
                                      : (is_undef(conteudo_inclinada) ? "Nada" : conteudo_inclinada);
function _texto(z) = z == "frente" ? (is_undef(texto_frente) ? "pp3d" : texto_frente) : (is_undef(texto_inclinada) ? "" : texto_inclinada);
function _tam(z)   = z == "frente" ? (is_undef(tamanho_texto_frente) ? 14 : tamanho_texto_frente) : (is_undef(tamanho_texto_inclinada) ? 10 : tamanho_texto_inclinada);
function _esc(z)   = let(v = z == "frente" ? (is_undef(esc_texto_frente) ? 1 : esc_texto_frente) : (is_undef(esc_texto_inclinada) ? 1 : esc_texto_inclinada)) max(0.05, min(1, v));
function _tem_img(z) = z == "frente" ? (!is_undef(tem_frente) && tem_frente == true && !is_undef(frente_pts) && len(frente_pts) >= 3)
                                     : (!is_undef(tem_inclinada) && tem_inclinada == true && !is_undef(inclinada_pts) && len(inclinada_pts) >= 3);
function _ativa(z) = _conteudo(z) == "Texto" ? len(_texto(z)) > 0 : _conteudo(z) == "Imagem" ? _tem_img(z) : false;

function _Li() = norm([_xf(), _H() - _Hf()]);                        // comprimento da face inclinada
function _Vi() = [_xf(), _H() - _Hf()] / _Li();
// face → peça: (u, v, w), u = leitura, v = para cima, w para fora da face (rotação própria)
function _M(z) = let(W = _W())
    z == "frente"
    ? [[0, 0, -1, 0], [0, 1, 0, _Hf() / 2], [1, 0, 0, W / 2], [0, 0, 0, 1]]
    : let(v = _Vi()) [[0, v[0], -v[1], _xf() / 2], [0, v[1], v[0], (_Hf() + _H()) / 2], [1, 0, 0, W / 2], [0, 0, 0, 1]];

module zona(z) {
    W = _W(); h = z == "frente" ? _Hf() : _Li();
    translate([-(W / 2 - MARG), -(h / 2 - MV)]) square([W - 2 * MARG, h - 2 * MV]);
}

module conteudo2d(z) {
    intersection() {
        zona(z);
        if (_conteudo(z) == "Texto")
            scale(_esc(z)) offset(delta = 0.01)
                text(_texto(z), size = _tam(z), font = _fonte(), halign = "center", valign = "center", $fn = 16);
        else if (_conteudo(z) == "Imagem" && _tem_img(z)) {
            if (z == "frente") polygon(points = frente_pts, paths = frente_paths);
            else polygon(points = inclinada_pts, paths = inclinada_paths);
        }
    }
}
module na_face(z, w0, w1) { multmatrix(_M(z)) translate([0, 0, w0]) linear_extrude(height = w1 - w0) conteudo2d(z); }
module enchimento(z) { if (_ativa(z)) na_face(z, -_dp(), 0); }

function _fe() = max(0, min(0.5, is_undef(folga_embutido) ? 0.15 : folga_embutido));
module solta(z) { if (_ativa(z)) linear_extrude(height = _dp()) offset(delta = -_fe()) conteudo2d(z); }

module corpo() {
    difference() {
        dock();
        for (z = ["frente", "inclinada"]) if (_ativa(z)) na_face(z, -_dp(), 0.5);
    }
}

if (_modo() == "corpo") corpo();
else if (_modo() == "frente") enchimento("frente");
else if (_modo() == "inclinada") enchimento("inclinada");
else if (_modo() == "frente_solta") solta("frente");
else if (_modo() == "inclinada_solta") solta("inclinada");
else {
    color(is_undef(cor_suporte) ? "#111111" : cor_suporte) corpo();
    color(is_undef(cor_frente) ? "#FFFFFF" : cor_frente) enchimento("frente");
    color(is_undef(cor_inclinada) ? "#FFFFFF" : cor_inclinada) enchimento("inclinada");
}
$scad$,
  $json${"engine":"openscad","version":1,"preview_por_partes":true,"logo":[{"param":"imagem_frente","prefixo":"frente","so_quando":{"conteudo_frente":"Imagem"},"max_pontos":4000,"largura_param":"largura_imagem_frente","simplificar_mm":0.1},{"param":"imagem_inclinada","prefixo":"inclinada","so_quando":{"conteudo_inclinada":"Imagem"},"max_pontos":4000,"largura_param":"largura_imagem_inclinada","simplificar_mm":0.1}],"multicor":{"partes":[{"modo":"corpo","nome":"Dock","cor_param":"cor_suporte"},{"modo":"frente","nome":"Frente (texto/imagem)","cor_param":"cor_frente"},{"modo":"inclinada","nome":"Face inclinada (texto/imagem)","cor_param":"cor_inclinada"}],"param_impressao":"impressao","sem_ams_ficheiros":[{"nome":"suporte.stl","params":{"modo":"corpo"}},{"nome":"frente_peca_para_colar.stl","params":{"modo":"frente_solta"}},{"nome":"inclinada_peca_para_colar.stl","params":{"modo":"inclinada_solta"}}],"texto_sem_ams":["Impressão sem AMS (uma cor de cada vez):","  1. suporte.stl — o dock (imprime deitado de lado, como sai), com o texto/imagem em baixo-relevo (rebaixo).","     Se quiseres só uma cor, fica assim: o texto/imagem lê-se pelo rebaixo.","  2. *_peca_para_colar.stl — o texto/imagem para encher o rebaixo, já deitados na mesa e um pouco","     mais pequenos (folga). Imprime noutra cor e cola com cola de contacto ou CA.","","Dica: com AMS escolhe \"AMS (3MF multicor)\" e recebes um 3MF com tudo já montado e uma peça por cor."]},"ajuste_texto":{"campos":["texto_frente","texto_inclinada"],"largura_util":82,"largura_util_param":"largura","largura_util_margem":8,"tamanho_param_por_campo":{"texto_frente":"tamanho_texto_frente","texto_inclinada":"tamanho_texto_inclinada"}},"parameters":{"suporte":{"ui":{"widget":"hidden"},"order":0,"default":"dock_personalizado"},"largura":{"ui":{"step":1,"label":"Largura do dock","widget":"slider"},"max":140,"min":50,"type":"number","unit":"mm","order":2,"default":90},"profundidade":{"ui":{"step":1,"label":"Profundidade","widget":"slider"},"max":120,"min":50,"type":"number","unit":"mm","order":3,"default":75},"altura":{"ui":{"step":1,"label":"Altura atrás","widget":"slider"},"max":90,"min":30,"type":"number","unit":"mm","order":4,"default":50},"altura_frente":{"ui":{"step":1,"label":"Altura à frente","widget":"slider"},"max":85,"min":10,"type":"number","unit":"mm","order":5,"default":28},"angulo":{"ui":{"step":1,"label":"Inclinação do telemóvel (0° = vertical)","widget":"slider"},"max":25,"min":0,"type":"number","unit":"°","order":6,"default":12},"espessura_telemovel":{"ui":{"step":0.5,"label":"Espessura do telemóvel com capa (ranhura)","widget":"slider"},"max":22,"min":6,"type":"number","unit":"mm","order":7,"default":12},"profundidade_ranhura":{"ui":{"step":1,"label":"Profundidade da ranhura","widget":"slider"},"max":40,"min":8,"type":"number","unit":"mm","order":8,"default":18},"largura_ficha":{"ui":{"step":0.5,"label":"Largura do furo da ficha","widget":"slider"},"max":20,"min":8,"type":"number","unit":"mm","order":10,"default":13},"espessura_ficha":{"ui":{"step":0.5,"label":"Espessura do furo da ficha","widget":"slider"},"max":12,"min":4,"type":"number","unit":"mm","order":11,"default":8},"diametro_cabo":{"ui":{"step":0.5,"label":"Largura do canal do cabo","widget":"slider"},"max":10,"min":3,"type":"number","unit":"mm","order":12,"default":5},"conteudo_frente":{"ui":{"label":"Frente","widget":"select","options":["Nada","Texto","Imagem"]},"order":40,"default":"Texto"},"texto_frente":{"ui":{"label":"Texto (frente)","widget":"text","visible_when":{"conteudo_frente":{"eq":"Texto"}}},"order":41,"default":"pp3d"},"tamanho_texto_frente":{"ui":{"step":0.5,"label":"Tamanho das letras (frente)","widget":"slider","visible_when":{"conteudo_frente":{"eq":"Texto"}}},"max":40,"min":4,"type":"number","unit":"mm","order":42,"default":14},"imagem_frente":{"ui":{"label":"Imagem (frente) — PNG, JPG ou SVG","accept":"image/png,image/jpeg,image/webp,image/svg+xml","widget":"image_upload","visible_when":{"conteudo_frente":{"eq":"Imagem"}}},"order":43,"default":""},"largura_imagem_frente":{"ui":{"step":1,"label":"Largura da imagem (frente)","widget":"slider","visible_when":{"conteudo_frente":{"eq":"Imagem"}}},"max":130,"min":5,"type":"number","unit":"mm","order":44,"default":40},"cor_frente":{"ui":{"label":"Cor do texto/imagem (frente)","paleta":[{"hex":"#FFFFFF","nome":"Branco"},{"hex":"#111111","nome":"Preto"},{"hex":"#9CA3AF","nome":"Cinzento"},{"hex":"#DC2626","nome":"Vermelho"},{"hex":"#F97316","nome":"Laranja"},{"hex":"#FACC15","nome":"Amarelo"},{"hex":"#16A34A","nome":"Verde"},{"hex":"#38BDF8","nome":"Azul claro"},{"hex":"#1E3A8A","nome":"Azul"},{"hex":"#7C3AED","nome":"Roxo"},{"hex":"#F472B6","nome":"Rosa"}],"widget":"color","visible_when":{"conteudo_frente":{"ne":"Nada"}}},"order":46,"default":"#FFFFFF"},"conteudo_inclinada":{"ui":{"label":"Face inclinada","widget":"select","options":["Nada","Texto","Imagem"]},"order":50,"default":"Nada"},"texto_inclinada":{"ui":{"label":"Texto (face inclinada)","widget":"text","visible_when":{"conteudo_inclinada":{"eq":"Texto"}}},"order":51,"default":""},"tamanho_texto_inclinada":{"ui":{"step":0.5,"label":"Tamanho das letras (face inclinada)","widget":"slider","visible_when":{"conteudo_inclinada":{"eq":"Texto"}}},"max":40,"min":4,"type":"number","unit":"mm","order":52,"default":10},"imagem_inclinada":{"ui":{"label":"Imagem (face inclinada) — PNG, JPG ou SVG","accept":"image/png,image/jpeg,image/webp,image/svg+xml","widget":"image_upload","visible_when":{"conteudo_inclinada":{"eq":"Imagem"}}},"order":53,"default":""},"largura_imagem_inclinada":{"ui":{"step":1,"label":"Largura da imagem (face inclinada)","widget":"slider","visible_when":{"conteudo_inclinada":{"eq":"Imagem"}}},"max":130,"min":5,"type":"number","unit":"mm","order":54,"default":40},"cor_inclinada":{"ui":{"label":"Cor do texto/imagem (face inclinada)","paleta":[{"hex":"#FFFFFF","nome":"Branco"},{"hex":"#111111","nome":"Preto"},{"hex":"#9CA3AF","nome":"Cinzento"},{"hex":"#DC2626","nome":"Vermelho"},{"hex":"#F97316","nome":"Laranja"},{"hex":"#FACC15","nome":"Amarelo"},{"hex":"#16A34A","nome":"Verde"},{"hex":"#38BDF8","nome":"Azul claro"},{"hex":"#1E3A8A","nome":"Azul"},{"hex":"#7C3AED","nome":"Roxo"},{"hex":"#F472B6","nome":"Rosa"}],"widget":"color","visible_when":{"conteudo_inclinada":{"ne":"Nada"}}},"order":56,"default":"#FFFFFF"},"impressao":{"ui":{"label":"Impressora","widget":"select","options":["AMS (3MF multicor)","Sem AMS (STL, peças para colar)"]},"order":37,"default":"AMS (3MF multicor)"},"fonte":{"ui":{"label":"Tipo de letra","widget":"select","options":["Open Sans","Aladin","Amarante","Anton","Baloo 2","Benne","Chewy","Gloria Hallelujah","Lobster","Luckiest Guy","Oswald","Pacifico","Press Start 2P","Racing Sans One","Sigmar One"]},"order":38,"default":"Open Sans"},"cor_suporte":{"ui":{"label":"Cor do suporte","paleta":[{"hex":"#FFFFFF","nome":"Branco"},{"hex":"#111111","nome":"Preto"},{"hex":"#9CA3AF","nome":"Cinzento"},{"hex":"#DC2626","nome":"Vermelho"},{"hex":"#F97316","nome":"Laranja"},{"hex":"#FACC15","nome":"Amarelo"},{"hex":"#16A34A","nome":"Verde"},{"hex":"#38BDF8","nome":"Azul claro"},{"hex":"#1E3A8A","nome":"Azul"},{"hex":"#7C3AED","nome":"Roxo"},{"hex":"#F472B6","nome":"Rosa"}],"widget":"color"},"order":36,"default":"#111111"},"profundidade_embutido":{"ui":{"step":0.1,"label":"Profundidade do texto/imagem embutido","widget":"slider"},"max":2,"min":0.4,"type":"number","unit":"mm","order":60,"default":1},"folga_embutido":{"ui":{"step":0.05,"label":"Folga das peças a colar (sem AMS)","widget":"slider","visible_when":{"impressao":{"eq":"Sem AMS (STL, peças para colar)"}}},"max":0.5,"min":0,"type":"number","unit":"mm","order":61,"default":0.15},"info_suporte":{"ui":{"text":"🔌 Dock para carregar o telemóvel de pé. Mede a espessura do telemóvel com a capa e a ficha do teu cabo (a parte de plástico) e ajusta o furo para ficar justo. A ficha entra por baixo, pelo furo no fundo da ranhura, e o cabo encaixa no canal por baixo e sai por trás. A ranhura é aberta dos lados, por isso serve a qualquer largura de telemóvel. O texto/imagem fica embutido à face na frente e/ou na face inclinada à frente do telemóvel. Com AMS recebes um 3MF com uma peça por cor, já montadas; sem AMS recebes STL com o dock em rebaixo e as peças para colar. Imprime deitado de lado (sai já assim, sem suportes); 15–20 % de enchimento chega e dá peso.","widget":"info"},"order":99,"default":null}}}$json$::jsonb
FROM prod_designs WHERE id = 'suporte_telemovel_personalizado'
ON CONFLICT (id) DO UPDATE SET scad_template = EXCLUDED.scad_template, generation_schema = EXCLUDED.generation_schema,
  nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, tags = EXCLUDED.tags;

-- suporte_telemovel_dobravel_personalizado (template md5 40f950dc47e99265232b119f14f01b5d)
INSERT INTO prod_designs (id, nome, descricao, familia, tags, licenca, estado, acesso_maker, requer_licenca_comercial,
  disponivel_consumidor, gratuito, preco_creditos, credit_price, pvp, preco_base, usa_modo, parametros_default,
  scad_template, generation_schema)
SELECT 'suporte_telemovel_dobravel_personalizado', 'Suporte de telemóvel desmontável (de bolso) — personalizado', 'Quatro placas planas que encaixam sem cola (duas laterais e duas travessas) e desmontam para levar no bolso. Texto ou imagem embutidos à face na travessa da frente e/ou nas laterais, noutra cor. 3MF multicor (AMS) ou peças para colar.', familia,
  ARRAY['suporte', 'telemóvel', 'desmontável', 'dobrável', 'portátil', 'bolso', 'personalizado', 'texto', 'imagem', '3mf', 'multicor']::text[], licenca, 'rascunho', acesso_maker, requer_licenca_comercial,
  disponivel_consumidor, gratuito, preco_creditos, credit_price, pvp, preco_base, usa_modo, '{}'::jsonb,
  $scad$// ── SUPORTE DE TELEMÓVEL DESMONTÁVEL (DE BOLSO) — PERSONALIZADO (texto/imagem à face, 3MF) ──
//
// Quatro placas planas que encaixam umas nas outras (meia-madeira, sem cola nem parafusos): duas
// laterais com o perfil do suporte (base, lábio, ranhura para o telemóvel e encosto inclinado) e
// duas travessas — a da frente faz de lábio e a de trás fecha a base. Desmonta-se e fica plano,
// para levar no bolso ou na mala. Tudo imprime deitado, sem suportes.
//
// A geometria está escrita montada (x para trás a partir da frente, y para cima, z na largura:
// lateral esquerda em z = 0..t, direita em z = W - t..W) e cada peça é depois deitada na mesa
// (_P(peca)) com a face de fora para cima.
//
// Texto ou imagem embutidos À FACE, noutra cor, na frente da travessa da frente (zona "frente")
// e/ou na face de fora das duas laterais (zona "lados" — o mesmo nas duas). Sai em 3MF
// (generation_schema.multicor):
//   "corpo"  as 4 peças com os rebaixos     "frente" / "lados"  enchimento de cada zona
//   "frente_solta" / "lados_solta"  sem AMS: o enchimento deitado na mesa, com folga, para colar
// (sem modo: tudo, com cores — só para ver no OpenSCAD; montado = true mostra-o montado).
// Do servidor: esc_texto_frente (lib/textFit.js; o texto dos lados não é ajustado, só recortado)
//   e frente_pts / frente_paths / tem_frente, lados_pts / lados_paths / tem_lados (lib/logo.js).
// Se mudares as fórmulas, muda também Maker_Pro_Frontend_Prod/lib/suportesTelemovelExtra.ts.

function _W()  = is_undef(largura) ? 80 : largura;
function _t()  = is_undef(espessura) ? 4 : espessura;
function _a()  = is_undef(angulo) ? 20 : angulo;
function _Le() = is_undef(altura_encosto) ? 90 : altura_encosto;
function _g()  = is_undef(espessura_telemovel) ? 12 : espessura_telemovel;
function _hb() = is_undef(altura_travessa) ? 18 : altura_travessa;
function _f()  = is_undef(folga_encaixe) ? 0.25 : folga_encaixe;
OV  = 6;                                                             // travessas: saem 6 mm para fora das laterais
XB0 = 4;                                                             // travessa da frente: a 4 mm da frente
WE  = 12;                                                            // largura do encosto (na lateral)

function _xg0() = 2 * XB0 + _t();                                    // frente da ranhura do telemóvel
function _xg1() = _xg0() + _g();                                     // pé do encosto
function _yf()  = min(6, _hb() - 4);                                 // fundo da ranhura
function _T()   = [_xg1(), _yf()] + _Le() * [sin(_a()), cos(_a())];  // topo do encosto (frente)
function _Tb()  = _T() + WE * [cos(_a()), -sin(_a())];               // topo do encosto (trás)
function _Lb()  = max(_Tb()[0] + 4, _xg1() + 30);                    // comprimento da base
function _xr()  = _Lb() - XB0 - _t();                                // travessa de trás

function _lat_pts() = [[0, 0], [_Lb(), 0], [_Lb(), _hb()], _Tb(), _T(), [_xg1(), _yf()], [_xg0(), _yf()], [_xg0(), _hb()], [0, _hb()]];
module rasgos_lateral() {                                            // de baixo até meia altura da travessa
    for (x = [XB0, _xr()]) translate([x - _f() / 2, -1]) square([_t() + _f(), _hb() / 2 + _f() / 2 + 1]);
}
module perfil_lateral() { difference() { polygon(_lat_pts()); rasgos_lateral(); } }
module perfil_travessa() {                                           // em (z, y); de cima até meia altura
    W = _W(); t = _t(); f = _f();
    difference() {
        translate([-OV, 0]) square([W + 2 * OV, _hb()]);
        for (z0 = [0, W - t]) translate([z0 - f / 2, _hb() / 2 - f / 2]) square([t + f, _hb()]);
    }
}

// peças montadas
module lateral(lado) { translate([0, 0, lado == "esq" ? 0 : _W() - _t()]) linear_extrude(height = _t()) perfil_lateral(); }
module travessa(x0) { translate([x0, 0, 0]) multmatrix([[0, 0, 1, 0], [0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 1]]) linear_extrude(height = _t()) perfil_travessa(); }
// (a matriz troca x com z: o perfil (z, y) fica no plano zy e a espessura vai em x)

// montado → deitado na mesa, face de fora para cima (rotações próprias)
function _P(peca) =
    peca == "lat_esq" ? [[-1, 0, 0, 2 * _Lb() + 8], [0, 1, 0, 0], [0, 0, -1, _t()], [0, 0, 0, 1]]
  : peca == "lat_dir" ? [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, -(_W() - _t())], [0, 0, 0, 1]]
  : peca == "trav_f"  ? [[0, 0, 1, OV], [0, 1, 0, -(_hb() + 8)], [-1, 0, 0, XB0 + _t()], [0, 0, 0, 1]]
  :                     [[0, 0, 1, OV], [0, 1, 0, -2 * (_hb() + 8)], [-1, 0, 0, _xr() + _t()], [0, 0, 0, 1]];
function _montado() = !is_undef(montado) && montado == true;
module colocar(peca) { if (_montado()) children(); else multmatrix(_P(peca)) children(); }

// ══ personalização: texto/imagem à face ══
MARG = 4;                                                            // margem às arestas (mm)
MV = 1;                                                              // margem em altura (travessa)
MF = 9;                                                              // travessa: o texto fica entre as laterais
function _modo()  = is_undef(modo) ? "tudo" : modo;
function _fonte() = is_undef(fonte) ? "Open Sans" : fonte;
function _dp()    = max(0.4, min(is_undef(profundidade_embutido) ? 1 : profundidade_embutido, _t() - 1.5));
function _conteudo(z) = z == "frente" ? (is_undef(conteudo_frente) ? "Texto" : conteudo_frente)
                                      : (is_undef(conteudo_lados) ? "Nada" : conteudo_lados);
function _texto(z) = z == "frente" ? (is_undef(texto_frente) ? "pp3d" : texto_frente) : (is_undef(texto_lados) ? "" : texto_lados);
function _tam(z)   = z == "frente" ? (is_undef(tamanho_texto_frente) ? 10 : tamanho_texto_frente) : (is_undef(tamanho_texto_lados) ? 7 : tamanho_texto_lados);
function _esc(z)   = z == "frente" ? max(0.05, min(1, is_undef(esc_texto_frente) ? 1 : esc_texto_frente)) : 1;
function _tem_img(z) = z == "frente" ? (!is_undef(tem_frente) && tem_frente == true && !is_undef(frente_pts) && len(frente_pts) >= 3)
                                     : (!is_undef(tem_lados) && tem_lados == true && !is_undef(lados_pts) && len(lados_pts) >= 3);
function _ativa(z) = _conteudo(z) == "Texto" ? len(_texto(z)) > 0 : _conteudo(z) == "Imagem" ? _tem_img(z) : false;

// centro do texto nas laterais: a 35 % da altura do encosto, a meio entre o encosto e a parte de trás
function _Cy() = _yf() + 0.35 * (_T()[1] - _yf());
function _Cx() = let(xa = _xg1() + (_Cy() - _yf()) * tan(_a()),
                     xb = _Cy() <= _hb() ? _Lb() : _Lb() - (_Cy() - _hb()) * (_Lb() - _Tb()[0]) / (_Tb()[1] - _hb()))
                 (xa + xb) / 2;
// colocações de cada zona: [matriz face → peça montada, peça, lado (para a região)]
function _col(z) = z == "frente"
    ? [[[[0, 0, -1, XB0], [0, 1, 0, _hb() / 2], [1, 0, 0, _W() / 2], [0, 0, 0, 1]], "trav_f", "frente"]]
    : [[[[-1, 0, 0, _Cx()], [0, 1, 0, _Cy()], [0, 0, -1, 0], [0, 0, 0, 1]], "lat_esq", "esq"],
       [[[1, 0, 0, _Cx()], [0, 1, 0, _Cy()], [0, 0, 1, _W()], [0, 0, 0, 1]], "lat_dir", "dir"]];

module zona(lado) {                                                  // região útil no plano da face (u, v)
    if (lado == "frente") translate([-(_W() / 2 - MF), -(_hb() / 2 - MV)]) square([_W() - 2 * MF, _hb() - 2 * MV]);
    else mirror([lado == "esq" ? 1 : 0, 0]) translate([-_Cx(), -_Cy()]) offset(r = -MARG, $fn = 24) perfil_lateral();
}
module conteudo2d(z, lado) {
    intersection() {
        zona(lado);
        if (_conteudo(z) == "Texto")
            scale(_esc(z)) offset(delta = 0.01)
                text(_texto(z), size = _tam(z), font = _fonte(), halign = "center", valign = "center", $fn = 16);
        else if (_conteudo(z) == "Imagem" && _tem_img(z)) {
            if (z == "frente") polygon(points = frente_pts, paths = frente_paths);
            else polygon(points = lados_pts, paths = lados_paths);
        }
    }
}
module na_face(z, w0, w1, so_peca = "") {
    for (c = _col(z)) if (so_peca == "" || so_peca == c[1])
        colocar(c[1]) multmatrix(c[0]) translate([0, 0, w0]) linear_extrude(height = w1 - w0) conteudo2d(z, c[2]);
}
module enchimento(z) { if (_ativa(z)) na_face(z, -_dp(), 0); }

function _fe() = max(0, min(0.5, is_undef(folga_embutido) ? 0.15 : folga_embutido));
module solta(z) {
    if (_ativa(z)) for (i = [0 : len(_col(z)) - 1])
        translate([i * (_W() + 10), 0]) linear_extrude(height = _dp()) offset(delta = -_fe()) conteudo2d(z, _col(z)[i][2]);
}

module peca(nome) {
    colocar(nome) if (nome == "lat_esq") lateral("esq");
                  else if (nome == "lat_dir") lateral("dir");
                  else if (nome == "trav_f") travessa(XB0);
                  else travessa(_xr());
}
module corpo() {
    for (p = ["lat_esq", "lat_dir", "trav_f", "trav_t"])
        difference() {
            peca(p);
            for (z = ["frente", "lados"]) if (_ativa(z)) na_face(z, -_dp(), 0.5, p);
        }
}

if (_modo() == "corpo") corpo();
else if (_modo() == "frente") enchimento("frente");
else if (_modo() == "lados") enchimento("lados");
else if (_modo() == "frente_solta") solta("frente");
else if (_modo() == "lados_solta") solta("lados");
else {
    color(is_undef(cor_suporte) ? "#111111" : cor_suporte) corpo();
    color(is_undef(cor_frente) ? "#FFFFFF" : cor_frente) enchimento("frente");
    color(is_undef(cor_lados) ? "#FFFFFF" : cor_lados) enchimento("lados");
}
$scad$,
  $json${"engine":"openscad","version":1,"preview_por_partes":true,"logo":[{"param":"imagem_frente","prefixo":"frente","so_quando":{"conteudo_frente":"Imagem"},"max_pontos":4000,"largura_param":"largura_imagem_frente","simplificar_mm":0.1},{"param":"imagem_lados","prefixo":"lados","so_quando":{"conteudo_lados":"Imagem"},"max_pontos":4000,"largura_param":"largura_imagem_lados","simplificar_mm":0.1}],"multicor":{"partes":[{"modo":"corpo","nome":"Peças","cor_param":"cor_suporte"},{"modo":"frente","nome":"Travessa da frente (texto/imagem)","cor_param":"cor_frente"},{"modo":"lados","nome":"Laterais (texto/imagem)","cor_param":"cor_lados"}],"param_impressao":"impressao","sem_ams_ficheiros":[{"nome":"suporte.stl","params":{"modo":"corpo"}},{"nome":"frente_peca_para_colar.stl","params":{"modo":"frente_solta"}},{"nome":"lados_peca_para_colar.stl","params":{"modo":"lados_solta"}}],"texto_sem_ams":["Impressão sem AMS (uma cor de cada vez):","  1. suporte.stl — as 4 placas (deitadas, como saem), com o texto/imagem em baixo-relevo (rebaixo).","     Se quiseres só uma cor, fica assim: o texto/imagem lê-se pelo rebaixo.","  2. *_peca_para_colar.stl — o texto/imagem para encher o rebaixo, já deitados na mesa e um pouco","     mais pequenos (folga). Imprime noutra cor e cola com cola de contacto ou CA.","","Dica: com AMS escolhe \"AMS (3MF multicor)\" e recebes um 3MF com tudo já montado e uma peça por cor."]},"ajuste_texto":{"campos":["texto_frente"],"largura_util":62,"largura_util_param":"largura","largura_util_margem":18,"tamanho_param_por_campo":{"texto_frente":"tamanho_texto_frente"}},"parameters":{"suporte":{"ui":{"widget":"hidden"},"order":0,"default":"dobravel_personalizado"},"largura":{"ui":{"step":1,"label":"Largura (entre as laterais, por fora)","widget":"slider"},"max":140,"min":50,"type":"number","unit":"mm","order":2,"default":80},"angulo":{"ui":{"step":1,"label":"Inclinação do encosto (0° = vertical)","widget":"slider"},"max":40,"min":5,"type":"number","unit":"°","order":3,"default":20},"altura_encosto":{"ui":{"step":1,"label":"Comprimento do encosto","widget":"slider"},"max":150,"min":50,"type":"number","unit":"mm","order":4,"default":90},"espessura_telemovel":{"ui":{"step":0.5,"label":"Espessura do telemóvel com capa (ranhura)","widget":"slider"},"max":22,"min":6,"type":"number","unit":"mm","order":5,"default":12},"altura_travessa":{"ui":{"step":1,"label":"Altura das travessas","widget":"slider"},"max":30,"min":12,"type":"number","unit":"mm","order":6,"default":18},"espessura":{"ui":{"step":0.5,"label":"Espessura das placas","widget":"slider"},"max":6,"min":3,"type":"number","unit":"mm","order":7,"default":4},"folga_encaixe":{"ui":{"step":0.05,"label":"Folga dos encaixes (aumenta se ficar apertado)","widget":"slider"},"max":0.6,"min":0,"type":"number","unit":"mm","order":8,"default":0.25},"conteudo_frente":{"ui":{"label":"Travessa da frente","widget":"select","options":["Nada","Texto","Imagem"]},"order":40,"default":"Texto"},"texto_frente":{"ui":{"label":"Texto (travessa da frente)","widget":"text","visible_when":{"conteudo_frente":{"eq":"Texto"}}},"order":41,"default":"pp3d"},"tamanho_texto_frente":{"ui":{"step":0.5,"label":"Tamanho das letras (travessa da frente)","widget":"slider","visible_when":{"conteudo_frente":{"eq":"Texto"}}},"max":40,"min":4,"type":"number","unit":"mm","order":42,"default":10},"imagem_frente":{"ui":{"label":"Imagem (travessa da frente) — PNG, JPG ou SVG","accept":"image/png,image/jpeg,image/webp,image/svg+xml","widget":"image_upload","visible_when":{"conteudo_frente":{"eq":"Imagem"}}},"order":43,"default":""},"largura_imagem_frente":{"ui":{"step":1,"label":"Largura da imagem (travessa da frente)","widget":"slider","visible_when":{"conteudo_frente":{"eq":"Imagem"}}},"max":130,"min":5,"type":"number","unit":"mm","order":44,"default":40},"cor_frente":{"ui":{"label":"Cor do texto/imagem (travessa da frente)","paleta":[{"hex":"#FFFFFF","nome":"Branco"},{"hex":"#111111","nome":"Preto"},{"hex":"#9CA3AF","nome":"Cinzento"},{"hex":"#DC2626","nome":"Vermelho"},{"hex":"#F97316","nome":"Laranja"},{"hex":"#FACC15","nome":"Amarelo"},{"hex":"#16A34A","nome":"Verde"},{"hex":"#38BDF8","nome":"Azul claro"},{"hex":"#1E3A8A","nome":"Azul"},{"hex":"#7C3AED","nome":"Roxo"},{"hex":"#F472B6","nome":"Rosa"}],"widget":"color","visible_when":{"conteudo_frente":{"ne":"Nada"}}},"order":46,"default":"#FFFFFF"},"conteudo_lados":{"ui":{"label":"Laterais","widget":"select","options":["Nada","Texto","Imagem"]},"order":50,"default":"Nada"},"texto_lados":{"ui":{"label":"Texto (laterais)","widget":"text","visible_when":{"conteudo_lados":{"eq":"Texto"}}},"order":51,"default":""},"tamanho_texto_lados":{"ui":{"step":0.5,"label":"Tamanho das letras (laterais)","widget":"slider","visible_when":{"conteudo_lados":{"eq":"Texto"}}},"max":25,"min":4,"type":"number","unit":"mm","order":52,"default":7},"imagem_lados":{"ui":{"label":"Imagem (laterais) — PNG, JPG ou SVG","accept":"image/png,image/jpeg,image/webp,image/svg+xml","widget":"image_upload","visible_when":{"conteudo_lados":{"eq":"Imagem"}}},"order":53,"default":""},"largura_imagem_lados":{"ui":{"step":1,"label":"Largura da imagem (laterais)","widget":"slider","visible_when":{"conteudo_lados":{"eq":"Imagem"}}},"max":130,"min":5,"type":"number","unit":"mm","order":54,"default":25},"cor_lados":{"ui":{"label":"Cor do texto/imagem (laterais)","paleta":[{"hex":"#FFFFFF","nome":"Branco"},{"hex":"#111111","nome":"Preto"},{"hex":"#9CA3AF","nome":"Cinzento"},{"hex":"#DC2626","nome":"Vermelho"},{"hex":"#F97316","nome":"Laranja"},{"hex":"#FACC15","nome":"Amarelo"},{"hex":"#16A34A","nome":"Verde"},{"hex":"#38BDF8","nome":"Azul claro"},{"hex":"#1E3A8A","nome":"Azul"},{"hex":"#7C3AED","nome":"Roxo"},{"hex":"#F472B6","nome":"Rosa"}],"widget":"color","visible_when":{"conteudo_lados":{"ne":"Nada"}}},"order":56,"default":"#FFFFFF"},"impressao":{"ui":{"label":"Impressora","widget":"select","options":["AMS (3MF multicor)","Sem AMS (STL, peças para colar)"]},"order":37,"default":"AMS (3MF multicor)"},"fonte":{"ui":{"label":"Tipo de letra","widget":"select","options":["Open Sans","Aladin","Amarante","Anton","Baloo 2","Benne","Chewy","Gloria Hallelujah","Lobster","Luckiest Guy","Oswald","Pacifico","Press Start 2P","Racing Sans One","Sigmar One"]},"order":38,"default":"Open Sans"},"cor_suporte":{"ui":{"label":"Cor do suporte","paleta":[{"hex":"#FFFFFF","nome":"Branco"},{"hex":"#111111","nome":"Preto"},{"hex":"#9CA3AF","nome":"Cinzento"},{"hex":"#DC2626","nome":"Vermelho"},{"hex":"#F97316","nome":"Laranja"},{"hex":"#FACC15","nome":"Amarelo"},{"hex":"#16A34A","nome":"Verde"},{"hex":"#38BDF8","nome":"Azul claro"},{"hex":"#1E3A8A","nome":"Azul"},{"hex":"#7C3AED","nome":"Roxo"},{"hex":"#F472B6","nome":"Rosa"}],"widget":"color"},"order":36,"default":"#111111"},"profundidade_embutido":{"ui":{"step":0.1,"label":"Profundidade do texto/imagem embutido","widget":"slider"},"max":2,"min":0.4,"type":"number","unit":"mm","order":60,"default":1},"folga_embutido":{"ui":{"step":0.05,"label":"Folga das peças a colar (sem AMS)","widget":"slider","visible_when":{"impressao":{"eq":"Sem AMS (STL, peças para colar)"}}},"max":0.5,"min":0,"type":"number","unit":"mm","order":61,"default":0.15},"info_suporte":{"ui":{"text":"🎒 Suporte desmontável: quatro placas que encaixam umas nas outras a meia-madeira (sem cola nem parafusos) — as duas laterais com o perfil do suporte e as duas travessas, a da frente faz de lábio. Desmonta-se e fica plano para levar no bolso. Para montar: pousa as duas travessas na mesa com os rasgos para cima e encaixa as laterais de cima para baixo. Se ficar apertado, aumenta a folga. O texto/imagem fica embutido à face na frente da travessa da frente e/ou na face de fora das duas laterais (o mesmo nas duas; nas laterais o texto não encolhe sozinho — ajusta o tamanho na pré-visualização). Com AMS recebes um 3MF com as 4 peças deitadas e uma peça por cor; sem AMS recebes STL com as peças em rebaixo e as peças para colar. Tudo imprime deitado, sem suportes.","widget":"info"},"order":99,"default":null}}}$json$::jsonb
FROM prod_designs WHERE id = 'suporte_telemovel_personalizado'
ON CONFLICT (id) DO UPDATE SET scad_template = EXCLUDED.scad_template, generation_schema = EXCLUDED.generation_schema,
  nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, tags = EXCLUDED.tags;
