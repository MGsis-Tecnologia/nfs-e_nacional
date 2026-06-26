import React, { useState } from 'react';
import { Database, ShieldCheck } from 'lucide-react';
import { setAuth } from '../api';

export default function SetupWizard({ status, onShowToast, onDone }) {
  // Passo 1 (banco) só aparece se o banco ainda não está acessível.
  const [step, setStep] = useState(status.databaseReachable ? 2 : 1);
  const [db, setDb] = useState({ host: 'localhost', port: '5432', user: 'postgres', password: '', database: 'nfse', schema: 'public' });
  const [admin, setAdmin] = useState({ username: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const submitDb = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/setup/database', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(db)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao configurar o banco.');
      onShowToast('Banco conectado e tabelas criadas!', 'success');
      setStep(2);
    } catch (err) { onShowToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  const submitAdmin = async (e) => {
    e.preventDefault();
    if (admin.password !== admin.confirm) return onShowToast('As senhas não coincidem.', 'error');
    if (admin.password.length < 6) return onShowToast('A senha deve ter ao menos 6 caracteres.', 'error');
    setLoading(true);
    try {
      const res = await fetch('/api/setup/admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: admin.username, password: admin.password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao criar administrador.');
      setAuth(data.token, data.username);
      onShowToast('Administrador criado! Bem-vindo.', 'success');
      onDone();
    } catch (err) { onShowToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  const inp = (obj, set, key) => (e) => set({ ...obj, [key]: e.target.value });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: 520 }}>
        <h2 style={{ color: '#FFF', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          {step === 1 ? <Database /> : <ShieldCheck />} Configuração inicial
        </h2>
        <p className="page-subtitle">{step === 1 ? 'Passo 1 de 2 — Conexão com o PostgreSQL' : 'Passo 2 de 2 — Criar usuário administrador'}</p>

        {step === 1 ? (
          <form onSubmit={submitDb} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="form-grid">
              <div className="form-group col-8"><label className="form-label">Host</label>
                <input className="form-input" value={db.host} onChange={inp(db, setDb, 'host')} required /></div>
              <div className="form-group col-4"><label className="form-label">Porta</label>
                <input className="form-input" value={db.port} onChange={inp(db, setDb, 'port')} required /></div>
              <div className="form-group col-6"><label className="form-label">Usuário</label>
                <input className="form-input" value={db.user} onChange={inp(db, setDb, 'user')} required /></div>
              <div className="form-group col-6"><label className="form-label">Senha</label>
                <input type="password" className="form-input" value={db.password} onChange={inp(db, setDb, 'password')} /></div>
              <div className="form-group col-8"><label className="form-label">Banco (database)</label>
                <input className="form-input" value={db.database} onChange={inp(db, setDb, 'database')} required /></div>
              <div className="form-group col-4"><label className="form-label">Schema</label>
                <input className="form-input" value={db.schema} onChange={inp(db, setDb, 'schema')} /></div>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              O banco precisa existir e o usuário ter permissão para criar tabelas. Os dados são gravados no arquivo <code>.env</code>.
            </span>
            <button className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-end' }}>
              {loading ? 'Conectando...' : 'Conectar e criar tabelas'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="form-group"><label className="form-label">Usuário admin</label>
              <input className="form-input" value={admin.username} onChange={inp(admin, setAdmin, 'username')} required autoFocus /></div>
            <div className="form-group"><label className="form-label">Senha (mín. 6)</label>
              <input type="password" className="form-input" value={admin.password} onChange={inp(admin, setAdmin, 'password')} required /></div>
            <div className="form-group"><label className="form-label">Confirmar senha</label>
              <input type="password" className="form-input" value={admin.confirm} onChange={inp(admin, setAdmin, 'confirm')} required /></div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Ao concluir, os dados do emissor atual (se existirem) serão migrados automaticamente.
            </span>
            <button className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-end' }}>
              {loading ? 'Criando...' : 'Criar administrador e entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
