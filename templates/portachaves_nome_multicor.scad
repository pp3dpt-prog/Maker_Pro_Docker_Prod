// ═══════════════════════════════════════════════════════════════
//  Porta-chaves com Nome Multicor  (até 3 cores)
//
//  Argola só na base (cor 1), à esquerda, encostada à primeira letra.
//  Os outros patamares ficam sobre a base sem argola própria.
//
//  1 cor  → letras + argola
//  2 cores → base = letras + offset1 + argola  |  topo = letras
//  3 cores → base + argola  |  meio  |  topo = letras
// ═══════════════════════════════════════════════════════════════

nome        = is_undef(nome)        ? "Nome"        : nome;
fonte       = is_undef(fonte)       ? "Sacramento"  : fonte;
tamanho     = is_undef(tamanho)     ? 20            : tamanho;
num_cores   = is_undef(num_cores)   ? 3             : num_cores;
altura      = is_undef(altura)      ? 2.0           : altura;
offset_cor1 = is_undef(offset_cor1) ? 4             : offset_cor1;
offset_cor2 = is_undef(offset_cor2) ? 2             : offset_cor2;

// ── Argola ─────────────────────────────────────────────────────
furo_r  = 2.5;   // raio do furo → diâmetro 5 mm (argola padrão)
parede  = 2.0;   // espessura da parede à volta do furo
lobe_r  = furo_r + parede;   // raio do disco da argola = 4.5 mm

// O texto começa aqui (furo + parede + 1 mm de folga)
text_inicio_x = lobe_r + 1.0;

// Posição vertical da argola: centro visual das letras maiúsculas
furo_y = tamanho * 0.15;

total_h = num_cores * altura;

// ── Módulos ────────────────────────────────────────────────────

module texto_2d() {
  translate([text_inicio_x, 0])
  text(nome,
       font    = str(fonte, ":style=Regular"),
       size    = tamanho,
       halign  = "left",
       valign  = "center");
}

// Expande as letras r mm — mantém a forma das letras visível
module cloud_2d(r, fn_val) {
  minkowski() {
    texto_2d();
    circle(r = r, $fn = fn_val);
  }
}

// Ponte suave (hull de dois círculos) entre a argola e o início do texto
// Só usada na camada base (cor 1)
module ponte_base_2d(r_extra) {
  ponte_lobe_r = lobe_r + r_extra;
  hull() {
    translate([0,             furo_y]) circle(r = ponte_lobe_r, $fn = 32);
    translate([text_inicio_x, furo_y]) circle(r = ponte_lobe_r, $fn = 32);
  }
}

// Camada BASE: cloud + ponte (inclui a argola)
module camada_base_2d(r, fn_val) {
  union() {
    ponte_base_2d(r);
    if (r > 0.05) cloud_2d(r, fn_val);
    else          texto_2d();
  }
}

// Camadas superiores: só as letras/cloud, sem argola
module camada_topo_2d(r, fn_val) {
  if (r > 0.05) cloud_2d(r, fn_val);
  else          texto_2d();
}

// ── Geometria ──────────────────────────────────────────────────

difference() {
  union() {

    if (num_cores == 1) {
      linear_extrude(altura)
        camada_base_2d(0, 0);

    } else if (num_cores == 2) {
      // Base com argola
      linear_extrude(altura)
        camada_base_2d(offset_cor1, 8);
      // Topo: só as letras, sem argola
      translate([0, 0, altura])
        linear_extrude(altura)
          camada_topo_2d(0, 0);

    } else {
      // Base com argola
      linear_extrude(altura)
        camada_base_2d(offset_cor1, 6);
      // Meio: cloud intermédio, sem argola
      translate([0, 0, altura])
        linear_extrude(altura)
          camada_topo_2d(offset_cor2, 14);
      // Topo: letras puras, sem argola
      translate([0, 0, altura * 2])
        linear_extrude(altura)
          camada_topo_2d(0, 0);
    }

  }

  // Furo da argola — só atravessa a camada base
  translate([0, furo_y, -1])
    cylinder(h = total_h + 2, r = furo_r, $fn = 32);
}
