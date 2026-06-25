import React, { useState, useEffect } from 'react';
import { X, Copy, Check, FileCode, Terminal, HelpCircle } from 'lucide-react';

export default function PayloadModal({ isOpen, rps, onClose, onShowToast }) {
  const [activeTab, setActiveTab] = useState('unsigned');
  const [loading, setLoading] = useState(false);
  const [unsignedXml, setUnsignedXml] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && rps) {
      fetchUnsignedXml();
      // Se a nota já foi processada, coloca a aba padrão no retorno ou assinado
      if (rps.status === 'Processado' || rps.status === 'Erro') {
        setActiveTab('response');
      } else {
        setActiveTab('unsigned');
      }
    }
  }, [isOpen, rps]);

  const fetchUnsignedXml = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rps/${rps.id}/generate`, { method: 'POST' });
      if (!res.ok) throw new Error("Erro ao gerar XML básico.");
      const data = await res.json();
      setUnsignedXml(data.xml);
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !rps) return null;

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onShowToast("Copiado para a área de transferência!", "success");
  };

  const getActiveCode = () => {
    switch (activeTab) {
      case 'unsigned':
        return unsignedXml;
      case 'signed':
        return rps.retorno?.signedXml || "Disponível somente após o envio (ou falha no envio pós-assinatura).";
      case 'soap':
        return rps.retorno?.soapRequest || "Disponível somente após o envio.";
      case 'response':
        return rps.retorno?.soapResponse || "Esta nota ainda não foi enviada para a prefeitura.";
      case 'log':
        if (rps.retorno) {
          return JSON.stringify({
            status: rps.status,
            success: rps.retorno.success,
            error: rps.retorno.error || null,
          }, null, 2);
        }
        return "Nenhum log disponível. Envie a nota para registrar dados.";
      default:
        return '';
    }
  };

  const codeContent = getActiveCode();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(139, 92, 246, 0.1)', color: 'var(--color-primary)' }}>
              <FileCode size={20} />
            </div>
            <div>
              <h3 style={{ color: '#FFF' }}>Payload e Integração - RPS Nº {rps.numeroRps}</h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Cliente: {rps.tomador.razaoSocial}</div>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" style={{ padding: '0.35rem', borderRadius: '50%' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Tabs */}
          <div className="payload-tabs">
            <button 
              className={`payload-tab-btn ${activeTab === 'unsigned' ? 'active' : ''}`}
              onClick={() => setActiveTab('unsigned')}
            >
              XML Gerado (Rascunho)
            </button>
            <button 
              className={`payload-tab-btn ${activeTab === 'signed' ? 'active' : ''}`}
              onClick={() => setActiveTab('signed')}
              disabled={!rps.retorno?.signedXml}
              style={{ opacity: rps.retorno?.signedXml ? 1 : 0.5 }}
            >
              XML Assinado (ICP-Brasil)
            </button>
            <button 
              className={`payload-tab-btn ${activeTab === 'soap' ? 'active' : ''}`}
              onClick={() => setActiveTab('soap')}
              disabled={!rps.retorno?.soapRequest}
              style={{ opacity: rps.retorno?.soapRequest ? 1 : 0.5 }}
            >
              Envelope SOAP de Envio
            </button>
            <button 
              className={`payload-tab-btn ${activeTab === 'response' ? 'active' : ''}`}
              onClick={() => setActiveTab('response')}
            >
              Retorno Prefeitura
            </button>
            <button 
              className={`payload-tab-btn ${activeTab === 'log' ? 'active' : ''}`}
              onClick={() => setActiveTab('log')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Terminal size={14} />
                Logs / Status
              </div>
            </button>
          </div>

          {/* Code Viewer Area */}
          <div style={{ position: 'relative' }}>
            <button 
              className="btn btn-secondary btn-sm" 
              style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', zIndex: 10, display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#0B0F19' }}
              onClick={() => handleCopy(codeContent)}
              disabled={!codeContent || codeContent.startsWith('Disponível') || codeContent.startsWith('Esta nota') || codeContent.startsWith('Nenhum')}
            >
              {copied ? <Check size={14} style={{ color: 'var(--color-success)' }} /> : <Copy size={14} />}
              {copied ? "Copiado!" : "Copiar"}
            </button>

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '250px', backgroundColor: '#080C14', borderRadius: 'var(--radius-sm)' }}>
                <div className="spinner"></div>
              </div>
            ) : (
              <pre className="code-block">
                {codeContent}
              </pre>
            )}
          </div>

          {/* Explanatory Help Text */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)' }}>
            <HelpCircle size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '0.1rem' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {activeTab === 'unsigned' && "Este é o XML inicial gerado conforme o padrão ABRASF v2.02. Para fins fiscais, ele ainda precisa ser assinado com a tag <Signature> e encapsulado no envelope SOAP antes da transmissão."}
              {activeTab === 'signed' && "Este XML foi assinado localmente utilizando o seu certificado digital. Note as tags <Signature> inseridas no Lote e no RPS garantindo integridade e autoria."}
              {activeTab === 'soap' && "Este é o payload final transmitido no corpo da requisição HTTP POST para a URL do WebService de Foz do Iguaçu (GestãoISS)."}
              {activeTab === 'response' && "Esta é a resposta em XML retornada diretamente pelo servidor da prefeitura. Se houver sucesso, conterá a tag <Protocolo> ou <NumeroNfse>."}
              {activeTab === 'log' && "Logs internos de processamento contendo status, tempos e erros de comunicação HTTP."}
            </span>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Fechar</button>
        </div>

      </div>
    </div>
  );
}
