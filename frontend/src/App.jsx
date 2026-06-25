import React, { useState, useEffect } from 'react';
import { LayoutDashboard, FilePlus, ListCollapse, Settings as SettingsIcon, Bell } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import RPSForm from './components/RPSForm';
import RPSList from './components/RPSList';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [rpsList, setRpsList] = useState([]);
  const [settings, setSettings] = useState(null);
  const [cert, setCert] = useState(null);
  const [editingRps, setEditingRps] = useState(null);
  
  // Toast notifications state
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    fetchRpsList();
    fetchSettings();
  }, []);

  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const fetchRpsList = async () => {
    try {
      const res = await fetch('/api/rps');
      if (!res.ok) throw new Error("Erro ao listar RPS.");
      const data = await res.json();
      setRpsList(data);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error("Erro ao carregar configurações.");
      const data = await res.json();
      setSettings(data.settings);
      setCert(data.cert);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveRps = async (rpsData) => {
    try {
      const isEdit = !!rpsData.id;
      const url = isEdit ? `/api/rps/${rpsData.id}` : '/api/rps';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rpsData)
      });

      if (!res.ok) throw new Error("Erro ao salvar RPS.");
      
      showToast(isEdit ? "RPS atualizado com sucesso!" : "Novo RPS gerado!", "success");
      setEditingRps(null);
      await fetchRpsList();
      setActiveTab('list');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteRps = async (id) => {
    if (!window.confirm("Deseja realmente excluir este RPS?")) return;
    try {
      const res = await fetch(`/api/rps/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Erro ao excluir RPS.");
      showToast("RPS excluído com sucesso.", "success");
      await fetchRpsList();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSendRps = async (id) => {
    try {
      const res = await fetch(`/api/rps/${id}/send`, { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Erro no envio.");
      
      if (data.status === 'Processado') {
        showToast("RPS processado com sucesso e NFS-e emitida!", "success");
      } else {
        showToast("A prefeitura rejeitou o RPS. Verifique os logs de erro.", "error");
      }
      
      await fetchRpsList();
    } catch (err) {
      showToast(err.message, 'error');
      await fetchRpsList(); // Carregar status atualizado
      throw err;
    }
  };

  const handleEditRpsClick = (rps) => {
    setEditingRps(rps);
    setActiveTab('new');
  };

  const handleCancelForm = () => {
    setEditingRps(null);
    setActiveTab('list');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            rpsList={rpsList} 
            settings={settings} 
            cert={cert} 
            onNavigate={(tab) => {
              setActiveTab(tab);
              if (tab !== 'new') setEditingRps(null);
            }} 
          />
        );
      case 'new':
        return (
          <RPSForm 
            editingRps={editingRps} 
            onSave={handleSaveRps} 
            onCancel={handleCancelForm}
            onShowToast={showToast}
          />
        );
      case 'list':
        return (
          <RPSList 
            rpsList={rpsList} 
            onEdit={handleEditRpsClick} 
            onDelete={handleDeleteRps} 
            onSend={handleSendRps}
            onShowToast={showToast}
          />
        );
      case 'settings':
        return (
          <Settings 
            onShowToast={showToast} 
            onSettingsUpdated={fetchSettings} 
          />
        );
      default:
        return null;
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard': return "Painel Geral";
      case 'new': return editingRps ? "Editar RPS" : "Emitir Novo RPS";
      case 'list': return "Relação de RPS Emitidos";
      case 'settings': return "Configurações Gerais";
      default: return "";
    }
  };

  return (
    <div className="app-container">
      
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFF' }}>Foz</span>
          </div>
          <span className="brand-name">Emissor NFS-e</span>
        </div>

        <nav>
          <ul className="nav-menu">
            <li className="nav-item">
              <div 
                className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => { setActiveTab('dashboard'); setEditingRps(null); }}
              >
                <LayoutDashboard size={20} />
                Painel
              </div>
            </li>
            <li className="nav-item">
              <div 
                className={`nav-link ${activeTab === 'new' ? 'active' : ''}`}
                onClick={() => { setActiveTab('new'); setEditingRps(null); }}
              >
                <FilePlus size={20} />
                Novo RPS
              </div>
            </li>
            <li className="nav-item">
              <div 
                className={`nav-link ${activeTab === 'list' ? 'active' : ''}`}
                onClick={() => { setActiveTab('list'); setEditingRps(null); }}
              >
                <ListCollapse size={20} />
                Relação de Notas
              </div>
            </li>
            <li className="nav-item">
              <div 
                className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => { setActiveTab('settings'); setEditingRps(null); }}
              >
                <SettingsIcon size={20} />
                Configurações
              </div>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div>
            <h1 className="page-title">{getTabTitle()}</h1>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>
              {activeTab === 'dashboard' && "Visão geral e monitoramento das notas transmitidas."}
              {activeTab === 'new' && "Gere recibos provisórios de serviços preenchendo as especificações ABRASF v2.02."}
              {activeTab === 'list' && "Histórico de emissões, gerenciamento de status de envio e payloads XML."}
              {activeTab === 'settings' && "Gerenciamento dos dados cadastrais do prestador e chaves do certificado digital."}
            </p>
          </div>
          
          {/* Top Header Controls (e.g. Ambient Badge) */}
          {settings && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span className={`badge ${settings.ambiente === '1' ? 'badge-error' : 'badge-pending'}`}>
                {settings.ambiente === '1' ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO'}
              </span>
            </div>
          )}
        </header>

        {renderContent()}
      </main>

      {/* Toast System Renderer */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <Bell size={18} style={{ color: toast.type === 'error' ? 'var(--color-error)' : toast.type === 'success' ? 'var(--color-success)' : 'var(--color-info)' }} />
            <span style={{ fontSize: '0.9rem' }}>{toast.message}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
