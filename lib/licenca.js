// Modelos só para makers com licença comercial (prod_designs.requer_licenca_comercial = true).
//
// A licença vem do plano do utilizador: prod_perfis.plano é o tier e prod_planos.permite_venda_comercial
// diz se esse plano a inclui (hoje: pessoal_plus / Fundador Pro e comercial). Os admins passam sempre.
// O frontend já esconde o botão (acesso_maker); isto garante o mesmo do lado do servidor, na
// transferência (routes/download.js) e no STL final (routes/gerar-stl-pro.js).

export async function temLicencaComercial(supabase, userId) {
  if (!userId) return false;
  const { data: perfil } = await supabase
    .from('prod_perfis').select('plano, role').eq('id', userId).maybeSingle();
  if (!perfil) return false;
  if (perfil.role === 'admin') return true;
  if (!perfil.plano) return false;
  const { data: planos } = await supabase
    .from('prod_planos').select('permite_venda_comercial').eq('tier', perfil.plano);
  return (planos ?? []).some(p => p.permite_venda_comercial === true);
}
