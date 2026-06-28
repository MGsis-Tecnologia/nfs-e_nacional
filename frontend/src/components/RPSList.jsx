import React, { useState } from 'react';
import { Search, Edit, Trash2, Send, Eye, FileCode, CheckCircle2, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import PayloadModal from './PayloadModal';
import { pdfHref } from '../api';

export default function RPSList({ rpsList, onEdit, onDelete, onSend, onShowToast }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  
  // Modal State
  const [selectedRps, setSelectedRps] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Loading state tracking per RPS transmission
  const [sendingIds, setSendingIds] = useState({});

  const handleSend = async (id) => {
    setSendingIds(prev => ({ ...prev, [id]: true }));
    try {
      await onSend(id);
    } catch (err) {
      // Handled in parent
    } finally {
      setSendingIds(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleOpenModal = (rps) => {
    setSelectedRps(rps);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedRps(null);
    setIsModalOpen(false);
  };

  // Filter list
  const filteredRpsList = rpsList.filter(rps => {
    const matchesSearch = 
      rps.numeroRps.toString().includes(searchTerm) ||
      rps.tomador.razaoSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rps.tomador.cpfCnpj.includes(searchTerm);
    
    if (statusFilter === "TODOS") return matchesSearch;
    if (statusFilter === "PROCESSADO") return matchesSearch && rps.status === "Processado";
    if (statusFilter === "ERRO") return matchesSearch && rps.status === "Erro";
    if (statusFilter === "RASCUNHO") return matchesSearch && rps.status === "Rascunho";
    return matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Search & Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        
        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--bg-sidebar)', padding: '0.35rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          {["TODOS", "RASCUNHO", "PROCESSADO", "ERRO"].map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              style={{
                background: 'none',
                border: 'none',
                color: statusFilter === filter ? '#FFF' : 'var(--text-secondary)',
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                backgroundColor: statusFilter === filter ? 'rgba(255,255,255,0.05)' : 'transparent',
                transition: 'var(--transition-fast)'
              }}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Buscar por Nº RPS ou Cliente..."
            style={{ width: '100%', paddingLeft: '2.5rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

      </div>

      {/* Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredRpsList.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Nenhum recibo RPS encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>RPS / Lote</th>
                  <th>Data Emissão</th>
                  <th>Tomador (Cliente)</th>
                  <th>Valor Serviço</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredRpsList.map((rps) => {
                  const isSending = sendingIds[rps.id];
                  return (
                    <tr key={rps.id}>
                      {/* RPS & Lote */}
                      <td>
                        <div style={{ fontWeight: 600, color: '#FFF' }}>Nº {rps.numeroRps}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Lote: {rps.numeroLote} | Série: {rps.serieRps}</div>
                        {rps.numeroNfse && (
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-accent)', marginTop: '0.15rem' }}>NF-e: {rps.numeroNfse}</div>
                        )}
                      </td>

                      {/* Data Emissão */}
                      <td>
                        <div>{new Date(rps.dataEmissao).toLocaleDateString('pt-BR')}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(rps.dataEmissao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>

                      {/* Tomador */}
                      <td>
                        <div style={{ fontWeight: 500 }}>{rps.tomador.razaoSocial}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>CNPJ/CPF: {rps.tomador.cpfCnpj}</div>
                      </td>

                      {/* Valor Serviço */}
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--color-accent)' }}>
                          R$ {parseFloat(rps.servico.valorServicos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`badge badge-${rps.status.toLowerCase()}`}>
                          {rps.status === 'Processado' && <CheckCircle2 size={12} style={{ marginRight: '0.25rem' }} />}
                          {rps.status === 'Erro' && <AlertCircle size={12} style={{ marginRight: '0.25rem' }} />}
                          {rps.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          
                          {/* Visualizar XML */}
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ padding: '0.45rem', borderRadius: 'var(--radius-sm)' }}
                            onClick={() => handleOpenModal(rps)}
                            title="Visualizar XML / Logs"
                            disabled={isSending}
                          >
                            <FileCode size={16} />
                          </button>

                          {/* PDF (apenas notas autorizadas) */}
                          {rps.status === 'Processado' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.45rem', borderRadius: 'var(--radius-sm)', color: 'var(--color-accent)' }}
                              onClick={() => window.open(pdfHref(rps.id), '_blank')}
                              title="Imprimir / Baixar PDF da NFS-e"
                            >
                              <FileText size={16} />
                            </button>
                          )}

                          {/* Editar (apenas Rascunho ou Erro) */}
                          {(rps.status === 'Rascunho' || rps.status === 'Erro') && (
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ padding: '0.45rem', borderRadius: 'var(--radius-sm)' }}
                              onClick={() => onEdit(rps)}
                              title="Editar RPS"
                              disabled={isSending}
                            >
                              <Edit size={16} />
                            </button>
                          )}

                          {/* Excluir (apenas Rascunho ou Erro) */}
                          {(rps.status === 'Rascunho' || rps.status === 'Erro') && (
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ padding: '0.45rem', borderRadius: 'var(--radius-sm)', color: 'var(--color-error)' }}
                              onClick={() => onDelete(rps.id)}
                              title="Excluir RPS"
                              disabled={isSending}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}

                          {/* Transmitir / Enviar */}
                          {(rps.status === 'Rascunho' || rps.status === 'Erro') && (
                            <button 
                              className="btn btn-primary btn-sm" 
                              style={{ 
                                padding: '0.45rem 0.75rem', 
                                borderRadius: 'var(--radius-sm)',
                                background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)' 
                              }}
                              onClick={() => handleSend(rps.id)}
                              disabled={isSending}
                            >
                              {isSending ? (
                                <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
                              ) : (
                                <>
                                  <Send size={14} />
                                  Enviar
                                </>
                              )}
                            </button>
                          )}

                          {/* Re-transmitir se for erro (atalho) */}
                          {rps.status === 'Erro' && !isSending && (
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ padding: '0.45rem', borderRadius: 'var(--radius-sm)' }}
                              onClick={() => handleSend(rps.id)}
                              title="Re-transmitir"
                            >
                              <RefreshCw size={16} />
                            </button>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payload Details Modal */}
      <PayloadModal 
        isOpen={isModalOpen} 
        rps={selectedRps} 
        onClose={handleCloseModal} 
        onShowToast={onShowToast} 
      />

    </div>
  );
}
