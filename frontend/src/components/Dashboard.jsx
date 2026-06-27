import React from 'react';
import { FileText, CheckCircle2, XCircle, AlertCircle, Building2, ShieldCheck, ArrowRight, ArrowUpRight } from 'lucide-react';

export default function Dashboard({ rpsList, settings, cert, onNavigate }) {
  
  // Calculate metrics
  const total = rpsList.length;
  const processed = rpsList.filter(r => r.status === 'Processado').length;
  const errors = rpsList.filter(r => r.status === 'Erro').length;
  const drafts = rpsList.filter(r => r.status === 'Rascunho').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Metrics Row */}
      <div className="metrics-grid">
        
        <div className="card metric-card metric-primary">
          <div className="metric-icon">
            <FileText size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Total Gerado</span>
            <span className="metric-value">{total}</span>
          </div>
        </div>

        <div className="card metric-card metric-success">
          <div className="metric-icon">
            <CheckCircle2 size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Processado (Sucesso)</span>
            <span className="metric-value">{processed}</span>
          </div>
        </div>

        <div className="card metric-card metric-error">
          <div className="metric-icon">
            <XCircle size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Rejeitados (Erro)</span>
            <span className="metric-value">{errors}</span>
          </div>
        </div>

        <div className="card metric-card metric-warning">
          <div className="metric-icon">
            <AlertCircle size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Rascunhos Pendentes</span>
            <span className="metric-value">{drafts}</span>
          </div>
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '2rem' }}>
        
        {/* Quick Actions & Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ color: '#FFF' }}>Ações Rápidas</h3>
            <p className="page-subtitle" style={{ margin: 0 }}>Escolha uma das ações abaixo para gerenciar ou emitir seus recibos fiscais.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div 
                className="card" 
                onClick={() => onNavigate('new')}
                style={{ 
                  cursor: 'pointer', 
                  border: '1px solid rgba(139, 92, 246, 0.15)', 
                  backgroundColor: 'rgba(139, 92, 246, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  padding: '1.25rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>Novo RPS</span>
                  <ArrowUpRight size={18} style={{ color: 'var(--color-primary)' }} />
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Preencha os dados e gere um novo RPS para envio rápido.</span>
              </div>

              <div 
                className="card" 
                onClick={() => onNavigate('list')}
                style={{ 
                  cursor: 'pointer', 
                  border: '1px solid rgba(6, 182, 212, 0.15)', 
                  backgroundColor: 'rgba(6, 182, 212, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  padding: '1.25rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>Relação de Notas</span>
                  <ArrowUpRight size={18} style={{ color: 'var(--color-accent)' }} />
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Visualize, assine e envie os RPS pendentes à prefeitura.</span>
              </div>
            </div>
          </div>

          {/* Ultimos RPS Enviados */}
          <div className="card">
            <h3 style={{ color: '#FFF', marginBottom: '1.25rem' }}>Últimas Atividades</h3>
            {rpsList.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', padding: '1rem 0' }}>Nenhuma atividade registrada ainda.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {rpsList.slice(0, 4).map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>RPS Nº {r.numeroRps} - {r.tomador.razaoSocial}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Valor: R$ {parseFloat(r.servico.valorServicos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Emissão: {new Date(r.dataEmissao).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <div>
                      <span className={`badge badge-${r.status.toLowerCase()}`}>{r.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Emissor & Certificado Info Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card" style={{ flex: 1 }}>
            <h3 style={{ color: '#FFF', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={20} style={{ color: 'var(--color-primary)' }} />
              Perfil do Emissor
            </h3>
            
            {settings && settings.cnpj ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Razão Social</div>
                  <div style={{ fontWeight: 600, color: '#FFF', fontSize: '1.1rem' }}>{settings.razaoSocial}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CNPJ</div>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{settings.cnpj}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inscrição Municipal</div>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{settings.inscricaoMunicipal}</div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ambiente Atual</div>
                  <div style={{ fontWeight: 600, color: settings.ambiente === '1' ? 'var(--color-error)' : 'var(--color-warning)', marginTop: '0.25rem' }}>
                    {settings.ambiente === '1' ? 'Ambiente de Produção' : 'Ambiente de Homologação'}
                  </div>
                </div>

                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem', borderRadius: 'var(--radius-md)', backgroundColor: cert ? 'rgba(16, 185, 129, 0.03)' : 'rgba(245, 158, 11, 0.03)', border: cert ? '1px solid rgba(16, 185, 129, 0.1)' : '1px solid rgba(245, 158, 11, 0.1)' }}>
                  <ShieldCheck size={20} style={{ color: cert ? 'var(--color-success)' : 'var(--color-warning)' }} />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: cert ? 'var(--color-success)' : 'var(--color-warning)' }}>
                      {cert ? "Certificado A1 Configurado" : "Certificado Pendente"}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {cert ? cert.filename : "Não é possível assinar notas"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', padding: '2rem 0' }}>
                <Building2 size={48} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                <div style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.95rem' }}>Você ainda não configurou as informações básicas da sua empresa.</div>
                <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('settings')}>
                  Configurar Agora
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
