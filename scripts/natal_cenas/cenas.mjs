import { uniao, arredondar, mover, traco, rect, caixa, semBuracos } from './lib.mjs';
import { rena, pinheiro, chao, maria, jose, manjedoura, ovelha, estrelaBelem, estabulo, treno } from './formas.mjs';
const P = (x, y) => `${x.toFixed(2)} ${(-y).toFixed(2)}`;
// Cenas desenhadas com curvas (chão: faixa de y = −3 a 0,6, como o CHAO de gerar_natal_deco.mjs);
// o gerador normaliza-as a 100 mm de largura.
export const CENAS = {};
CENAS['Renas'] = arredondar(uniao([
  ...rena(-40, 0.6),                    // rena grande, virada para a direita
  ...rena(50, 0.44, true),               // a pequena, virada para a esquerda
  ...pinheiro(-52, 46), ...pinheiro(-40, 26), ...pinheiro(52, 34), ...pinheiro(61, 22),
  ...chao(-62, 68, [[-12, 16, 2.2], [22, 18, 1.8]]),
]), 0.15, 0.5);
CENAS['Presépio'] = (() => {
  const W = 74, H = 44, HR = 16;
  return arredondar(uniao([
    ...estabulo(W, H, HR),
    ...estrelaBelem(0, H + HR + 12, 8),
    ...traco(`M ${P(0, H + HR + 12)} L ${P(0, H + HR - 2)}`, 1.5),   // o raio de baixo, grosso o bastante para segurar a estrela
    ...maria(-33, 0.8),
    ...jose(36, 0.86, true),
    ...manjedoura(0.95),
    ...ovelha(-36.5, 0.7),
    ...chao(-46, 46),
  ]), 0.15, 0.5);
})();
CENAS['Trenó'] = (() => {
  const t = treno(-48, 1);
  const r1 = rena(-2, 0.4), r2 = rena(26, 0.4);
  // tirantes do trenó às renas (passam pelo peito de cada uma)
  const tir = [...traco(`M ${P(-18.5, 22)} C ${P(-12, 21)} ${P(-4, 22)} ${P(25.5, 23)}`, 1.3), ...traco(`M ${P(25.5, 23)} L ${P(54, 23.6)}`, 1.3)];
  return arredondar(uniao([...t, ...r1, ...r2, ...tir, ...pinheiro(64, 30), ...pinheiro(56, 18), ...chao(-54, 72, [[-30, 20, 2], [30, 26, 2.4]])]), 0.15, 0.5);
})();

for (const k of Object.keys(CENAS)) CENAS[k] = semBuracos(CENAS[k], 4);
