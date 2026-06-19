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

// Raio do "cloud" de cada nível (quanto cada camada sobressai do texto)
offset_cor1 = is_undef(offset_cor1) ? 8             : offset_cor1;
offset_cor2 = is_undef(offset_cor2) ? 4             : offset_cor2;

// Raio do furo para argola
furo_r = 1.5;

// Altura total calculada conforme o nº de cores
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

// Expande o texto com um "aura" arredondado → efeito cloud/bolha
// fn_val baixo (4-8)  = bordas mais angulosas / scallop
// fn_val alto (12-20) = bordas mais suaves
module cloud_2d(r, fn_val) {
  minkowski() {
    texto_2d();
    circle(r = r, $fn = fn_val);
  }
}

// Posição vertical do furo (acima do cloud de nível 1)
furo_y = tamanho * 0.6 + offset_cor1 + furo_r + 0.5;

// ── Geometria ─────────────────────────────────────────────────

difference() {
  union() {

    if (num_cores == 1) {
      // Uma só cor: cloud base + texto em conjunto
      linear_extrude(esp_cor1)
        cloud_2d(offset_cor1, 8);

    } else if (num_cores == 2) {
      // Cor 1: cloud base
      linear_extrude(esp_cor1)
        cloud_2d(offset_cor1, 6);
      // Cor 2: texto em cima
      translate([0, 0, esp_cor1])
      linear_extrude(esp_cor2)
        texto_2d();

    } else {
      // Cor 1: cloud largo (efeito scallop com fn baixo)
      linear_extrude(esp_cor1)
        cloud_2d(offset_cor1, 6);
      // Cor 2: cloud mais estreito (mais suave)
      translate([0, 0, esp_cor1])
      linear_extrude(esp_cor2)
        cloud_2d(offset_cor2, 14);
      // Cor 3: texto
      translate([0, 0, esp_cor1 + esp_cor2])
      linear_extrude(esp_cor3)
        texto_2d();
    }

  }

  // Furo da argola — centrado no topo do cloud
  translate([0, furo_y, -1])
  cylinder(h = total_h + 2, r = furo_r, $fn = 20);
}
