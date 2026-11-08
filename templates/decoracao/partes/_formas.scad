// ── formas (distância ao centro em função do ângulo, em graus) ──
function r_poligono(a, n) =                          // polígono regular com os cantos a 1 (cantos em 0°, 360/n…)
    let(seg = 360 / n, p = ((a % seg) + seg) % seg - seg / 2) cos(180 / n) / cos(p);
function r_quadrado(a, h, q) =                       // quadrado de meio-lado h com cantos de raio q
    let(c = abs(cos(a)), s = abs(sin(a)), C = h - q)
    (s * h / max(c, 1e-9) <= C) ? h / max(c, 1e-9)
    : (c * h / max(s, 1e-9) <= C) ? h / max(s, 1e-9)
    : let(b = c * C + s * C) b + sqrt(b * b - (2 * C * C - q * q));
function r_hex(a, h) = let(p = ((a + 30) % 60 + 60) % 60 - 30) h / cos(p);   // h = apótema (lados a 0°, 60°…)
