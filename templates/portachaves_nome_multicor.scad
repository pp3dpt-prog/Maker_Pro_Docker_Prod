// ═══════════════════════════════════════════════════════════════
//  Porta-chaves com Nome Multicor  (até 3 cores)
//
//  Argola à esquerda, encostada à primeira letra.
//  Cada nível expande o contorno das letras N mm para fora.
//
//  1 cor  → letras + argola
//  2 cores → base = letras + offset1  |  topo = letras
//  3 cores → base = letras + offset1  |  meio = letras + offset2  |  topo = letras
// ═══════════════════════════════════════════════════════════════

nome        = is_undef(nome)        ? "Nome"        : nome;
fonte       = is_undef(fonte)       ? "Sacramento"  : fonte;
tamanho     = is_undef(tamanho)     ? 20            : tamanho;
num_cores   = is_undef(num_cores)   ? 3             : num_cores;
altura      = is_undef(altura)      ? 2.0           : altura;
offset_cor1 = is_undef(offset_cor1) ? 4             : offset_cor1;
offset_cor2 = is_undef(offset_cor2) ? 2             : offset_cor2;

// ── Argola ─────────────────────────────────────────────────────
furo_r = 1.5;

// O texto começa aqui (à direita do centro do furo)
// Margem fixa = raio do furo + 3 mm de material
text_inicio_x = furo_r + 3.0;

// Posição vertical do furo: centro visual das letras maiúsculas
// (com valign="center" o bbox fica centrado; as maiúsculas ficam ~15% acima)
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

// Ponte suave entre o furo (à esquerda) e o início do texto
// Usa hull de dois círculos → forma de "pastilha" arredondada
module ponte_2d(r_extra) {
  lobe_r = furo_r + max(r_extra, 1.5);
  hull() {
    translate([0,             furo_y]) circle(r = lobe_r, $fn = 24);
    translate([text_inicio_x, furo_y]) circle(r = lobe_r, $fn = 24);
  }
}

// Nível completo = forma das letras (ou cloud) + ponte para a argola
module nivel_2d(r, fn_val) {
  union() {
    ponte_2d(r);
    if (r > 0.05) cloud_2d(r, fn_val);
    else          texto_2d();
  }
}

// ── Geometria ──────────────────────────────────────────────────

difference() {
  union() {

    if (num_cores == 1) {
      linear_extrude(altura)
        nivel_2d(0, 0);

    } else if (num_cores == 2) {
      linear_extrude(altura)
        nivel_2d(offset_cor1, 8);
      translate([0, 0, altura])
        linear_extrude(altura)
          nivel_2d(0, 0);

    } else {
      linear_extrude(altura)
        nivel_2d(offset_cor1, 6);
      translate([0, 0, altura])
        linear_extrude(altura)
          nivel_2d(offset_cor2, 14);
      translate([0, 0, altura * 2])
        linear_extrude(altura)
          nivel_2d(0, 0);
    }

  }

  // Furo da argola — ao nível do centro visual das letras, à esquerda
  translate([0, furo_y, -1])
    cylinder(h = total_h + 2, r = furo_r, $fn = 24);
}
