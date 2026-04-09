'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function EditorControls({ produto, perfil, onUpdate, onGerarSucesso, stlUrl }: any) {
  const [loading, setLoading] = useState(false);
  const [localValores, setLocalValores] = useState<any>({});
  const [saldoAtual, setSaldoAtual] = useState(perfil?.creditos_disponiveis ?? 0);

  const custoDinamico = produto.custo_creditos ?? 1;

  useEffect(() => {
    setSaldoAtual(perfil?.creditos_disponiveis ?? 0);
  }, [perfil]);

  useEffect(() => {
    if (produto) {
      const iniciais: any = { ...(produto.parametros_default || {}) };
      if (produto.ui_schema) {
        produto.ui_schema.forEach((c: any) => {
          if (c.name) iniciais[c.name] = c.value !== undefined ? c.value : c.default;
        });
      }
      if (!iniciais.fonte) iniciais.fonte = 'Open Sans';
      setLocalValores(iniciais);
      onUpdate(iniciais);
    }
  }, [produto?.id]);

  const handleChange = (k: string, v: any) => {
    const n = { ...localValores, [k]: v };
    setLocalValores(n);
    onUpdate(n);
  };

  const handleGerarSTL = async () => {
    if (saldoAtual < custoDinamico) {
      return alert(`Não tens créditos suficientes. Este design requer ${custoDinamico} créditos.`);
    }
    
    const confirmar = custoDinamico === 0 
      ? confirm("Desejas gerar este design gratuito?")
      : confirm(`Isto irá consumir ${custoDinamico} crédito(s) para gerar e guardar este design na tua conta. Continuar?`);
    
    if (!confirmar) return;

    setLoading(true);
    try {
      const petName = localValores.nome_pet ? String(localValores.nome_pet).toLowerCase() : 'objeto';
      const nomeGerado = `${produto.id}_${petName}`;

      const r = await fetch("https://maker-pro-docker-prod.onrender.com/gerar-stl-pro", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...localValores, 
          id: produto.id,
          user_id: perfil.id,
          nome_personalizado: nomeGerado 
        }),
      });
      
      const d = await r.json();

      if (d.url || d.urls) {
        if (custoDinamico > 0) {
          const { error } = await supabase
            .from('prod_perfis')
            .update({ creditos_disponiveis: saldoAtual - custoDinamico })
            .eq('id', perfil.id);

          if (error) throw error;
          setSaldoAtual(prev => prev - custoDinamico);
        }

        onGerarSucesso(d.urls || d.url);
        alert(custoDinamico === 0 ? "Design gerado com sucesso!" : "Design gerado e guardado na tua Área de Cliente!");
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao processar o modelo.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSimples = () => {
    if (!stlUrl) return;
    const petName = localValores.nome_pet ? String(localValores.nome_pet).toLowerCase() : 'design';
    const link = document.createElement('a');
    link.href = Array.isArray(stlUrl) ? stlUrl[0] : stlUrl;
    link.setAttribute('download', `${produto.id}_${petName}.stl`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const seccoes = Array.from(new Set(produto?.ui_schema?.filter((c: any) => c.section && c.section !== 'GESTÃO').map((c: any) => c.section)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {seccoes.map((s: any) => (
        <div key={s} style={{ background: '#0f172a', padding: '15px', borderRadius: '12px', border: '1px solid #334155' }}>
          <label style={{ color: '#3b82f6', fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>{String(s).toUpperCase()}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {produto.ui_schema.filter((c: any) => c.section === s && c.type !== 'hidden').map((c: any) => (
              <div key={c.name}>
                
                {/* --- AQUI ESTÁ A CORREÇÃO REAL --- */}
                <label style={{ fontSize: '10px', color: '#64748b' }}>
                  {c.label || c.name} {(c.type === 'number' || c.type === 'slider') ? '(mm)' : ''}
                </label>
                {/* ---------------------------------- */}

                {c.name === 'fonte' ? (
                  <select 
                    value={localValores[c.name] || 'Open Sans'}
                    onChange={(e) => handleChange(c.name, e.target.value)}
                    style={{ width: '100%', padding: '10px', background: '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: '8px', marginTop: '5px' }}
                  >
                    <option value="Open Sans">Open Sans</option>
                    <option value="Bebas">Bebas Neue</option>
                    <option value="Playfair">Playfair Display</option>
                    <option value="Beaver Punch">Beaver Punch</option>
                    <option value="GABRWFER">Gabriel Weiss' Friends</option>
                    <option value="Megadeth">Megadeth</option>
                  </select>
                ) : (
                  <input 
                    type={c.type === 'slider' ? 'range' : (c.type === 'number' ? 'number' : 'text')}
                    min={c.min} max={c.max} step={0.1}
                    value={localValores[c.name] ?? ''}
                    onChange={(e) => handleChange(c.name, (c.type === 'slider' || c.type === 'number') ? parseFloat(e.target.value) : e.target.value)}
                    style={{ width: '100%', padding: '10px', background: '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: '8px', marginTop: '5px' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ background: '#0f172a', padding: '15px', borderRadius: '15px', border: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>SALDO:</span>
          <span style={{ fontSize: '12px', color: saldoAtual >= custoDinamico ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>{saldoAtual} CRÉDITOS</span>
        </div>
        
        <button 
          onClick={handleGerarSTL} 
          disabled={loading || saldoAtual < custoDinamico} 
          style={{ width: '100%', padding: '15px', background: '#3b82f6', color: 'white', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? "A PROCESSAR..." : (
            custoDinamico === 0 
              ? "🔨 GERAR DESIGN (GRÁTIS)" 
              : `🔨 GERAR E GUARDAR DESIGN (${custoDinamico} CRÉDITO${custoDinamico > 1 ? 'S' : ''})`
          )}
        </button>

        {stlUrl && (
          <button 
            onClick={handleDownloadSimples}
            style={{ width: '100%', marginTop: '15px', padding: '15px', background: 'transparent', border: '1px solid #4ade80', color: '#4ade80', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            📥 DESCARREGAR AGORA
          </button>
        )}
      </div>
    </div>
  );
}