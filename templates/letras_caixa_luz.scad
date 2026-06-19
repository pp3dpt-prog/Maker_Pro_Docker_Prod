// ═══════════════════════════════════════════════════════════════
//  Caixa de Luz — Letra Inicial com Nome
//
//  modo = "corpo" → Base com canal para fita LED  (cor da letra)
//  modo = "tampa" → Tampa com topo fino + balde do nome  (branco)
//  modo = "nome"  → Letras do nome para encaixar no balde  (cor destaque)
// ═══════════════════════════════════════════════════════════════

letra          = is_undef(letra)          ? "S"               : letra;
nome           = is_undef(nome)           ? "Sahil"           : nome;
fonte_letra    = is_undef(fonte_letra)    ? "Liberation Sans" : fonte_letra;
fonte_nome     = is_undef(fonte_nome)     ? "Sacramento"      : fonte_nome;
modo           = is_undef(modo)           ? "corpo"           : modo;

l_tam          = is_undef(l_tam)          ? 80   : l_tam;
n_tam          = is_undef(n_tam)          ? 18   : n_tam;
esp_parede     = is_undef(esp_parede)     ? 4.0  : esp_parede;
esp_fundo      = is_undef(esp_fundo)      ? 2.0  : esp_fundo;
alt_canal      = is_undef(alt_canal)      ? 16   : alt_canal;
esp_topo       = is_undef(esp_topo)       ? 1.5  : esp_topo;
prof_nome      = is_undef(prof_nome)      ? 2.5  : prof_nome;
saliencia_nome = is_undef(saliencia_nome) ? 10   : saliencia_nome;

folga            = 0.25;
folga_balde      = 0.3;
esp_parede_balde = 1.2;
fundo_balde      = 0.8;

// ── Formas 2D ─────────────────────────────────────────────────

module letra_2d() {
  text(letra, font=str(fonte_letra,":style=Regular"), size=l_tam,
       halign="center", valign="center");
}

module nome_2d() {
  text(nome, font=str(fonte_nome,":style=Regular"), size=n_tam,
       halign="center", valign="center");
}

module exterior_2d() {
  minkowski() { letra_2d(); circle(r=esp_parede, $fn=32); }
}

module exterior_tampa_2d() {
  minkowski() { letra_2d(); circle(r=esp_parede - folga, $fn=32); }
}

// Interior do balde = nome + folga de encaixe
module balde_interior_2d() {
  minkowski() { nome_2d(); circle(r=folga_balde, $fn=16); }
}

// Exterior do balde = nome + folga + paredes
module balde_exterior_2d() {
  minkowski() { nome_2d(); circle(r=folga_balde + esp_parede_balde, $fn=16); }
}

// ── PARTE 1 — Base com canal LED ──────────────────────────────

module parte1_base() {
  difference() {
    linear_extrude(esp_fundo + alt_canal) exterior_2d();
    translate([0, 0, esp_fundo])
      linear_extrude(alt_canal + 1) letra_2d();
  }
}

// ── PARTE 2 — Tampa ───────────────────────────────────────────
// Paredes em forma de letra (fundo aberto, encaixa sobre a base).
// Topo fino (esp_topo ≤ 1.8 mm) para a luz difundir-se.
// Balde clipped à exterior_tampa_2d (vai até à parede exterior),
// assim as paredes internas da letra não bloqueiam o acesso para colar.

module parte2_tampa() {
  difference() {
    union() {
      // Paredes laterais
      linear_extrude(alt_canal)
        difference() {
          exterior_tampa_2d();
          letra_2d();
        }

      // Topo fino — difusor de luz
      translate([0, 0, alt_canal])
        linear_extrude(esp_topo)
          exterior_tampa_2d();

      // Balde: vai até à parede exterior (corta paredes internas da letra)
      translate([0, 0, alt_canal - prof_nome])
        difference() {
          intersection() {
            linear_extrude(prof_nome) balde_exterior_2d();
            linear_extrude(prof_nome) exterior_tampa_2d();
          }
          translate([0, 0, fundo_balde])
            linear_extrude(prof_nome)
              intersection() {
                balde_interior_2d();
                exterior_tampa_2d();
              }
        }
    }

    // Abertura no topo — também até à parede exterior
    translate([0, 0, alt_canal - 1])
      linear_extrude(esp_topo + 2)
        intersection() {
          balde_interior_2d();
          exterior_tampa_2d();
        }
  }
}

// ── PARTE 3 — Letras do nome ───────────────────────────────────
// Inserem-se pela abertura no topo, descem até ao fundo do balde.
// Sobressaem saliencia_nome mm acima do topo da tampa.

module parte3_nome() {
  linear_extrude(prof_nome - fundo_balde + esp_topo + saliencia_nome)
    nome_2d();
}

// ── Render ────────────────────────────────────────────────────

if      (modo == "corpo") parte1_base();
else if (modo == "tampa") parte2_tampa();
else                      parte3_nome();
