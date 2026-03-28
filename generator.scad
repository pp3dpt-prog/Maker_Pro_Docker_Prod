// --- 1. VARIÁVEIS INJETADAS PELO BACKEND ---
// Estas variáveis serão preenchidas automaticamente pelo teu código
nome = ""; 
telefone = "";
fonte = "Liberation Sans:style=Bold";

// Parâmetros da Frente (Nome)
fontSize = 7;
xPos = 0;
yPos = 0;

// Parâmetros do Verso (Número)
fontSizeN = 6.5;
xPosN = 0;
yPosN = 0;

// Configuração de profundidade da peça (Base)
z_superficie = 3.0; 

// --- 2. IMPORTAÇÃO DA BASE ---
// Usamos a variável 'stl_file' para que o backend diga qual é o modelo (osso, coração, etc)
// import(stl_file); 
include <templates/blank_coracao.scad>; 

union() {
    // CORPO DA PEÇA
    coracao_base_cubo();

    // NOME NA FRENTE (RELEVO)
    // Usamos xPos e yPos vindos dos teus Sliders do React
    translate([xPos, yPos, z_superficie])
        linear_extrude(height = 1) 
            text(nome, size = fontSize, font = fonte, halign = "center", valign = "center");

    // NÚMERO NO VERSO (RELEVO OU ESCAVADO)
    // rotate([0, 180, 0]) faz a inversão para o verso da peça
    rotate([0, 180, 0])
        translate([xPosN, yPosN, 0.5]) // 0.5 para garantir que "fura" ou "sai" do verso
            linear_extrude(height = 1) 
                text(telefone, size = fontSizeN, font = fonte, halign = "center", valign = "center");
}