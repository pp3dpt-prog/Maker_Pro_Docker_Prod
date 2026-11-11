// Larguras úteis e tamanhos das letras dos nomes da Árvore de Natal com Nomes, por número de ramos
// — as mesmas contas de templates/decoracao/partes/arvore_nomes.scad (ramo/zona). Gera o
// "ajuste_texto.por_param" do generation_schema (lib/textFit.js): node scripts/arvore_zonas.mjs
export function zonasArvore(n) {
  const passo = Math.min(9.5, 28.5 / (n - 1));
  return Array.from({ length: n }, (_, i) => {
    const hw = 50 - passo * i, yb = 11 + 24 * i, topo = i === n - 1, alt = topo ? 40 : 36, ht = topo ? 0 : hw * 0.3;
    const tam = 10.5 - (1.5 * i) / (n - 1), cy = yb + 11;
    const meia = hw - ((hw - ht) * (cy + tam * 0.55 - yb)) / alt;
    return [0, cy, Math.round((2 * meia - 8) * 10) / 10, tam];
  });
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const tabela = {};
  for (let n = 2; n <= 7; n++) {
    const z = zonasArvore(n);
    tabela[n] = { largura: Object.fromEntries(z.map((q, i) => [`nome${i + 1}`, q[2]])), tamanho: Object.fromEntries(z.map((q, i) => [`nome${i + 1}`, Math.round(q[3] * 1000) / 1000])) };
  }
  console.log(JSON.stringify({ param: 'num_ramos', omissao: '4', tabela }));
}
