#!/bin/sh
# Junta as partes comuns a cada árvore (o scad_template na BD é o ficheiro montado).
cd "$(dirname "$0")/partes"
for m in arvore_espiral arvore_camadas arvore_texturizada; do cat _estrela_topo.scad _arvore.scad $m.scad > ../$m.scad; done
cat _estrela_topo.scad arvore_lowpoly.scad > ../arvore_lowpoly.scad
cp arvore_encaixe.scad ../arvore_encaixe.scad
