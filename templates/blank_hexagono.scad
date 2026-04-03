// Geometria fixa
altura = 3;

union() {
    cylinder(h=altura, r=15, $fn=6); // Hexágono
    
    // Argola saliente
    translate([0, 15, 0]) 
    difference() {
        cylinder(h=altura, r=5);
        translate([0, 0, -1]) cylinder(h=altura+2, r=2.5);
    }
}

union() {
    difference() {
        geometria_hexagono();
        // VERSO: Telefone (Escavado)
        translate([xPosN, yPosN, -0.1]) 
            mirror([1,0,0])
            linear_extrude(height = 1.1) 
                text(telefone, size = fontSizeN, font = fonte, halign = "center", valign = "center");
    }
    // FRENTE: Nome (Relevo)
    translate([xPos, yPos, altura_fixa]) 
        linear_extrude(height = 1) 
            text(nome, size = fontSize, font = fonte, halign = "center", valign = "center");
}