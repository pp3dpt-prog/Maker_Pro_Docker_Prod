#!/bin/sh
# Junta as partes comuns a cada modelo de decoração (o scad_template na BD é o ficheiro montado).
cd "$(dirname "$0")/partes"
for m in vaso_torcido taca_ondulada; do cat _superficie.scad _formas.scad $m.scad > ../$m.scad; done
for m in vaso_texturizado porta_velas; do cat _superficie.scad _formas.scad _texturas.scad $m.scad > ../$m.scad; done
cp estrela.scad ../estrela.scad
# modelos de Natal: formas 2D geradas (scripts/gerar_natal_deco.mjs) + peças comuns
for m in rena anjo gorro_bombom casinha cena_led silhueta_porta arvore_nomes; do cat _natal_comum.scad _natal_formas.scad $m.scad > ../$m.scad; done
