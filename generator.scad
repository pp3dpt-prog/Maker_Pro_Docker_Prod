// --- 1. VARIÁVEIS INJETADAS PELO BACKEND ---
nome_pet = "NOME";      
telefone = "000000000"; 
fonte = "Open Sans";    
forma = "coracao";      

fontSize = 7; 
xPos = 0; 
yPos = 0; 
fontSizeN = 6.5; 
xPosN = 0; 
yPosN = 0;
z_superficie = 3.0; 

// --- 2. LÓGICA DE SELEÇÃO DA BASE ---
// Removido o prefixo "app/" para funcionar no ambiente WORKDIR /app do Docker [cite: 8, 9]
if (forma == "coracao") {
    include <templates/blank_coracao.scad>;
    renderizar_peca();
} else if (forma == "circulo" || forma == "redondo") {
    include <templates/blank_redondo.scad>;
    renderizar_peca();
} else if (forma == "osso") {
    include <templates/blank_osso.scad>;
    renderizar_peca();
}

// --- 3. CONSTRUÇÃO DA PEÇA ---
difference() {
    // Nota: A função deve existir dentro do ficheiro de template incluído
    if (forma == "coracao") coracao_base_cubo();
    else if (forma == "osso") osso_base_cubo();
    else redondo_base_cubo();

    // Texto do Verso (Telefone)
    translate([-xPosN, yPosN, -0.1]) 
    rotate([0, 180, 0])
    linear_extrude(height = 1.1) 
    text(telefone, size = fontSizeN, font = fonte, halign = "center", valign = "center");
}

// Nome em Relevo na frente
translate([xPos, yPos, z_superficie]) 
linear_extrude(height = 1) 
text(nome_pet, size = fontSize, font = fonte, halign = "center", valign = "center");