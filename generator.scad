// --- 1. VARIÁVEIS (O teu Backend já injeta estas) ---
nome = ""; 
telefone = "";
fonte = "Liberation Sans:style=Bold";
forma = "coracao"; // Adicionamos esta variável para o backend dizer qual é a forma

fontSize = 7;
xPos = 0;
yPos = 0;
fontSizeN = 6.5;
xPosN = 0;
yPosN = 0;
z_superficie = 3.0; 

// --- 2. IMPORTAÇÃO DINÂMICA ---
// O backend deve garantir que este 'include' aponta para o ficheiro correto
// Se o teu server.js já faz a troca do nome do ficheiro, mantemos a lógica:
include <templates/blank_coracao.scad>; 

union() {
    // AQUI ESTÁ O ERRO: Tens de garantir que chamas o módulo da peça!
    // Se o ficheiro é 'blank_coracao.scad', o módulo lá dentro deve ser chamado:
    coracao_base_cubo(); //  - Confirma se este é o nome dentro do teu .scad

    // NOME NA FRENTE
    translate([xPos, yPos, z_superficie])
        linear_extrude(height = 1) 
            text(nome, size = fontSize, font = fonte, halign = "center", valign = "center");

    // NÚMERO NO VERSO
    rotate([0, 180, 0])
        translate([xPosN, yPosN, 0.5]) 
            linear_extrude(height = 1) 
                text(telefone, size = fontSizeN, font = fonte, halign = "center", valign = "center");
}