import React, { useState, useEffect } from 'react';
import { Database, Save } from 'lucide-react';
import { apiJson } from '../api';

export default function ConexaoForm({ onShowToast }) {
  const [db, setDb] = useState({ host: 'localhost', port: '5432', user: '', password: '', database: '', schema: 'public' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiJson('/api/admin/connection')
      .then(d => setDb(p => ({ ...p, ...d, password: '' })))
      .catch(() => {});
  }, []);

  const set = (k) => (e) => setDb({ ...db, [k]: e.target.value });

  const salvar = async (e) => {
    e.preventDefault();
    if (!window.confirm('Trocar a conexão? O sistema reconectará ao banco informado. Se for um banco diferente, os dados exibidos mudarão.')) return;
    setLoading(true);
    try {
      await apiJson('/api/admin/connection', { method: 'POST', body: JSON.stringify(db) });
      onShowToast('Conexão atualizada! Recarregando...', 'success');
      setTimeout(() => window.location.reload(), 900);
    } catch (err) { onShowToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={salvar} className="card" style={{ maxWidth: 640 }}>
      <h3 style={{ color: '#FFF', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <Database /> Conexão com o Banco de Dados
      </h3>
      <p className="page-subtitle">Altere o servidor PostgreSQL. A conexão é testada e as tabelas são criadas no destino se necessário.</p>
      <div className="form-grid">
        <div className="form-group col-8"><label className="form-label">Host</label>
          <input className="form-input" value={db.host} onChange={set('host')} required /></div>
        <div className="form-group col-4"><label className="form-label">Porta</label>
          <input className="form-input" value={db.port} onChange={set('port')} required /></div>
        <div className="form-group col-6"><label className="form-label">Usuário</label>
          <input className="form-input" value={db.user} onChange={set('user')} required /></div>
        <div className="form-group col-6"><label className="form-label">Senha</label>
          <input type="password" className="form-input" placeholder="(deixe em branco para manter a atual)" value={db.password} onChange={set('password')} /></div>
        <div className="form-group col-8"><label className="form-label">Banco (database)</label>
          <input className="form-input" value={db.database} onChange={set('database')} required /></div>
        <div className="form-group col-4"><label className="form-label">Schema</label>
          <input className="form-input" value={db.schema} onChange={set('schema')} /></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
        <button type="submit" className="btn btn-primary" disabled={loading}><Save size={18} /> {loading ? 'Testando e salvando...' : 'Testar e salvar conexão'}</button>
      </div>
    </form>
  );
}
