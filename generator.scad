// --- 1. VARIÁVEIS INJETADAS PELO BACKEND ---
// O servidor substitui estes valores com os dados do frontend [cite: 2, 3]
nome = "REX"; 
telefone = "912345678";
fonte = "Liberation Sans:style=Bold"; 
forma = "coracao"; // O teu frontend passa "coracao", "circulo" ou "osso"

// Parâmetros da Frente (Nome) [cite: 2]
fontSize = 7; 
xPos = 0; 
yPos = 0; 

// Parâmetros do Verso (Número) [cite: 3]
fontSizeN = 6.5; 
xPosN = 0; 
yPosN = 0; 
// Configuração de profundidade da peça (Base)
z_superficie = 3.0; 

// --- 2. LÓGICA DE SELEÇÃO DA BASE ---
// No Docker/Produção usamos caminhos relativos
if (forma == "coracao") {
    include <templates/blank_coracao.scad>;
    renderizar_peca();
} else if (forma == "circulo") {
    include <templates/blank_circulo.scad>;
    renderizar_peca();
} else if (forma == "osso") {
    include <templates/blank_osso.scad>;
    renderizar_peca();
}

// --- 3. CONSTRUÇÃO DA PEÇA ---

// 1. BASE com o texto do Verso ESCAVADO (Subtração)
difference() {
    // A forma principal que será furada
    coracao_base_cubo(); 

    // Texto do Verso (Telefone) - Posicionamento dinâmico
    // O rotate vira para o verso; xPosN e yPosN controlam o ajuste fino
    translate([-xPosN, yPosN, -0.1]) 
    rotate([0, 180, 0])
    linear_extrude(height = 1.1) 
    text(telefone, size = fontSizeN, font = fonte, halign = "center", valign = "center");
}

// 2. NOME em RELEVO na frente (Soma)
// Posicionamento dinâmico com xPos e yPos
translate([xPos, yPos, z_superficie]) 
linear_extrude(height = 1) 
text(nome, size = fontSize, font = fonte, halign = "center", valign = "center");