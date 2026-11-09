
// ── SILHUETA PARA A PORTA ──
// Cena de Natal em silhueta para pôr em cima do aro de uma porta ou de uma janela (ou numa
// prateleira), com uma aba atrás que assenta no aro. Imprime deitada: a aba é uma parede ao
// longo do chão da cena, de pé na mesa.
// Parâmetros: cena, largura, espessura, aba (profundidade do apoio, mm; 0 = sem aba), espelhar
function _idx(lista, nome) = let(i = [for (j = [0 : len(lista) - 1]) if (lista[j][0] == nome) j]) len(i) ? i[0] : 0;
function _C()  = NATAL_CENAS[_idx(NATAL_CENAS, is_undef(cena) ? "Trenó" : cena)];
function _W()  = _cl(is_undef(largura) ? 220 : largura, 80, 250);
function _e()  = _cl(is_undef(espessura) ? 3 : espessura, 2, 6);
function _aba() = _cl(is_undef(aba) ? 15 : aba, 0, 40);
function _esp() = _sim(is_undef(espelhar) ? false : espelhar);
function _k()  = _W() / 100;

module silhueta_porta() {
    k = _k();
    mirror([_esp() ? 1 : 0, 0, 0]) {
        linear_extrude(height = _e()) offset(delta = 0.001) scale(k) translate([0, 3]) forma2d(_C()[1]);   // offset: ver cena_led
        // aba ao longo do chão (y de 0 a 3,6·k), da largura toda
        if (_aba() > 0) translate([-50 * k, 0, 0]) cube([100 * k, min(2.4, 3.6 * k), _e() + _aba()]);
    }
}
silhueta_porta();
