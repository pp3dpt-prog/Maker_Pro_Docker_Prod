// ── ÁRVORE EM CAMADAS ──
// Árvore clássica: tronco e 3 a 8 camadas que abrem a 45° (imprime sem suportes) e afinam até
// ao "pescoço" de onde sai a camada seguinte. A orla de cada camada pode ondular (desencontrada
// da camada de baixo). Sólida ou oca por baixo (com um tronco largo cabe uma vela LED).
//
// Parâmetros: niveis, raio, altura, raio_tronco (0 = sem tronco), altura_tronco, ondas, onda (mm),
//   estreitar (% do pescoço face à camada seguinte), base_arvore, parede, estrela_topo, tamanho_estrela

function _N()   = is_undef(niveis) ? 5 : max(2, round(niveis));
function _R()   = is_undef(raio) ? 55 : raio;
function _H()   = is_undef(altura) ? 160 : altura;
function _rtr() = is_undef(raio_tronco) ? 9 : raio_tronco;
function _htr() = is_undef(altura_tronco) ? 15 : altura_tronco;
function _nw()  = is_undef(ondas) ? 8 : max(0, round(ondas));
function _ow()  = _nw() == 0 ? 0 : (is_undef(onda) ? 3 : onda);
function _e()   = (is_undef(estreitar) ? 55 : estreitar) / 100;
function _t()   = is_undef(parede) ? 2 : parede;
function _oco() = !is_undef(base_arvore) && base_arvore == "Oca por baixo (vela LED)";
function _NA()  = 360;
function _topo_alt() = _H();
function _r_max() = _R() + _ow();

function _zt()  = (_rtr() > 0 && _htr() > 0) ? _htr() : 0;
function _h()   = (_H() - _zt()) / _N();
function _rb(i) = _R() * (1 - 0.82 * i / _N());                         // raio da camada i em baixo
function _neck(i) = i >= _N() - 1 ? 1.5 : _e() * _rb(i + 1);            // pescoço no topo da camada i
function _rprev(i) = i == 0 ? (_zt() > 0 ? _rtr() : _rb(0)) : _neck(i - 1);
function _rbe(i) = max(_rprev(i), min(_rb(i), _rprev(i) + 0.6 * _h()));  // a abertura a 45° usa no máximo 60% da camada
function _fl(i) = _rbe(i) - _rprev(i);                                  // altura da abertura (45°)
function _zi(i) = _zt() + i * _h();
function _tier(z) = max(0, min(_N() - 1, floor((z - _zt()) / _h())));
function rbase(z) = (_zt() > 0 && z <= _zt()) ? _rtr() :
    let(i = _tier(z), dz = z - _zi(i))
    dz < _fl(i) ? _rprev(i) + dz : _rbe(i) + (_neck(i) - _rbe(i)) * (dz - _fl(i)) / (_h() - _fl(i));
function fonda(z) = (_zt() > 0 && z <= _zt()) ? 0 :
    let(i = _tier(z), dz = z - _zi(i))
    dz < _fl(i) ? dz / _fl(i) : max(0, 1 - (dz - _fl(i)) / (_h() - _fl(i)));
function r_at(a, z) = rbase(z) + _ow() * fonda(z) * cos(_nw() * a + _tier(z) * 180 / max(1, _nw()));

// linhas: as quebras do perfil (entre elas o raio varia a direito) divididas de 3 em 3 mm
function _quebras() = concat([0], _zt() > 0 ? [_zt()] : [],
    [for (i = [0 : _N() - 1], z = _fl(i) > 0.01 ? [_zi(i) + _fl(i), _zi(i) + _h()] : [_zi(i) + _h()]) z]);
function _subdiv(Z) = concat(
    [for (s = [0 : len(Z) - 2], m = [max(1, ceil((Z[s + 1] - Z[s]) / 3))], q = [0 : m - 1]) Z[s] + (Z[s + 1] - Z[s]) * q / m],
    [Z[len(Z) - 1]]);
function _zrows()  = _subdiv(_quebras());
function _zirows() = _zrows();
function _incl(z) = max(abs(rbase(z + 0.01) - rbase(z)), abs(rbase(z) - rbase(max(0, z - 0.01)))) / 0.01;
function rc_at(z) = z > _H() - 6 ? -1 : rbase(z) - _ow() * fonda(z) - _t() * sqrt(1 + _incl(z) * _incl(z));

arvore();
