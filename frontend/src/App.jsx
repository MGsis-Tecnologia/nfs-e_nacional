import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, FilePlus, ListCollapse, Building2, Bell, LogOut, Database } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Emissores from './components/Emissores';
import RPSForm from './components/RPSForm';
import RPSList from './components/RPSList';
import SetupWizard from './components/SetupWizard';
import Login from './components/Login';
import ConexaoForm from './components/ConexaoForm';
import ErrorBoundary from './components/ErrorBoundary';
import { apiJson, apiFetch, getToken, getUser, logout } from './api';

export default function App() {
  const [phase, setPhase] = useState('loading'); // loading|setup|login|app
  const [setupStatus, setSetupStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [emissores, setEmissores] = useState([]);
  const [activeEmissorId, setActiveEmissorId] = useState(null);
  const [rpsList, setRpsList] = useState([]);
  const [editingRps, setEditingRps] = useState(null);
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  const activeEmissor = emissores.find(e => e.id === activeEmissorId) || null;

  const checkState = useCallback(async () => {
    try {
      const status = await (await fetch('/api/setup/status')).json();
      setSetupStatus(status);
      if (!status.databaseReachable || !status.adminCreated) { setPhase('setup'); return; }
      if (!getToken()) { setPhase('login'); return; }
      setPhase('app');
    } catch {
      setPhase('setup');
    }
  }, []);

  useEffect(() => { checkState(); }, [checkState]);
  useEffect(() => {
    const h = () => setPhase('login');
    window.addEventListener('nfse-unauth', h);
    return () => window.removeEventListener('nfse-unauth', h);
  }, []);

  const fetchEmissores = useCallback(async () => {
    try {
      const data = await apiJson('/api/emissores');
      setEmissores(data);
      setActiveEmissorId(prev => (prev && data.some(e => e.id === prev)) ? prev : (data[0]?.id || null));
    } catch (err) { showToast(err.message, 'error'); }
  }, []);

  const fetchRpsList = useCallback(async () => {
    if (!activeEmissorId) { setRpsList([]); return; }
    try { setRpsList(await apiJson(`/api/rps?emissorId=${activeEmissorId}`)); }
    catch (err) { showToast(err.message, 'error'); }
  }, [activeEmissorId]);

  useEffect(() => { if (phase === 'app') fetchEmissores(); }, [phase, fetchEmissores]);
  useEffect(() => { if (phase === 'app') fetchRpsList(); }, [phase, activeEmissorId, fetchRpsList]);

  const handleSaveRps = async (rpsData) => {
    try {
      const isEdit = !!rpsData.id;
      const url = isEdit ? `/api/rps/${rpsData.id}` : '/api/rps';
      const body = JSON.stringify({ ...rpsData, emissorId: activeEmissorId });
      const res = await apiFetch(url, { method: isEdit ? 'PUT' : 'POST', body });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Erro ao salvar RPS.'); }
      showToast(isEdit ? 'RPS atualizado!' : 'Novo RPS gerado!', 'success');
      setEditingRps(null);
      await fetchRpsList();
      setActiveTab('list');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleDeleteRps = async (id) => {
    if (!window.confirm('Deseja realmente excluir este RPS?')) return;
    try {
      const res = await apiFetch(`/api/rps/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir RPS.');
      showToast('RPS excluído.', 'success');
      await fetchRpsList();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleSendRps = async (id) => {
    try {
      const res = await apiFetch(`/api/rps/${id}/send`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro no envio.');
      if (data.status === 'Processado') {
        const nfse = data.result?.nfse;
        showToast(nfse?.numero ? `NFS-e nº ${nfse.numero} emitida! (verificação ${nfse.codigoVerificacao || '-'})` : 'NFS-e emitida!', 'success');
      } else {
        const msgs = data.result?.mensagens || [];
        showToast(`Prefeitura rejeitou: ${msgs.length ? msgs.map(m => `[${m.codigo}] ${m.mensagem}`).join(' | ') : 'veja os logs.'}`, 'error');
      }
      await fetchRpsList();
    } catch (err) { showToast(err.message, 'error'); await fetchRpsList(); throw err; }
  };

  if (phase === 'loading') return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Carregando...</div>;
  if (phase === 'setup') return <><SetupWizard status={setupStatus || {}} onShowToast={showToast} onDone={checkState} /><Toasts toasts={toasts} /></>;
  if (phase === 'login') return <><Login onShowToast={showToast} onLogged={checkState} /><Toasts toasts={toasts} /></>;

  const titulo = { dashboard: 'Painel Geral', new: editingRps ? 'Editar RPS' : 'Emitir Novo RPS', list: 'Relação de RPS', emissores: 'Emissores', conexao: 'Conexão do Banco' }[activeTab] || '';

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFF' }}>Foz</span></div>
          <span className="brand-name">Emissor NFS-e</span>
        </div>
        <nav><ul className="nav-menu">
          <li className="nav-item"><div className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setEditingRps(null); }}><LayoutDashboard size={20} /> Painel</div></li>
          <li className="nav-item"><div className={`nav-link ${activeTab === 'new' ? 'active' : ''}`} onClick={() => { setActiveTab('new'); setEditingRps(null); }}><FilePlus size={20} /> Novo RPS</div></li>
          <li className="nav-item"><div className={`nav-link ${activeTab === 'list' ? 'active' : ''}`} onClick={() => { setActiveTab('list'); setEditingRps(null); }}><ListCollapse size={20} /> Relação de Notas</div></li>
          <li className="nav-item"><div className={`nav-link ${activeTab === 'emissores' ? 'active' : ''}`} onClick={() => { setActiveTab('emissores'); setEditingRps(null); }}><Building2 size={20} /> Emissores</div></li>
          <li className="nav-item"><div className={`nav-link ${activeTab === 'conexao' ? 'active' : ''}`} onClick={() => { setActiveTab('conexao'); setEditingRps(null); }}><Database size={20} /> Conexão</div></li>
        </ul></nav>
        <div style={{ marginTop: 'auto', padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Admin: {getUser() || '-'}</div>
          <button className="btn btn-secondary btn-sm" onClick={logout} style={{ width: '100%', justifyContent: 'center' }}><LogOut size={14} /> Sair</button>
        </div>
      </aside>

      <main className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title">{titulo}</h1>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>Sistema multi-emissor de NFS-e (ABRASF v2.02).</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {emissores.length > 0 && activeTab !== 'emissores' && (
              <select className="form-input" value={activeEmissorId || ''} onChange={(e) => setActiveEmissorId(e.target.value)} style={{ minWidth: 220 }}>
                {emissores.map(e => <option key={e.id} value={e.id}>{e.razaoSocial}</option>)}
              </select>
            )}
            {activeEmissor && <span className={`badge ${activeEmissor.ambiente === '1' ? 'badge-error' : 'badge-pending'}`}>{activeEmissor.ambiente === '1' ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO'}</span>}
          </div>
        </header>

        <ErrorBoundary key={activeTab}>
        {activeTab === 'dashboard' && <Dashboard rpsList={rpsList} settings={activeEmissor} cert={activeEmissor?.certConfigured ? { filename: 'configurado' } : null} onNavigate={(t) => { setActiveTab(t); if (t !== 'new') setEditingRps(null); }} />}
        {activeTab === 'new' && (activeEmissorId
          ? <RPSForm key={activeEmissorId} editingRps={editingRps} emissorId={activeEmissorId} onSave={handleSaveRps} onCancel={() => { setEditingRps(null); setActiveTab('list'); }} onShowToast={showToast} />
          : <div className="card">Cadastre um emissor antes de emitir notas.</div>)}
        {activeTab === 'list' && <RPSList rpsList={rpsList} onEdit={(r) => { setEditingRps(r); setActiveTab('new'); }} onDelete={handleDeleteRps} onSend={handleSendRps} onShowToast={showToast} />}
        {activeTab === 'emissores' && <Emissores onShowToast={showToast} onChanged={fetchEmissores} />}
        {activeTab === 'conexao' && <ConexaoForm onShowToast={showToast} />}
        </ErrorBoundary>
      </main>

      <Toasts toasts={toasts} />
    </div>
  );
}

function Toasts({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <Bell size={18} style={{ color: t.type === 'error' ? 'var(--color-error)' : t.type === 'success' ? 'var(--color-success)' : 'var(--color-info)' }} />
          <span style={{ fontSize: '0.9rem' }}>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
