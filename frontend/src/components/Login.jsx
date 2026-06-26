import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { setAuth } from '../api';

export default function Login({ onShowToast, onLogged }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha no login.');
      setAuth(data.token, data.username);
      onLogged();
    } catch (err) { onShowToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <form onSubmit={submit} className="card" style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="brand-icon" style={{ margin: '0 auto 0.5rem' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFF' }}>Foz</span>
          </div>
          <h2 style={{ color: '#FFF', margin: 0 }}>Emissor NFS-e</h2>
          <p className="page-subtitle">Acesso do administrador</p>
        </div>
        <div className="form-group"><label className="form-label">Usuário</label>
          <input className="form-input" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus /></div>
        <div className="form-group"><label className="form-label">Senha</label>
          <input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <button className="btn btn-primary" disabled={loading} style={{ justifyContent: 'center' }}>
          <LogIn size={18} /> {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
