// --- 1. VARIÁVEIS INJETADAS PELO BACKEND ---
nome_pet = "NOME";      
telefone = "000000000"; 
fonte = "Open Sans";    
forma = "coracao";      


fontSize  = is_undef(fontSize)  ? 7   : fontSize;
xPos      = is_undef(xPos)      ? 0   : xPos;
yPos      = is_undef(yPos)      ? 0   : yPos;

fontSizeN = is_undef(fontSizeN) ? 6.5 : fontSizeN;
xPosN     = is_undef(xPosN)     ? 0   : xPosN;
yPosN     = is_undef(yPosN)     ? 0   : yPosN;

z_superficie = 3.0; 

echo("DEBUG fonte=", fonte, " fontSizeN=", fontSizeN, " fontSize=", fontSize);

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
    $fn = 24;
    translate([-xPosN, yPosN, -0.1]) 
    rotate([0, 180, 0])
    linear_extrude(height = 1.1) 
    text(telefone, size = fontSizeN, font = fonte, halign = "center", valign = "center");
}

// Nome em Relevo na frente

$fn = 24;
translate([xPos, yPos, z_superficie]) 
linear_extrude(height = 1) 
text(nome_pet, size = fontSize, font = fonte, halign = "center", valign = "center");
