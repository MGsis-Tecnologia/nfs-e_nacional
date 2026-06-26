import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit, CheckCircle2, AlertTriangle } from 'lucide-react';
import EmissorForm from './EmissorForm';
import { apiJson } from '../api';

export default function Emissores({ onShowToast, onChanged }) {
  const [lista, setLista] = useState([]);
  const [editando, setEditando] = useState(null); // emissor | 'novo' | null

  const carregar = async () => {
    try { setLista(await apiJson('/api/emissores')); }
    catch (err) { onShowToast(err.message, 'error'); }
  };
  useEffect(() => { carregar(); }, []);

  const aoSalvar = async () => { setEditando(null); await carregar(); onChanged && onChanged(); };

  if (editando) {
    return <EmissorForm emissor={editando === 'novo' ? null : editando} onSaved={aoSalvar} onCancel={() => setEditando(null)} onShowToast={onShowToast} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={() => setEditando('novo')}><Plus size={18} /> Novo Emissor</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {lista.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum emissor cadastrado.</div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead><tr><th>Razão Social</th><th>CNPJ</th><th>Ambiente</th><th>Certificado</th><th style={{ textAlign: 'right' }}>Ações</th></tr></thead>
              <tbody>
                {lista.map((e) => (
                  <tr key={e.id}>
                    <td><div style={{ fontWeight: 600, color: '#FFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Building2 size={16} /> {e.razaoSocial}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.nomeFantasia || ''}</div></td>
                    <td>{e.cnpj}</td>
                    <td><span className={`badge ${e.ambiente === '1' ? 'badge-error' : 'badge-pending'}`}>{e.ambiente === '1' ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO'}</span></td>
                    <td>{e.certConfigured
                      ? <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle2 size={14} /> OK</span>
                      : <span style={{ color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><AlertTriangle size={14} /> Pendente</span>}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '0.45rem' }} onClick={() => setEditando(e)} title="Editar"><Edit size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
