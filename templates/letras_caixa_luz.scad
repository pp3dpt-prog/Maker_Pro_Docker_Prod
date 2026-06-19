// ═══════════════════════════════════════════════════════════════
//  Caixa de Luz — Letra Inicial com Nome
//
//  parte = 1 → Base com canal para fita LED  (cor da letra)
//  parte = 2 → Tampa difusora com nome escavado  (branco/transparente)
//  parte = 3 → Letras do nome para encaixar na tampa  (cor de destaque)
// ═══════════════════════════════════════════════════════════════

letra      = is_undef(letra)      ? "S"          : letra;
nome       = is_undef(nome)       ? "Sahil"      : nome;
fonte      = is_undef(fonte)      ? "Sacramento" : fonte;
modo       = is_undef(modo)       ? "corpo"      : modo;  // "corpo" | "tampa" | "nome"

// Tamanhos
l_tam      = is_undef(l_tam)      ? 80           : l_tam;  // tamanho da letra inicial (mm)
n_tam      = is_undef(n_tam)      ? 18           : n_tam;  // tamanho do nome (mm)

// Espessuras / profundidades
esp_parede = is_undef(esp_parede) ? 4.0          : esp_parede; // paredes do canal LED
esp_fundo  = is_undef(esp_fundo)  ? 2.0          : esp_fundo;  // fundo da base
alt_canal  = is_undef(alt_canal)  ? 16           : alt_canal;  // altura interna do canal LED
esp_tampa  = is_undef(esp_tampa)  ? 3.5          : esp_tampa;  // espessura da tampa difusora
prof_nome  = is_undef(prof_nome)  ? 2.0          : prof_nome;  // profundidade do escavado do nome

// Folga de montagem tampa ↔ base (0.2–0.3 mm para encaixar sem forçar)
folga = 0.25;

// ── Formas 2D ─────────────────────────────────────────────────

module letra_2d() {
  text(letra, font=str(fonte,":style=Regular"), size=l_tam,
       halign="center", valign="center");
}

module nome_2d() {
  text(nome, font=str(fonte,":style=Regular"), size=n_tam,
       halign="center", valign="center");
}

// Exterior da base = letra expandida pela espessura das paredes
module exterior_2d() {
  minkowski() {
    letra_2d();
    circle(r=esp_parede, $fn=32);
  }
}

// Exterior da tampa = ligeiramente menor que a base para encaixar
module exterior_tampa_2d() {
  minkowski() {
    letra_2d();
    circle(r=esp_parede - folga, $fn=32);
  }
}

// ── PARTE 1 — Base com canal LED ──────────────────────────────
// Canal = interior oco na forma da letra, aberto por cima.
// Fundo sólido de esp_fundo mm.
// Fita LED desliza pelo canal e fica escondida dentro da letra.

module parte1_base() {
  difference() {
    // Sólido exterior completo
    linear_extrude(esp_fundo + alt_canal)
      exterior_2d();
    // Escavar o canal (forma da letra, do topo até ao fundo)
    translate([0, 0, esp_fundo])
      linear_extrude(alt_canal + 1)
        letra_2d();
  }
}

// ── PARTE 2 — Tampa difusora com nome escavado ─────────────────
// Fica por cima da base, cobre o canal LED.
// O nome fica escavado prof_nome mm → as letras do nome encaixam aqui.

module parte2_tampa() {
  difference() {
    linear_extrude(esp_tampa)
      exterior_tampa_2d();
    // Escavar o nome na face superior (deixa esp_tampa - prof_nome de fundo)
    translate([0, 0, esp_tampa - prof_nome])
      linear_extrude(prof_nome + 1)
        nome_2d();
  }
}

// ── PARTE 3 — Letras do nome ───────────────────────────────────
// Encaixam no escavado da tampa. Altura = prof_nome - 0.1 mm (folga).
// Imprimir na cor de destaque.

module parte3_nome() {
  linear_extrude(prof_nome - 0.1)
    nome_2d();
}

// ── Render ────────────────────────────────────────────────────

if      (modo == "corpo") parte1_base();
else if (modo == "tampa") parte2_tampa();
else                      parte3_nome();
