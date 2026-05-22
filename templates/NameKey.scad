/*
  Porta-chaves tipográfico paramétrico
  Variáveis injectadas pelo backend (não redefinir aqui):
    Text, Font_name, twist, center,
    Loop_x_position, Loop_y_position, Loop_character, Loop_font,
    letter_1..13_height, letter_1..13_space
*/

spacing = [
  0,
  letter_1_space,  letter_2_space,  letter_3_space,  letter_4_space,
  letter_5_space,  letter_6_space,  letter_7_space,  letter_8_space,
  letter_9_space,  letter_10_space, letter_11_space, letter_12_space,
  letter_13_space
];

height = [
  letter_1_height, letter_2_height, letter_3_height, letter_4_height,
  letter_5_height, letter_6_height, letter_7_height, letter_8_height,
  letter_9_height, letter_10_height, letter_11_height, letter_12_height,
  letter_13_height
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
