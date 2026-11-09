// Gera scripts/insert_natal_deco/<modelo>.sql — os modelos de Natal da família "Decoração"
// (rascunho). O scad_template na BD só faz include do ficheiro montado por
// templates/decoracao/montar.sh, que vai na imagem do servidor (/app/templates/...): mudar um
// destes modelos é só mudar o .scad e fazer deploy. Os parâmetros que o servidor acrescenta
// depois do include ganham (o include é textual e o OpenSCAD fica com a última atribuição).
// Uso: sh templates/decoracao/montar.sh && node scripts/insert_natal_deco.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dados = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/natalDeco.json'), 'utf8'));

let ordem = 0;
const P = (o) => ({ order: ++ordem, ...o });
const slider = (label, min, max, step, def, unit, extra = {}) => P({ type: 'number', min, max, unit, default: def, ui: { label, widget: 'slider', step, ...extra } });
const select = (label, options, def, extra = {}) => P({ default: def, ui: { label, widget: 'select', options, ...extra } });
const check = (label, def, extra = {}) => P({ type: 'boolean', default: def, ui: { label, widget: 'checkbox', ...extra } });
const texto = (label, def, max) => P({ default: def, ui: { label, widget: 'text', maxLength: max } });
const info = (text) => ({ order: 99, default: null, ui: { widget: 'info', text } });
const oculto = (v) => ({ order: 0, default: v, ui: { widget: 'hidden' } });
const VELA_INFO = 'Recomendamos velas LED (as cavidades são para velas de chá LED, 38 × 16 mm, com folga). Nunca uses velas a sério: o plástico amolece e arde.';

const MODELOS = [];
const modelo = (id, nome, descricao, tags, params) => { ordem = 0; MODELOS.push({ id, nome, descricao, tags, params: params() }); };

modelo('rena', 'Rena com Estrias', 'Rena decorativa de Natal com o corpo às estrias, cabeça redonda, hastes e orelhas. Imprime de pé, sem suportes.',
  ['rena', 'natal', 'decoração', 'estrias'], () => ({
    deco: oculto('rena'),
    altura: slider('Altura (sem as hastes)', 60, 220, 1, 130, 'mm'),
    largura: slider('Largura', 30, 120, 1, 60, 'mm'),
    estrias: slider('Número de estrias', 8, 60, 1, 24),
    relevo: slider('Fundura das estrias', 0, 4, 0.1, 1.5, 'mm'),
    hastes: slider('Tamanho das hastes', 50, 160, 5, 100, '%'),
    orelhas: check('Orelhas', true),
    info_rena: info('🦌 Imprime de pé, sem suportes. Faz várias em tamanhos e cores diferentes (castanho, bege, verde, vermelho) para uma família de renas. Dica: enchimento baixo (5–10 %).'),
  }));
modelo('anjo', 'Anjo com Estrias', 'Anjo de Natal com saia às estrias, cabeça redonda, asas e auréola. Imprime de pé, sem suportes.',
  ['anjo', 'natal', 'decoração', 'estrias'], () => ({
    deco: oculto('anjo'),
    altura: slider('Altura', 60, 200, 1, 110, 'mm'),
    largura: slider('Largura da saia', 30, 120, 1, 60, 'mm'),
    estrias: slider('Número de estrias', 8, 60, 1, 24),
    relevo: slider('Fundura das estrias', 0, 4, 0.1, 1.5, 'mm'),
    asas: slider('Tamanho das asas', 50, 160, 5, 100, '%'),
    aureola: check('Auréola', true),
    info_anjo: info('👼 Imprime de pé, sem suportes. Fica bonito em branco ou bege, com a auréola a dourado (troca de cor na camada onde a cabeça acaba).'),
  }));
modelo('gorro_bombom', 'Gorro Porta-bombom', 'Gorro de Natal com pompom que se põe por cima de um bombom (tipo Ferrero Rocher), e base canelada onde o bombom assenta. Lembrança de Natal para a mesa ou para oferecer.',
  ['gorro', 'bombom', 'ferrero', 'natal', 'mesa', 'lembrança'], () => ({
    deco: oculto('gorro_bombom'),
    diametro_bombom: slider('Diâmetro do bombom', 18, 50, 0.5, 31, 'mm'),
    altura: slider('Altura do gorro', 25, 100, 1, 45, 'mm'),
    estrias: slider('Número de estrias da dobra', 12, 60, 1, 28),
    pompom: check('Pompom', true),
    pecas: select('Peças', ['Gorro e base', 'Só o gorro', 'Só a base'], 'Gorro e base'),
    info_gorro: info('🎅 31 mm é o tamanho de um Ferrero Rocher. O gorro e a base saem lado a lado: imprime o gorro a vermelho e a base a branco (ou troca de cor por cima da dobra canelada). Sem suportes.'),
  }));
modelo('casinha', 'Casinha Lanterna', 'Casinha oca com janelas, porta e chaminé, aberta em baixo para pôr por cima de uma vela LED. Faz uma aldeia de Natal com várias medidas.',
  ['casinha', 'casa', 'lanterna', 'LED', 'natal', 'aldeia'], () => ({
    deco: oculto('casinha'),
    largura: slider('Largura (frente)', 40, 160, 1, 60, 'mm'),
    profundidade: slider('Profundidade', 30, 160, 1, 50, 'mm'),
    altura: slider('Altura das paredes', 25, 160, 1, 50, 'mm'),
    inclinacao: slider('Inclinação do telhado', 40, 60, 1, 45, '°'),
    janelas: slider('Janelas atrás e em cada lado', 0, 4, 1, 2),
    chamine: check('Chaminé', true),
    parede: slider('Espessura das paredes', 1.2, 4, 0.1, 2, 'mm'),
    info_casinha: info('🏠 Aberta em baixo: põe-na por cima de uma vela LED. Imprime de pé, sem suportes. Em branco ou bege a luz passa pelas paredes; em cores escuras só se vê pelas janelas. ' + VELA_INFO),
  }));
modelo('cena_led', 'Cena de Natal com Luz', 'Moldura em círculo, estrela ou arco com uma cena de Natal em silhueta (renas, pinheiros, presépio, trenó ou casinhas), de pé numa base com uma vela LED por trás.',
  ['cena', 'silhueta', 'presépio', 'renas', 'LED', 'natal', 'moldura'], () => ({
    deco: oculto('cena_led'),
    moldura: select('Moldura', Object.keys(dados.molduras), 'Círculo'),
    cena: select('Cena', Object.keys(dados.cenas), 'Renas'),
    largura: slider('Largura da moldura', 70, 220, 1, 120, 'mm'),
    espessura: slider('Espessura da moldura', 2.4, 8, 0.2, 4, 'mm'),
    diametro_vela: slider('Diâmetro da cavidade da vela', 30, 60, 0.5, 39.5, 'mm'),
    pecas: select('Peças', ['Moldura e base', 'Só a moldura', 'Só a base'], 'Moldura e base'),
    info_cena: info('✨ A moldura e a base imprimem-se deitadas, lado a lado, sem suportes; depois a moldura encaixa de pé na ranhura da base (a pré-visualização mostra-a montada). A vela LED fica atrás da cena. ' + VELA_INFO),
  }));
modelo('silhueta_porta', 'Silhueta de Natal para Porta', 'Cena de Natal em silhueta (trenó, renas, pinheiros, presépio ou casinhas) para pôr em cima do aro de uma porta, de uma janela ou numa prateleira, com aba de apoio atrás.',
  ['silhueta', 'porta', 'trenó', 'renas', 'natal', 'parede'], () => ({
    deco: oculto('silhueta_porta'),
    cena: select('Cena', Object.keys(dados.cenas), 'Trenó'),
    largura: slider('Largura', 80, 250, 1, 220, 'mm'),
    espessura: slider('Espessura', 2, 6, 0.2, 3, 'mm'),
    aba: slider('Aba de apoio (0 = sem aba)', 0, 40, 1, 15, 'mm'),
    espelhar: check('Virada para o outro lado', false),
    info_silhueta: info('🚪 Imprime deitada (a aba fica de pé, ao longo do chão da cena). A aba assenta em cima do aro da porta; fixa com fita-cola de dupla face ou massa adesiva. Fica muito bem a preto.'),
  }));
const Z = dados.arvore_zonas;
modelo('arvore_nomes', 'Árvore de Natal com Nomes', 'Árvore de Natal plana com os nomes da família em relevo (um em cada ramo) e uma estrela, de pé numa base com duas velas LED à frente.',
  ['árvore', 'nomes', 'família', 'personalizado', 'LED', 'natal'], () => ({
    deco: oculto('arvore_nomes'),
    nome1: texto('Nome no ramo de baixo', 'Maria', 16),
    nome2: texto('Nome no 2.º ramo', 'João', 14),
    nome3: texto('Nome no 3.º ramo', 'Ana', 12),
    nome4: texto('Nome no ramo de cima', 'Rui', 8),
    fonte: select('Tipo de letra', ['Luckiest Guy', 'Chewy', 'Baloo 2', 'Sigmar One', 'Pacifico', 'Lobster', 'Open Sans'], 'Luckiest Guy'),
    largura: slider('Largura da árvore', 80, 240, 1, 140, 'mm'),
    espessura: slider('Espessura da árvore', 2.4, 8, 0.2, 4, 'mm'),
    diametro_vela: slider('Diâmetro das cavidades das velas', 30, 60, 0.5, 39.5, 'mm'),
    pecas: select('Peças', ['Árvore e base', 'Só a árvore', 'Só a base'], 'Árvore e base'),
    info_arvore: info('🎄 Os nomes encolhem sozinhos para caber no ramo (deixa um vazio para não ter nome). A árvore e a base imprimem-se deitadas, sem suportes; a árvore encaixa de pé na ranhura da base. Dica: troca de cor na camada onde começam os nomes (verde → dourado). ' + VELA_INFO),
  }), );

const ajuste = {
  arvore_nomes: {
    campos: ['nome1', 'nome2', 'nome3', 'nome4'], largura_util: Z[0][2],
    largura_por_campo: Object.fromEntries(Z.map((z, i) => [`nome${i + 1}`, z[2]])),
    tamanho_por_campo: Object.fromEntries(Z.map((z, i) => [`nome${i + 1}`, z[3]])),
  },
};

const dir = path.join(ROOT, 'scripts/insert_natal_deco');
fs.mkdirSync(dir, { recursive: true });
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
for (const m of MODELOS) {
  if (!fs.existsSync(path.join(ROOT, `templates/decoracao/${m.id}.scad`))) throw new Error(`falta templates/decoracao/${m.id}.scad (montar.sh)`);
  const tpl = `// ${m.nome} — o modelo está em templates/decoracao/partes/${m.id}.scad (backend)\ninclude </app/templates/decoracao/${m.id}.scad>\n`;
  const schema = { engine: 'openscad', version: 1, parameters: m.params, ...(ajuste[m.id] ? { ajuste_texto: ajuste[m.id] } : {}) };
  const sql = `-- Gerado por scripts/insert_natal_deco.mjs — "${m.nome}" (rascunho, família Decoração)
insert into prod_designs (id, nome, descricao, familia, estado, acesso_maker, disponivel_consumidor, capa_familia, usa_modo, tags, preco_creditos, scad_template, generation_schema, parametros_default)
values (${q(m.id)}, ${q(m.nome)}, ${q(m.descricao)}, 'Decoração', 'rascunho', 'gratuito', false, false, false,
  array[${m.tags.map(q).join(', ')}], 1, $tpl$${tpl}$tpl$, ${q(JSON.stringify(schema))}::jsonb, '{}'::jsonb)
on conflict (id) do update set nome = excluded.nome, descricao = excluded.descricao, tags = excluded.tags,
  scad_template = excluded.scad_template, generation_schema = excluded.generation_schema;
`;
  fs.writeFileSync(path.join(dir, `${m.id}.sql`), sql);
  console.log(m.id, (sql.length / 1024).toFixed(1), 'KB');
}
