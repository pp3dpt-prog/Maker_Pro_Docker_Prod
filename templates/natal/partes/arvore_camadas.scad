// ── ÁRVORE EM CAMADAS ──
// Árvore clássica: tronco e 2 a 8 camadas em cone empilhadas. Cada camada abre a 45° a partir do
// degrau da de baixo (imprime sem suportes) e afina a direito até ao degrau seguinte. A orla de
// cada camada pode ondular (desencontrada da camada de baixo).
// Oca por baixo: cavidade cilíndrica para uma vela LED (Ø + 2 mm de folga, até altura_vela + 5 mm)
// com tecto a 45°; o tronco e os degraus alargam sozinhos para a parede caber à volta.
// A mesma conta está em Maker_Pro_Frontend_Prod/lib/arvoresNatal.ts (perfilCamadas).
//
// Parâmetros: niveis, raio, altura, raio_tronco (0 = sem tronco), altura_tronco, ondas, onda (mm),
//   degrau (% — 0 = cone liso, 100 = degraus fundos), base_arvore, parede, diametro_vela,
//   altura_vela, estrela_topo, tamanho_estrela

function _N()   = is_undef(niveis) ? 4 : max(2, round(niveis));
function _R()   = is_undef(raio) ? 50 : raio;
function _H()   = is_undef(altura) ? 160 : altura;
function _rtr() = is_undef(raio_tronco) ? 22 : raio_tronco;
function _htr() = is_undef(altura_tronco) ? 16 : altura_tronco;
function _nw()  = is_undef(ondas) ? 8 : max(0, round(ondas));
function _ow()  = _nw() == 0 ? 0 : (is_undef(onda) ? 3 : onda);
function _dg()  = min(1, max(0, (is_undef(degrau) ? 60 : degrau) / 100));
function _t()   = is_undef(parede) ? 2 : parede;
function _oco() = !is_undef(base_arvore) && base_arvore == "Oca por baixo (vela LED)";
function _NA()  = 360;

// vela LED
function _rc()   = (is_undef(diametro_vela) ? 38 : diametro_vela) / 2 + 1;
function _tw()   = _t() * 1.42;
function _hv()   = min((is_undef(altura_vela) ? 40 : altura_vela) + 5, _H() - _rc() - 15);
function _zcav() = _hv() + _rc() - 3;
function rcav(z) = z <= _hv() ? _rc() : _rc() - (z - _hv());

function _tronco() = _rtr() > 0 && _htr() > 0;
function _rtrE() = _tronco() ? (_oco() ? max(_rtr(), _rc() + _tw() + 0.5) : _rtr()) : 0;
function _zt()  = _tronco() ? _htr() : 0;
function _h()   = (_H() - _zt()) / _N();
// a camada de baixo abre a 45° a partir do tronco: usa até metade da 1.ª camada e pode "comer"
// metade do tronco; se não chegar ao raio pedido, a árvore toda fica mais estreita
function _zs0() = _zt() / 2;
function _Rb()  = _tronco() ? max(_rtrE(), min(_R(), _rtrE() + (_zt() - _zs0()) + 0.5 * _h())) : _R();
function _rb(i) = _Rb() * (1 - 0.82 * i / _N());
function _d()   = _dg() * 0.45 * _h();                                   // altura do degrau
function _neck(i) = i >= _N() - 1 ? 1.5 : max(1.5, _rb(i + 1) - _d());
function _zs()  = min(_zt(), _zt() + 0.5 * _h() - (_Rb() - _rtrE()));

// perfil (z, raio) e peso da onda (z, 0..1), ligados a direito
function _perfil() = concat(
    _tronco() ? [[0, _rtrE()], [_zs(), _rtrE()], [_zs() + _Rb() - _rtrE(), _Rb()]] : [[0, _Rb()]],
    [for (i = [0 : _N() - 1], q = i < _N() - 1
            ? [[_zt() + (i + 1) * _h(), _neck(i)], [_zt() + (i + 1) * _h() + _rb(i + 1) - _neck(i), _rb(i + 1)]]
            : [[_zt() + (i + 1) * _h(), _neck(i)]]) q]);
function _fpeso() = concat(
    _tronco() ? [[0, 0], [_zs(), 0], [_zs() + _Rb() - _rtrE(), 1]] : [[0, 1]],
    [for (i = [0 : _N() - 1], q = i < _N() - 1
            ? [[_zt() + (i + 1) * _h(), 0], [_zt() + (i + 1) * _h() + _rb(i + 1) - _neck(i), 1]]
            : [[_zt() + (i + 1) * _h(), 0]]) q]);

function _topo_alt() = _H();
function _r_max() = _Rb() + _ow();

function rbase(z) = max(lookup(z, _perfil()), _oco() && z <= _zcav() ? rcav(z) + _tw() + _ow() : 0);
function fonda(z) = lookup(z, _fpeso());
function _tier(z) = max(0, min(_N() - 1, floor((z - _zt()) / _h())));
function r_at(a, z) = r_at_linha(a, z, _linha(z));
// por linha: raio de base, amplitude da onda e fase (calculados uma vez — o perfil é uma lista)
function _linha(z) = [rbase(z), _ow() * fonda(z), _tier(z) * 180 / max(1, _nw())];
function r_at_linha(a, z, c) = c[0] + c[1] * cos(_nw() * a + c[2]);

// linhas: as quebras do perfil divididas de 3 em 3 mm
function _ordena(v) = len(v) <= 1 ? v : let(p = v[0])
    concat(_ordena([for (x = v) if (x < p) x]), [for (x = v) if (x == p) x], _ordena([for (x = v) if (x > p) x]));
function _unicos(v) = [for (k = [0 : len(v) - 1]) if (k == 0 || v[k] - v[k - 1] > 0.01) v[k]];
function _subdiv(Z0) = let(Z = _unicos(_ordena(Z0))) concat(
    [for (s = [0 : len(Z) - 2], m = [max(1, ceil((Z[s + 1] - Z[s]) / 3))], q = [0 : m - 1]) Z[s] + (Z[s + 1] - Z[s]) * q / m],
    [Z[len(Z) - 1]]);
function _zrows()  = _subdiv(concat([for (p = _perfil()) if (p[0] <= _H()) p[0]], _oco() ? [_hv(), _zcav()] : []));
function _zirows() = _subdiv([0, _hv(), _zcav()]);
function rc_at(z) = z > _zcav() + 1e-6 ? -1 : rcav(z);

arvore();
