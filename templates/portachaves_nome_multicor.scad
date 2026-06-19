// ═══════════════════════════════════════════════════════════════
//  Porta-chaves com Nome Multicor  (até 3 cores / níveis)
//  Cada nível tem o seu próprio "raio de expansão" das letras.
// ═══════════════════════════════════════════════════════════════

nome        = is_undef(nome)        ? "Nome"        : nome;
fonte       = is_undef(fonte)       ? "Sacramento"  : fonte;
tamanho     = is_undef(tamanho)     ? 20            : tamanho;
num_cores   = is_undef(num_cores)   ? 3             : num_cores;

// Altura de cada nível (todos iguais — o utilizador escolhe)
altura      = is_undef(altura)      ? 2.0           : altura;

// Expansão lateral (mm para fora das letras) de cada nível de cor
// offset maior = patamar mais afastado das letras (mas mantém o contorno)
// offset menor = patamar mais colado às letras
// Cor final = letras puras (sem expansão)
offset_cor1 = is_undef(offset_cor1) ? 8             : offset_cor1;
offset_cor2 = is_undef(offset_cor2) ? 4             : offset_cor2;

// Suavidade do cloud por nível (fn baixo = borda mais angular; alto = mais suave)
fn_cor1 = 6;
fn_cor2 = 14;

// ── Argola ─────────────────────────────────────────────────────
furo_r = 1.5;
lug_r  = furo_r + 3.5;

// Topo estimado do cloud base (usa offset_cor1, o maior)
cloud_top_y = tamanho * 0.6 + offset_cor1;

// Centro do disco da aba, acima do cloud com 1 mm de folga
lug_y = cloud_top_y + lug_r + 1.0;

// Altura total = nº de níveis × altura por nível
total_h = num_cores * altura;

// ── Módulos ────────────────────────────────────────────────────

module texto_2d() {
  text(nome,
       font    = str(fonte, ":style=Regular"),
       size    = tamanho,
       halign  = "center",
       valign  = "center");
}

// Expande as letras r mm para fora — mantém o contorno das letras visível
module cloud_2d(r, fn_val) {
  if (r <= 0) {
    texto_2d();
  } else {
    minkowski() {
      texto_2d();
      circle(r = r, $fn = fn_val);
    }
  }
}

// Aba circular para a argola + pescoço a ligar ao cloud
module aba_2d() {
  neck_w = max(lug_r * 1.5, 5);
  union() {
    translate([0, lug_y]) circle(r = lug_r, $fn = 24);
    translate([-neck_w / 2, cloud_top_y - 1.0])
      square([neck_w, lug_y - cloud_top_y + 1.0]);
  }
}

// Nível base: cloud mais largo + aba (fica sempre na cor 1)
module corpo_base_2d() {
  union() {
    cloud_2d(offset_cor1, fn_cor1);
    aba_2d();
  }
}

// ── Geometria ──────────────────────────────────────────────────

difference() {
  union() {

    if (num_cores == 1) {
      linear_extrude(altura)
        corpo_base_2d();

    } else if (num_cores == 2) {
      // Cor 1: base larga com aba
      linear_extrude(altura)
        corpo_base_2d();
      // Cor 2: letras — contorno de cor 1 visível à volta
      translate([0, 0, altura])
        linear_extrude(altura)
          texto_2d();

    } else {
      // Cor 1: base larga com aba
      linear_extrude(altura)
        corpo_base_2d();
      // Cor 2: cloud intermédio — anel de cor 1 visível à volta
      translate([0, 0, altura])
        linear_extrude(altura)
          cloud_2d(offset_cor2, fn_cor2);
      // Cor 3: letras — anel de cor 2 visível à volta
      translate([0, 0, altura * 2])
        linear_extrude(altura)
          texto_2d();
    }

  }

  // Furo da argola no centro do disco da aba
  translate([0, lug_y, -1])
    cylinder(h = total_h + 2, r = furo_r, $fn = 24);
}
