// Helpers partilhados para escrever parâmetros como variáveis OpenSCAD.
//
// Antes, preview.js e download.js escreviam `nome = "${v}";` sem escapar aspas
// nem validar o nome da chave — um valor com `"` partia o ficheiro (ou permitia
// injectar código SCAD, p.ex. import/include de ficheiros do servidor).

const SAFE_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Escapa uma string para um literal SCAD entre aspas. */
export function escapeScadString(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, ' ');
}

/**
 * Converte params em linhas `chave = valor;`.
 * Descarta (com aviso) chaves inválidas e valores que não sejam
 * string / número finito / booleano.
 */
export function scadVars(params) {
  const linhas = [];
  for (const [k, v] of Object.entries(params || {})) {
    if (!SAFE_KEY_RE.test(k)) {
      console.warn(`scadVars: chave ignorada (inválida): ${JSON.stringify(k)}`);
      continue;
    }
    if (typeof v === 'string') {
      linhas.push(`${k} = "${escapeScadString(v)}";`);
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      linhas.push(`${k} = ${v};`);
    } else if (typeof v === 'boolean') {
      linhas.push(`${k} = ${v};`);
    } else if (v !== null && v !== undefined) {
      console.warn(`scadVars: valor ignorado em "${k}" (tipo ${typeof v})`);
    }
  }
  return linhas.join('\n');
}
