/*
  Porta-chaves tipográfico paramétrico
  Variáveis injectadas pelo backend (não redefinir aqui):
    Text, Font_name, twist, center,
    Loop_x_position, Loop_y_position, Loop_character, Loop_font,
    letter_1..13_height, letter_1..13_space
*/

// Multiplicadores globais (ajustar conforme necessário)
space_scale  = 1.2;
height_scale = 1.2;

// Limitar resolução das letras: o twist com $fn alto torna a geração
// muito lenta para nomes longos. 36 é suave que chegue para porta-chaves.
$fn = min($fn, 36);

spacing = [
  0,
  letter_1_space  * space_scale,  letter_2_space  * space_scale,
  letter_3_space  * space_scale,  letter_4_space  * space_scale,
  letter_5_space  * space_scale,  letter_6_space  * space_scale,
  letter_7_space  * space_scale,  letter_8_space  * space_scale,
  letter_9_space  * space_scale,  letter_10_space * space_scale,
  letter_11_space * space_scale,  letter_12_space * space_scale,
  letter_13_space * space_scale
];

height = [
  letter_1_height  * height_scale, letter_2_height  * height_scale,
  letter_3_height  * height_scale, letter_4_height  * height_scale,
  letter_5_height  * height_scale, letter_6_height  * height_scale,
  letter_7_height  * height_scale, letter_8_height  * height_scale,
  letter_9_height  * height_scale, letter_10_height * height_scale,
  letter_11_height * height_scale, letter_12_height * height_scale,
  letter_13_height * height_scale
];

// Argola
linear_extrude(height = 3) {
  translate([-center - Loop_x_position, Loop_y_position, 0])
  rotate([0, 0, -90])
  text(size = 20, text = Loop_character, font = Loop_font,
       halign = "center", valign = "center");
}

// Letras do nome
for (i = [0 : len(Text) - 1]) {
  linear_extrude(height = height[i], twist = twist) {
    translate([(spacing[i] * i) - center, 0, 0])
    text(size = 25, text = Text[i], font = Font_name,
         halign = "center", valign = "center");
  }
}
