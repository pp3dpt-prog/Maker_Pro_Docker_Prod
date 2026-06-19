// ═══════════════════════════════════════════════════════════════
//  Porta-chaves com Nome Multicor  (até 3 cores / níveis)
//  Gerado automaticamente — parâmetros injetados pelo backend
// ═══════════════════════════════════════════════════════════════

nome        = is_undef(nome)        ? "Nome"        : nome;
fonte       = is_undef(fonte)       ? "Sacramento"  : fonte;
tamanho     = is_undef(tamanho)     ? 20            : tamanho;
num_cores   = is_undef(num_cores)   ? 3             : num_cores;

esp_cor1    = is_undef(esp_cor1)    ? 2.0           : esp_cor1;
esp_cor2    = is_undef(esp_cor2)    ? 1.5           : esp_cor2;
esp_cor3    = is_undef(esp_cor3)    ? 2.0           : esp_cor3;

offset_cor1 = is_undef(offset_cor1) ? 8             : offset_cor1;
offset_cor2 = is_undef(offset_cor2) ? 4             : offset_cor2;

// ── Argola ────────────────────────────────────────────────────
furo_r = 1.5;
lug_r  = furo_r + 3.5;   // raio do disco da aba (material à volta do furo)

// Estimativa do topo do cloud: metade da bbox do texto + expansão minkowski.
// Usa 0.6 * tamanho como margem para fontes com ascendentes altos (Sacramento, etc.)
cloud_top_y = tamanho * 0.6 + offset_cor1;

// Centro do disco da aba — acima do cloud com folga de 1 mm
lug_y = cloud_top_y + lug_r + 1.0;

// Altura total
total_h = (num_cores >= 3) ? (esp_cor1 + esp_cor2 + esp_cor3)
        : (num_cores == 2) ? (esp_cor1 + esp_cor2)
        : esp_cor1;

// ── Módulos ───────────────────────────────────────────────────

module texto_2d() {
  text(nome,
       font    = str(fonte, ":style=Regular"),
       size    = tamanho,
       halign  = "center",
       valign  = "center");
}

// Expande o texto com "aura" arredondada → efeito cloud/bolha
// fn_val baixo (4-8) = bordas angulosas/scallop; alto (12-20) = bordas suaves
module cloud_2d(r, fn_val) {
  minkowski() {
    texto_2d();
    circle(r = r, $fn = fn_val);
  }
}

// Aba circular + pescoço que liga ao cloud (para a argola)
module aba_2d() {
  neck_w = max(lug_r * 1.5, 5);
  union() {
    // Disco da aba
    translate([0, lug_y]) circle(r = lug_r, $fn = 24);
    // Pescoço: rectângulo que faz a ponte entre o topo do cloud e o disco
    translate([-neck_w / 2, cloud_top_y - 1.0])
      square([neck_w, lug_y - cloud_top_y + 1.0]);
  }
}

// Corpo completo: cloud + aba
module corpo_2d(cloud_r, fn_val) {
  union() {
    cloud_2d(cloud_r, fn_val);
    aba_2d();
  }
}

// ── Geometria ─────────────────────────────────────────────────

difference() {
  union() {

    if (num_cores == 1) {
      linear_extrude(esp_cor1)
        corpo_2d(offset_cor1, 8);

    } else if (num_cores == 2) {
      // Cor 1: corpo completo (cloud + aba)
      linear_extrude(esp_cor1)
        corpo_2d(offset_cor1, 6);
      // Cor 2: texto em cima (a aba fica na cor 1)
      translate([0, 0, esp_cor1])
        linear_extrude(esp_cor2)
          texto_2d();

    } else {
      // Cor 1: corpo completo, cloud largo (scallop fn baixo)
      linear_extrude(esp_cor1)
        corpo_2d(offset_cor1, 6);
      // Cor 2: cloud intermédio (mais suave) + aba
      translate([0, 0, esp_cor1])
        linear_extrude(esp_cor2)
          corpo_2d(offset_cor2, 14);
      // Cor 3: só o texto (a aba fica nas cores 1+2)
      translate([0, 0, esp_cor1 + esp_cor2])
        linear_extrude(esp_cor3)
          texto_2d();
    }

  }

  // Furo da argola — no centro do disco da aba
  translate([0, lug_y, -1])
    cylinder(h = total_h + 2, r = furo_r, $fn = 24);
}
