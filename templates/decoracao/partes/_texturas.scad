// ── texturas (0..1) em função do ângulo e da altura — as mesmas do suporte para bases ──
// Cada modelo define _tex(), _lam() (tamanho), _A() (relevo) e _r_ciclos() (raio para contar ciclos).
function _frac(x) = x - floor(x);
function _tri(x)  = 1 - 2 * abs(_frac(x) - 0.5);
function _ncic()  = max(3, round(2 * PI * _r_ciclos() / _lam()));   // ciclos inteiros: sem costura
function padrao(a, z) =
    let(x = _ncic() * a / 360, y = z / _lam(), p = _tex())
    p == "Riscas"   ? 0.5 + 0.5 * cos(360 * x)
  : p == "Espiral"  ? 0.5 + 0.5 * cos(360 * (x + y * 0.5))
  : p == "Losangos" ? min(_tri(x + y / 2), _tri(x - y / 2))
  : p == "Ondas"    ? 0.5 + 0.5 * cos(360 * y + 90 * sin(360 * x))
  : p == "Bolhas"   ? let(fy = floor(y * 1.15), xx = _frac(x + (fy % 2) * 0.5) - 0.5,
                          yy = _frac(y * 1.15) - 0.5, r2 = (xx * xx + yy * yy) / (0.42 * 0.42))
                      sqrt(max(0, 1 - r2))
  : p == "Tijolo"   ? let(yb = z / (_lam() * 0.55), fy = floor(yb), xb = x + (fy % 2) * 0.5)
                      ((_frac(yb) < 0.16 || _frac(xb) < 0.08) ? 0 : 1)
  : 0;
// a textura desvanece junto ao fundo e ao rebordo (orlas lisas)
function _rampa(v, a, b) = v <= a ? 0 : v >= b ? 1 : let(u = (v - a) / (b - a)) u * u * (3 - 2 * u);
function desloc(a, z) = (_tex() == "Liso") ? 0 : _A() * padrao(a, z) * _rampa(z, 1.2, 3) * _rampa(z_topo(a) - z, 1.2, 3);
