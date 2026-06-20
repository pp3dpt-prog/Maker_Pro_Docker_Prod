// ═══════════════════════════════════════════════════════════════
//  Caixa de Luz — Letra Inicial com Nome
//
//  modo = "corpo" → Base com canal para fita LED  (cor da letra)
//  modo = "tampa" → Tampa que envolve o corpo por fora  (branco)
//  modo = "nome"  → Letras do nome para encaixar no balde  (cor destaque)
//
//  Montagem: desliza a tampa de cima para baixo sobre o corpo.
//  A base do corpo (esp_fundo) fica visível abaixo da tampa.
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
esp_tampa        = 1.5;   // espessura do anel exterior da tampa
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

// Corpo exterior = letra + esp_parede
module exterior_2d() {
  minkowski() { letra_2d(); circle(r=esp_parede, $fn=32); }
}

// Interior da tampa = exterior do corpo + clearance (corpo entra aqui)
module interior_tampa_2d() {
  minkowski() { letra_2d(); circle(r=esp_parede + folga, $fn=32); }
}

// Exterior da tampa = interior + parede da tampa
module exterior_tampa_2d() {
  minkowski() { letra_2d(); circle(r=esp_parede + folga + esp_tampa, $fn=32); }
}

// Balde interior = nome + folga encaixe
module balde_interior_2d() {
  minkowski() { nome_2d(); circle(r=folga_balde, $fn=16); }
}

// Balde exterior = nome + folga + parede
module balde_exterior_2d() {
  minkowski() { nome_2d(); circle(r=folga_balde + esp_parede_balde, $fn=16); }
}

// ── PARTE 1 — Corpo / Base com canal LED ──────────────────────
// Canal aberto no topo. Tampa desliza de cima para baixo sobre este.

module parte1_base() {
  difference() {
    linear_extrude(esp_fundo + alt_canal) exterior_2d();
    translate([0, 0, esp_fundo])
      linear_extrude(alt_canal + 1) letra_2d();
  }
}

// ── PARTE 2 — Tampa (envolve o corpo por fora) ────────────────
// Aberta em baixo — o corpo entra pela abertura inferior.
// Topo fino (≤ 1.8 mm) difunde a luz do canal LED.
// Balde pende do topo para dentro do canal LED do corpo.

module parte2_tampa() {
  difference() {
    union() {
      // Anel exterior que abraça o corpo
      linear_extrude(alt_canal)
        difference() {
          exterior_tampa_2d();
          interior_tampa_2d();
        }

      // Topo fino — difusor de luz
      translate([0, 0, alt_canal])
        linear_extrude(esp_topo)
          exterior_tampa_2d();

      // Balde: clipped ao canal LED (letra_2d) para não colidir com o corpo
      translate([0, 0, alt_canal - prof_nome])
        difference() {
          intersection() {
            linear_extrude(prof_nome) balde_exterior_2d();
            linear_extrude(prof_nome) letra_2d();
          }
          translate([0, 0, fundo_balde])
            linear_extrude(prof_nome)
              intersection() {
                balde_interior_2d();
                letra_2d();
              }
        }
    }

    // Abertura no topo para inserir as letras do nome
    translate([0, 0, alt_canal - 1])
      linear_extrude(esp_topo + 2)
        intersection() {
          balde_interior_2d();
          letra_2d();
        }
  }
}

// ── PARTE 3 — Letras do nome ───────────────────────────────────
// Encaixam pelo topo, colam no balde, sobressaem saliencia_nome mm.

module parte3_nome() {
  linear_extrude(prof_nome - fundo_balde + esp_topo + saliencia_nome)
    nome_2d();
}

// ── Render ────────────────────────────────────────────────────

if      (modo == "corpo") parte1_base();
else if (modo == "tampa") parte2_tampa();
else                      parte3_nome();
