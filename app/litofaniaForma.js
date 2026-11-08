/**
 * Silhuetas para a litofânia "com forma" (enfeites de Natal com foto,
 * recortados em coração, estrela, árvore, etc. em vez de um simples
 * rectângulo). Cada forma é descrita como um teste "está dentro?" num
 * referencial local próprio, construído por união de primitivas simples
 * (círculo, elipse, rectângulo rodado, triângulo, polígono) — o mesmo
 * estilo usado nos moldes de pet-tags em templates/pet_tags/*.scad
 * (ex.: coração = 2 círculos + um quadrado rodado a 45º).
 *
 * `raio` é só uma escala nominal da forma (não tem de ser exacta) — usada
 * por generateLithophaneShapeStl (hueforge-stl.js) para mapear o referencial
 * local para o tamanho físico real da peça.
 */

function dentroCirculo(x, y, cx, cy, r) {
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function dentroElipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx, dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function dentroRectRodado(x, y, cx, cy, w, h, anguloDeg = 0) {
  const a = (-anguloDeg * Math.PI) / 180;
  const dx = x - cx, dy = y - cy;
  const rx = dx * Math.cos(a) - dy * Math.sin(a);
  const ry = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(rx) <= w / 2 && Math.abs(ry) <= h / 2;
}

function dentroTriangulo(x, y, [ax, ay], [bx, by], [cx, cy]) {
  const d = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = d(x, y, ax, ay, bx, by), d2 = d(x, y, bx, by, cx, cy), d3 = d(x, y, cx, cy, ax, ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

function dentroPoligono(x, y, pts) {
  let dentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function pontosEstrela(pontas, rOut, rIn, anguloInicialDeg = 90) {
  return Array.from({ length: pontas * 2 }, (_, i) => {
    const a = ((anguloInicialDeg + i * (180 / pontas)) * Math.PI) / 180;
    const r = i % 2 === 0 ? rOut : rIn;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
}

// ── Formas ───────────────────────────────────────────────────────────────
// `raio` = extensão nominal (não precisa de ser exacta; serve só de escala).
const FORMAS = {
  redondo: {
    raio: 20,
    dentro: (x, y) => dentroCirculo(x, y, 0, 0, 20),
  },

  coracao: {
    raio: 22,
    dentro: (x, y) =>
      dentroCirculo(x, y, -9, 6, 12) ||
      dentroCirculo(x, y, 9, 6, 12) ||
      dentroRectRodado(x, y, 0, -11, 17.7, 17.7, 45),
  },

  estrela: {
    raio: 19,
    dentro: (x, y) => dentroPoligono(x, y, pontosEstrela(5, 19, 8)),
  },

  arvore: {
    raio: 20,
    dentro: (x, y) =>
      dentroTriangulo(x, y, [0, 20], [-7, 7], [7, 7]) ||
      dentroTriangulo(x, y, [0, 13], [-11, 0], [11, 0]) ||
      dentroTriangulo(x, y, [0, 6], [-15, -8], [15, -8]) ||
      dentroRectRodado(x, y, 0, -12, 6, 7),
  },

  flocodeneve: {
    raio: 20,
    dentro: (x, y) => {
      if (dentroCirculo(x, y, 0, 0, 4)) return true;
      for (let k = 0; k < 3; k++) {
        const ang = k * 60;
        if (dentroRectRodado(x, y, 0, 0, 5, 38, ang)) return true;
        for (const dist of [10, 16]) {
          const a = (ang * Math.PI) / 180;
          const cx = dist * Math.sin(a), cy = dist * Math.cos(a);
          if (dentroRectRodado(x, y, cx, cy, 11, 3, ang + 55)) return true;
          if (dentroRectRodado(x, y, cx, cy, 11, 3, ang - 55)) return true;
        }
      }
      return false;
    },
  },

  rena: {
    raio: 22,
    dentro: (x, y) => {
      if (dentroElipse(x, y, 0, -4, 15, 13)) return true; // cabeça
      if (dentroElipse(x, y, -12, 6, 5, 4)) return true;  // orelha esq.
      if (dentroElipse(x, y, 12, 6, 5, 4)) return true;   // orelha dta.
      for (const s of [-1, 1]) {
        if (dentroRectRodado(x, y, s * 9, 16, 4, 20, s * 18)) return true;   // haste
        if (dentroRectRodado(x, y, s * 15, 23, 4, 11, s * -24)) return true; // ramo 1
        if (dentroRectRodado(x, y, s * 5, 25, 4, 10, s * 35)) return true;  // ramo 2
      }
      return false;
    },
  },

  'pai-natal': {
    raio: 22,
    dentro: (x, y) => {
      if (dentroElipse(x, y, 0, -6, 13, 15)) return true;              // cara/barba
      if (dentroRectRodado(x, y, 0, 8, 30, 8)) return true;            // aba do chapéu
      if (dentroTriangulo(x, y, [-14, 9], [14, 9], [4, 23])) return true; // cone do chapéu
      return dentroCirculo(x, y, 6, 22, 4.5);                         // pompom
    },
  },

  casa: {
    raio: 22,
    dentro: (x, y) =>
      dentroPoligono(x, y, [[-13, -17], [13, -17], [13, -1], [-13, -1]]) ||
      dentroTriangulo(x, y, [-17, -2], [17, -2], [0, 15]),
  },

  'boneco-de-gengibre': {
    raio: 22,
    dentro: (x, y) => {
      if (dentroElipse(x, y, 0, 15, 8, 8)) return true;   // cabeça
      if (dentroElipse(x, y, 0, -2, 11, 14)) return true; // corpo
      for (const s of [-1, 1]) {
        if (dentroElipse(x, y, s * 14, 7, 6, 4)) return true;    // braços
        if (dentroElipse(x, y, s * 7, -17, 5.5, 8)) return true; // pernas
      }
      return false;
    },
  },
};

function normalizarNome(forma) {
  return String(forma || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function listaFormas() {
  return Object.keys(FORMAS);
}

export function dentroForma(forma, x, y) {
  const f = FORMAS[normalizarNome(forma)];
  return f ? f.dentro(x, y) : dentroCirculo(x, y, 0, 0, 20); // omissão: redondo
}

export function raioFormaLocal(forma) {
  const f = FORMAS[normalizarNome(forma)];
  return f ? f.raio : 20;
}

/**
 * Ponto mais alto da forma (maior y) por cima do eixo x=0, no referencial
 * local — usado para encostar a argola (furo para pendurar) exactamente no
 * topo de cada forma, sem a definir à mão para cada uma.
 */
export function topoLocalForma(forma, raioLocal) {
  const passos = 400;
  for (let i = 0; i <= passos; i++) {
    const y = raioLocal - (i / passos) * 2 * raioLocal;
    if (dentroForma(forma, 0, y)) return y;
  }
  return 0;
}
