/**
 * fix-hueforge-template.js
 *
 * Atualiza o scad_template de todos os designs com familia='hueforge'
 * para usar surface(file = image_path) em vez de import('/app/temp/input.svg').
 *
 * Uso:
 *   SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/fix-hueforge-template.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL      || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltam variáveis: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Template correto — usa surface() com image_path injetado pelo backend
const NEW_TEMPLATE = readFileSync(join(__dirname, '../templates/hueforge.scad'), 'utf8');

async function main() {
  // 1. Listar designs HueForge
  const { data: designs, error } = await supabase
    .from('prod_designs')
    .select('id, nome, scad_template, familia')
    .ilike('familia', 'hueforge');

  if (error) {
    console.error('❌ Erro ao buscar designs:', error.message);
    process.exit(1);
  }

  if (!designs?.length) {
    console.log('ℹ️  Nenhum design com familia=hueforge encontrado.');
    return;
  }

  console.log(`🔍 Encontrados ${designs.length} design(s) HueForge:`);
  designs.forEach(d => console.log(`   - ${d.id}  "${d.nome}"`));

  // 2. Atualizar cada um
  for (const design of designs) {
    const hasOldImport = design.scad_template?.includes('import(');
    const hasSurface   = design.scad_template?.includes('surface(');

    if (hasSurface && !hasOldImport) {
      console.log(`✅ ${design.nome} — já usa surface(), sem alterações.`);
      continue;
    }

    console.log(`🔧 A atualizar "${design.nome}"...`);

    const { error: updateErr } = await supabase
      .from('prod_designs')
      .update({ scad_template: NEW_TEMPLATE })
      .eq('id', design.id);

    if (updateErr) {
      console.error(`❌ Erro ao atualizar "${design.nome}":`, updateErr.message);
    } else {
      console.log(`✅ "${design.nome}" atualizado com sucesso.`);
    }
  }

  console.log('\n🏁 Migração concluída.');
}

main().catch(err => {
  console.error('❌ Erro inesperado:', err.message);
  process.exit(1);
});
