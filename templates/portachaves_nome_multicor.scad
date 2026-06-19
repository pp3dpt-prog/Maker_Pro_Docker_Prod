// ═══════════════════════════════════════════════════════════════
//  Porta-chaves com Nome Multicor  (até 3 cores)
//
//  Estrutura:
//   1 cor  → só as letras
//   2 cores → base = letras + N mm de contorno  |  topo = letras
//   3 cores → base = letras + N mm  |  meio = letras + M mm  |  topo = letras
//
//  O furo da argola fica no topo do bloco de letras.
// ═══════════════════════════════════════════════════════════════

nome        = is_undef(nome)        ? "Nome"        : nome;
fonte       = is_undef(fonte)       ? "Sacramento"  : fonte;
tamanho     = is_undef(tamanho)     ? 20            : tamanho;
num_cores   = is_undef(num_cores)   ? 3             : num_cores;

// Altura igual para todos os níveis
altura      = is_undef(altura)      ? 2.0           : altura;

// Quanto cada nível sobressai para fora das letras (mm)
// — mantém a forma das letras, só expande o contorno
offset_cor1 = is_undef(offset_cor1) ? 4             : offset_cor1;
offset_cor2 = is_undef(offset_cor2) ? 2             : offset_cor2;

// ── Furo da argola ─────────────────────────────────────────────
furo_r  = 1.5;

// Posição Y do furo: dentro do bloco de letras, encostado ao topo
// (topo do cloud = meia-altura estimada do texto + expansão do nível base)
furo_y  = tamanho * 0.6 + offset_cor1 - furo_r - 2.0;

total_h = num_cores * altura;

// ── Módulos ────────────────────────────────────────────────────

module texto_2d() {
  text(nome,
       font    = str(fonte, ":style=Regular"),
       size    = tamanho,
       halign  = "center",
       valign  = "center");
}

// Expande as letras r mm — a forma das letras mantém-se visível
module cloud_2d(r, fn_val) {
  minkowski() {
    texto_2d();
    circle(r = r, $fn = fn_val);
  }
}

// ── Geometria ──────────────────────────────────────────────────

difference() {
  union() {

    if (num_cores == 1) {
      // Só as letras
      linear_extrude(altura)
        texto_2d();

    } else if (num_cores == 2) {
      // Base: letras + offset_cor1 mm de contorno
      linear_extrude(altura)
        cloud_2d(offset_cor1, 8);
      // Topo: letras (cor 2 visível nas letras; cor 1 visível no contorno)
      translate([0, 0, altura])
        linear_extrude(altura)
          texto_2d();

    } else {
      // Base: letras + offset_cor1 mm
      linear_extrude(altura)
        cloud_2d(offset_cor1, 6);
      // Meio: letras + offset_cor2 mm (anel de cor 1 visível à volta)
      translate([0, 0, altura])
        linear_extrude(altura)
          cloud_2d(offset_cor2, 14);
      // Topo: letras (anel de cor 2 visível à volta)
      translate([0, 0, altura * 2])
        linear_extrude(altura)
          texto_2d();
    }

  }

  // Furo da argola — no topo do bloco de letras, centrado
  translate([0, furo_y, -1])
    cylinder(h = total_h + 2, r = furo_r, $fn = 24);
}
