'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function EditorControls({ produto, perfil, onUpdate, onGerarSucesso, stlUrl }: any) {
  const [loading, setLoading] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [localValores, setLocalValores] = useState<any>({});
  const [saldoAtual, setSaldoAtual] = useState(perfil?.creditos_disponiveis ?? 0);

  const custoDinamico = produto?.custo_creditos ?? 1;

  // Sincroniza o saldo local quando o perfil vindo do pai (layout/page) é carregado
  useEffect(() => { 
    if (perfil) setSaldoAtual(perfil.creditos_disponiveis); 
  }, [perfil]);

  // Inicializa os parâmetros do design com base no produto selecionado
  useEffect(() => {
    if (produto) {
      const iniciais: any = { ...(produto.parametros_default || {}) };
      if (produto.ui_schema) {
        produto.ui_schema.forEach((c: any) => {
          if (c.name) iniciais[c.name] = (c.value !== undefined) ? c.value : c.default;
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
    // Verificação de segurança: impede o erro "Perfil não encontrado" se o ID estiver ausente
    if (!perfil?.id) {
      return alert("Erro: Perfil de utilizador não carregado. Por favor, faz refresh à página.");
    }

    if (saldoAtual < custoDinamico) {
      return alert(`Saldo insuficiente. Precisas de ${custoDinamico} créditos.`);
    }

    if (!confirm(`Confirmas o gasto de ${custoDinamico} crédito(s)?`)) return;

    setLoading(true);
    setProgresso(5);

    // Incremento visual da barra de progresso durante a renderização
    const interval = setInterval(() => { 
      setProgresso((prev) => (prev < 90 ? prev + 3 : prev)); 
    }, 1500);

    try {
      const petName = localValores.nome_pet ? String(localValores.nome_pet).toLowerCase().replace(/\s+/g, '_') : 'objeto';
      
      const r = await fetch("https://maker-pro-docker-prod.onrender.com/gerar-stl-pro", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...localValores, 
          id: produto.id, 
          user_id: perfil.id, // O ID é enviado para o servidor ler o perfil e descontar
          nome_personalizado: `${produto.id}_${petName}`,
          custo: custoDinamico 
        }),
      });
      
      const d = await r.json();

      if (r.ok && (d.url || d.urls)) {
        setProgresso(100);
        // O servidor devolve o novo saldo após o desconto bem-sucedido
        if (d.novoSaldo !== undefined) setSaldoAtual(d.novoSaldo);
        onGerarSucesso(d.urls || d.url);
      } else {
        alert("Erro: " + (d.error || "Ocorreu um erro no servidor."));
        setProgresso(0);
      }
    } catch (err) { 
      alert("Erro ao conectar com o servidor de renderização."); 
      setProgresso(0);
    } finally { 
      clearInterval(interval); 
      setLoading(false); 
      setTimeout(() => setProgresso(0), 4000); 
    }
  };

  const handleDownloadSimples = () => {
    if (!stlUrl) return;
    const petName = localValores.nome_pet ? String(localValores.nome_pet).toLowerCase() : 'design';
    const finalUrl = Array.isArray(stlUrl) ? stlUrl[0] : stlUrl;
    
    const link = document.createElement('a');
    link.href = finalUrl;
    link.setAttribute('download', `${produto.id}_${petName}.stl`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const seccoes = Array.from(new Set(produto?.ui_schema?.filter((c: any) => c.section && c.section !== 'GESTÃO').map((c: any) => c.section))) as string[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {seccoes.map((s) => (
        <div key={s} style={{ background: '#0f172a', padding: '15px', borderRadius: '12px', border: '1px solid #334155' }}>
          <label style={{ color: '#3b82f6', fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>{s.toUpperCase()}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {produto.ui_schema.filter((c: any) => c.section === s && c.type !== 'hidden').map((c: any) => (
              <div key={c.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '10px', color: '#64748b' }}>{c.label || c.name}</label>
                  {/* Exibição dinâmica do valor em milímetros */}
                  {(c.type === 'slider' || c.type === 'number') && (
                    <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 'bold' }}>
                      {localValores[c.name] ?? 0} mm
                    </span>
                  )}
                </div>

                {c.name === 'fonte' ? (
                  <select 
                    value={localValores[c.name] || 'Open Sans'}
                    onChange={(e) => handleChange(c.name, e.target.value)}
                    style={{ width: '100%', padding: '10px', background: '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: '8px' }}
                  >
                    <option value="Open Sans">Open Sans</option>
                    <option value="Bebas">Bebas Neue</option>
                    <option value="Playfair">Playfair Display</option>
                    <option value="Beaver Punch">Beaver Punch</option>
                    <option value="GABRWFER">Gabriel Weiss Friends</option>
                    <option value="Megadeth">Megadeth</option>
                  </select>
                ) : (
                  <input 
                    type={c.type === 'slider' ? 'range' : (c.type === 'number' ? 'number' : 'text')}
                    min={c.min} max={c.max} step={0.1}
                    value={localValores[c.name] ?? ''}
                    onChange={(e) => handleChange(c.name, (c.type === 'slider' || c.type === 'number') ? parseFloat(e.target.value) : e.target.value)}
                    style={{ width: '100%', padding: '10px', background: '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: '8px' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ background: '#0f172a', padding: '15px', borderRadius: '15px', border: '1px solid #1e293b' }}>
        {loading && (
          <div style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#3b82f6', marginBottom: '5px' }}>
              <span>PROCESSANDO...</span><span>{progresso}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: '#1e293b', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ width: `${progresso}%`, height: '100%', background: '#3b82f6', transition: 'width 0.4s ease' }}></div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>TEU SALDO:</span>
          <span style={{ fontSize: '12px', color: saldoAtual >= custoDinamico ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>
            {saldoAtual} CRÉDITOS
          </span>
        </div>
        
        <button 
          onClick={handleGerarSTL} 
          disabled={loading || saldoAtual < custoDinamico} 
          style={{ width: '100%', padding: '15px', background: loading ? '#1e293b' : '#3b82f6', color: 'white', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: loading ? 'default' : 'pointer' }}
        >
          {loading ? "A GERAR..." : `🔨 GERAR DESIGN (${custoDinamico} CRÉD.)`}
        </button>

        {/* Botão de download só aparece após a geração bem-sucedida */}
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