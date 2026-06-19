// ═══════════════════════════════════════════════════════════════
//  Caixa de Luz — Letra Inicial com Nome
//
//  modo = "corpo" → Base com canal para fita LED  (cor da letra)
//  modo = "tampa" → Tampa com topo fino + balde do nome  (branco)
//  modo = "nome"  → Letras do nome para encaixar no balde  (cor destaque)
// ═══════════════════════════════════════════════════════════════

letra      = is_undef(letra)      ? "S"    : letra;
nome       = is_undef(nome)       ? "Sahil": nome;
fonte      = is_undef(fonte)      ? "Sacramento" : fonte;
modo       = is_undef(modo)       ? "corpo" : modo;

l_tam      = is_undef(l_tam)      ? 80   : l_tam;   // tamanho da letra inicial (mm)
n_tam      = is_undef(n_tam)      ? 18   : n_tam;   // tamanho do nome (mm)

esp_parede = is_undef(esp_parede) ? 4.0  : esp_parede; // paredes do canal LED
esp_fundo  = is_undef(esp_fundo)  ? 2.0  : esp_fundo;  // fundo sólido da base
alt_canal  = is_undef(alt_canal)  ? 16   : alt_canal;  // altura do canal LED
esp_topo   = is_undef(esp_topo)   ? 1.5  : esp_topo;   // topo fino da tampa (luz difunde-se)
prof_nome  = is_undef(prof_nome)  ? 2.5  : prof_nome;  // profundidade do balde (pende para dentro)

folga            = 0.25; // folga tampa ↔ base
folga_balde      = 0.3;  // folga letra ↔ interior do balde
esp_parede_balde = 1.2;  // espessura das paredes do balde
fundo_balde      = 0.8;  // espessura do fundo do balde

// ── Formas 2D ─────────────────────────────────────────────────

module letra_2d() {
  text(letra, font=str(fonte,":style=Regular"), size=l_tam,
       halign="center", valign="center");
}

module nome_2d() {
  text(nome, font=str(fonte,":style=Regular"), size=n_tam,
       halign="center", valign="center");
}

module exterior_2d() {
  minkowski() { letra_2d(); circle(r=esp_parede, $fn=32); }
}

module exterior_tampa_2d() {
  minkowski() { letra_2d(); circle(r=esp_parede - folga, $fn=32); }
}

// Interior do balde (onde a letra assenta) = nome + folga de encaixe
module balde_interior_2d() {
  minkowski() { nome_2d(); circle(r=folga_balde, $fn=16); }
}

// Exterior do balde (inclui as paredes)
module balde_exterior_2d() {
  minkowski() { nome_2d(); circle(r=folga_balde + esp_parede_balde, $fn=16); }
}

// ── PARTE 1 — Base com canal LED ──────────────────────────────

module parte1_base() {
  difference() {
    linear_extrude(esp_fundo + alt_canal)
      exterior_2d();
    translate([0, 0, esp_fundo])
      linear_extrude(alt_canal + 1)
        letra_2d();
  }
}

// ── PARTE 2 — Tampa ───────────────────────────────────────────
// Paredes em forma de letra (fundo aberto, encaixa sobre a base).
// Topo FINO (esp_topo ≤ 1.8 mm) para a luz difundir-se.
// Balde pende do topo para DENTRO da câmara de luz:
//   - paredes à volta do nome (esp_parede_balde)
//   - fundo sólido (fundo_balde)
//   - aberto no topo → letras inserem-se por cima e colam

module parte2_tampa() {
  difference() {
    union() {
      // Paredes laterais (mesma secção que a base, ligeiramente menores)
      linear_extrude(alt_canal)
        difference() {
          exterior_tampa_2d();
          letra_2d();
        }

      // Topo fino — difusor de luz
      translate([0, 0, alt_canal])
        linear_extrude(esp_topo)
          exterior_tampa_2d();

      // Balde: pende do topo para dentro (prof_nome mm abaixo do topo)
      // Paredes + fundo do balde; aberto no topo (z = alt_canal)
      translate([0, 0, alt_canal - prof_nome])
        difference() {
          linear_extrude(prof_nome)
            balde_exterior_2d();
          // Oco interior acima do fundo
          translate([0, 0, fundo_balde])
            linear_extrude(prof_nome)
              balde_interior_2d();
        }
    }

    // Abertura no topo para inserir as letras (= interior do balde)
    translate([0, 0, alt_canal - 1])
      linear_extrude(esp_topo + 2)
        balde_interior_2d();
  }
}

// ── PARTE 3 — Letras do nome ───────────────────────────────────
// Inserem-se pela abertura no topo, descem até ao fundo do balde.
// Altura = prof_nome + esp_topo - 0.2 → ficam rasas com o topo da tampa.

module parte3_nome() {
  linear_extrude(prof_nome + esp_topo - 0.2)
    nome_2d();
}

// ── Render ────────────────────────────────────────────────────

if      (modo == "corpo") parte1_base();
else if (modo == "tampa") parte2_tampa();
else                      parte3_nome();
