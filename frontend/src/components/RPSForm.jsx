import React, { useState, useEffect } from 'react';
import { FilePlus, Save, ArrowLeft, ArrowRight, X } from 'lucide-react';
import { apiJson } from '../api';

const emptyRps = {
  numeroRps: "",
  numeroLote: "1",
  serieRps: "1",
  dataEmissao: new Date().toISOString().slice(0, 16),
  competencia: new Date().toISOString().slice(0, 10),
  tomador: {
    cpfCnpj: "",
    razaoSocial: "",
    inscricaoMunicipal: "",
    endereco: {
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      codigoMunicipio: "4108304", // Foz do Iguaçu
      uf: "PR",
      cep: ""
    },
    contato: {
      telefone: "",
      email: ""
    }
  },
  servico: {
    valorServicos: "",
    valorDeducoes: "0.00",
    valorPis: "0.00",
    valorCofins: "0.00",
    valorInss: "0.00",
    valorIr: "0.00",
    valorCsll: "0.00",
    outrasRetencoes: "0.00",
    aliquota: "3.7610",
    descontoIncondicionado: "0.00",
    descontoCondicionado: "0.00",
    issRetido: "2", // 1 = Sim, 2 = Não
    itemListaServico: "14.01", // Suporte e Manutenção
    codigoTributacaoMunicipio: "",
    discriminacao: "",
    codigoMunicipio: "4108304",
    exigibilidadeIss: "1", // 1 = Exigível
    municipioIncidencia: "4108304"
  }
};

// Mescla um RPS carregado sobre a estrutura padrão, garantindo que todos os
// blocos aninhados (tomador, endereço, contato, serviço) sempre existam.
// Sem isso, editar um RPS com dados incompletos (ex.: origem ERP) quebra o
// render do passo de Serviço e "joga" o usuário para fora do formulário.
const normalizeRps = (data) => ({
  ...emptyRps,
  ...data,
  tomador: {
    ...emptyRps.tomador,
    ...(data.tomador || {}),
    endereco: { ...emptyRps.tomador.endereco, ...(data.tomador?.endereco || {}) },
    contato: { ...emptyRps.tomador.contato, ...(data.tomador?.contato || {}) }
  },
  servico: { ...emptyRps.servico, ...(data.servico || {}) }
});

export default function RPSForm({ editingRps, emissorId, onSave, onCancel, onShowToast }) {
  const [step, setStep] = useState(1);
  const [rps, setRps] = useState(emptyRps);

  useEffect(() => {
    if (editingRps) {
      // Formatar datas para os inputs
      setRps(normalizeRps({
        ...editingRps,
        dataEmissao: editingRps.dataEmissao ? editingRps.dataEmissao.slice(0, 16) : new Date().toISOString().slice(0, 16),
        competencia: editingRps.competencia ? editingRps.competencia.slice(0, 10) : new Date().toISOString().slice(0, 10)
      }));
      // Edição segue o mesmo fluxo de um RPS novo: começa no passo 1
      setStep(1);
    } else {
      setStep(1);
      // Novo RPS: busca o próximo número de RPS e Lote do emissor ativo (para não repetir)
      if (!emissorId) { setRps(emptyRps); return; }
      apiJson(`/api/sequencias?emissorId=${emissorId}`)
        .then(seq => {
          setRps({
            ...emptyRps,
            numeroRps: seq?.proximoRps != null ? String(seq.proximoRps) : "",
            numeroLote: seq?.proximoLote != null ? String(seq.proximoLote) : emptyRps.numeroLote
          });
        })
        .catch(() => setRps(emptyRps));
    }
  }, [editingRps, emissorId]);

  const handleInputChange = (field, value) => {
    setRps(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTomadorChange = (field, value) => {
    setRps(prev => ({
      ...prev,
      tomador: {
        ...prev.tomador,
        [field]: value
      }
    }));
  };

  const handleTomadorAddressChange = (field, value) => {
    setRps(prev => ({
      ...prev,
      tomador: {
        ...prev.tomador,
        endereco: {
          ...prev.tomador.endereco,
          [field]: value
        }
      }
    }));
  };

  const handleTomadorContactChange = (field, value) => {
    setRps(prev => ({
      ...prev,
      tomador: {
        ...prev.tomador,
        contato: {
          ...prev.tomador.contato,
          [field]: value
        }
      }
    }));
  };

  const handleServicoChange = (field, value) => {
    setRps(prev => ({
      ...prev,
      servico: {
        ...prev.servico,
        [field]: value
      }
    }));
  };

  const handleSubmit = () => {
    if (!rps.numeroRps) {
      onShowToast("Informe o número do RPS", "warning");
      return;
    }
    if (!rps.tomador.cpfCnpj || !rps.tomador.razaoSocial) {
      onShowToast("Preencha os dados do Tomador", "warning");
      return;
    }
    if (!rps.servico.codigoTributacaoMunicipio) {
      onShowToast("Informe o Código de Tributação Municipal", "warning");
      return;
    }
    if (!rps.servico.valorServicos || !rps.servico.discriminacao) {
      onShowToast("Preencha o valor do serviço e a discriminação", "warning");
      return;
    }

    onSave(rps);
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, 3));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  return (
    <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h3 style={{ color: '#FFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FilePlus style={{ color: 'var(--color-primary)' }} />
          {editingRps ? `Editar RPS Nº ${rps.numeroRps}` : 'Criar Novo RPS'}
        </h3>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>
          <X size={14} />
          Cancelar
        </button>
      </div>

      {/* Progress Wizard Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2.5rem', position: 'relative' }}>
        {/* Line Behind */}
        <div style={{ position: 'absolute', top: '50%', left: '4%', right: '4%', height: '2px', backgroundColor: 'var(--border-color)', transform: 'translateY(-50%)', zIndex: 1 }}></div>
        <div style={{ position: 'absolute', top: '50%', left: '4%', width: step === 1 ? '0%' : step === 2 ? '46%' : '92%', height: '2px', backgroundColor: 'var(--color-primary)', transform: 'translateY(-50%)', transition: 'width 0.3s ease', zIndex: 2 }}></div>

        {/* Step 1 */}
        <div 
          onClick={() => setStep(1)}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            zIndex: 3, 
            cursor: 'pointer' 
          }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: step >= 1 ? 'var(--color-primary)' : 'var(--bg-input)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontWeight: 'bold', border: '2px solid', borderColor: step >= 1 ? 'var(--color-primary)' : 'var(--border-color)', color: '#FFF' }}>1</div>
          <span style={{ fontSize: '0.8rem', color: step >= 1 ? '#FFF' : 'var(--text-muted)', marginTop: '0.5rem', fontWeight: 500 }}>Identificação</span>
        </div>

        {/* Step 2 */}
        <div 
          onClick={() => setStep(2)}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            zIndex: 3, 
            cursor: 'pointer' 
          }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: step >= 2 ? 'var(--color-primary)' : 'var(--bg-input)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontWeight: 'bold', border: '2px solid', borderColor: step >= 2 ? 'var(--color-primary)' : 'var(--border-color)', color: '#FFF' }}>2</div>
          <span style={{ fontSize: '0.8rem', color: step >= 2 ? '#FFF' : 'var(--text-muted)', marginTop: '0.5rem', fontWeight: 500 }}>Tomador (Cliente)</span>
        </div>

        {/* Step 3 */}
        <div 
          onClick={() => setStep(3)}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            zIndex: 3, 
            cursor: 'pointer' 
          }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: step >= 3 ? 'var(--color-primary)' : 'var(--bg-input)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontWeight: 'bold', border: '2px solid', borderColor: step >= 3 ? 'var(--color-primary)' : 'var(--border-color)', color: '#FFF' }}>3</div>
          <span style={{ fontSize: '0.8rem', color: step >= 3 ? '#FFF' : 'var(--text-muted)', marginTop: '0.5rem', fontWeight: 500 }}>Serviço & Valores</span>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={(e) => e.preventDefault()} style={{ minHeight: '320px' }}>
        
        {/* STEP 1: IDENTIFICATION */}
        {step === 1 && (
          <div className="form-grid">
            <div className="form-group col-4">
              <label className="form-label">Número do RPS</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="Ex: 101"
                value={rps.numeroRps} 
                onChange={(e) => handleInputChange('numeroRps', e.target.value)}
                required
              />
            </div>

            <div className="form-group col-4">
              <label className="form-label">Série do RPS</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ex: 1"
                value={rps.serieRps} 
                onChange={(e) => handleInputChange('serieRps', e.target.value)}
              />
            </div>

            <div className="form-group col-4">
              <label className="form-label">Número do Lote</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="Ex: 1"
                value={rps.numeroLote} 
                onChange={(e) => handleInputChange('numeroLote', e.target.value)}
                required
              />
            </div>

            <div className="form-group col-6">
              <label className="form-label">Data e Hora de Emissão</label>
              <input 
                type="datetime-local" 
                className="form-input" 
                value={rps.dataEmissao} 
                onChange={(e) => handleInputChange('dataEmissao', e.target.value)}
                required
              />
            </div>

            <div className="form-group col-6">
              <label className="form-label">Competência</label>
              <input 
                type="date" 
                className="form-input" 
                value={rps.competencia} 
                onChange={(e) => handleInputChange('competencia', e.target.value)}
                required
              />
            </div>
          </div>
        )}

        {/* STEP 2: TOMADOR */}
        {step === 2 && (
          <div className="form-grid">
            <div className="form-group col-4">
              <label className="form-label">CPF ou CNPJ do Cliente</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="00.000.000/0000-00"
                value={rps.tomador.cpfCnpj} 
                onChange={(e) => handleTomadorChange('cpfCnpj', e.target.value)}
                required
              />
            </div>

            <div className="form-group col-8">
              <label className="form-label">Razão Social / Nome</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Nome do cliente completo ou Razão"
                value={rps.tomador.razaoSocial} 
                onChange={(e) => handleTomadorChange('razaoSocial', e.target.value)}
                required
              />
            </div>

            <div className="form-group col-4">
              <label className="form-label">Inscrição Municipal (Opcional)</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ex: 98765"
                value={rps.tomador.inscricaoMunicipal} 
                onChange={(e) => handleTomadorChange('inscricaoMunicipal', e.target.value)}
              />
            </div>

            <div className="form-group col-4">
              <label className="form-label">Telefone</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="(45) 99999-9999"
                value={rps.tomador.contato.telefone} 
                onChange={(e) => handleTomadorContactChange('telefone', e.target.value)}
              />
            </div>

            <div className="form-group col-4">
              <label className="form-label">E-mail</label>
              <input 
                type="email" 
                className="form-input" 
                placeholder="cliente@email.com"
                value={rps.tomador.contato.email} 
                onChange={(e) => handleTomadorContactChange('email', e.target.value)}
              />
            </div>

            <div className="col-12 settings-section-title" style={{ marginTop: '1rem' }}>Endereço do Tomador</div>

            <div className="form-group col-3">
              <label className="form-label">CEP</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="85851-000"
                value={rps.tomador.endereco.cep} 
                onChange={(e) => handleTomadorAddressChange('cep', e.target.value)}
                required
              />
            </div>

            <div className="form-group col-6">
              <label className="form-label">Logradouro</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Rua, Avenida..."
                value={rps.tomador.endereco.logradouro} 
                onChange={(e) => handleTomadorAddressChange('logradouro', e.target.value)}
                required
              />
            </div>

            <div className="form-group col-3">
              <label className="form-label">Número</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ex: 123"
                value={rps.tomador.endereco.numero} 
                onChange={(e) => handleTomadorAddressChange('numero', e.target.value)}
                required
              />
            </div>

            <div className="form-group col-4">
              <label className="form-label">Complemento</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Apt 20"
                value={rps.tomador.endereco.complemento} 
                onChange={(e) => handleTomadorAddressChange('complemento', e.target.value)}
              />
            </div>

            <div className="form-group col-4">
              <label className="form-label">Bairro</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Bairro"
                value={rps.tomador.endereco.bairro} 
                onChange={(e) => handleTomadorAddressChange('bairro', e.target.value)}
                required
              />
            </div>

            <div className="form-group col-2">
              <label className="form-label">UF</label>
              <input 
                type="text" 
                className="form-input" 
                value={rps.tomador.endereco.uf} 
                onChange={(e) => handleTomadorAddressChange('uf', e.target.value)}
              />
            </div>

            <div className="form-group col-2">
              <label className="form-label">Cód. Município</label>
              <input 
                type="text" 
                className="form-input" 
                value={rps.tomador.endereco.codigoMunicipio} 
                onChange={(e) => handleTomadorAddressChange('codigoMunicipio', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* STEP 3: SERVICO E VALORES */}
        {step === 3 && (
          <div className="form-grid">
            
            <div className="form-group col-3">
              <label className="form-label">Item Serviço (LC 116/03)</label>
              <select
                className="form-input"
                value={rps.servico.itemListaServico}
                onChange={(e) => handleServicoChange('itemListaServico', e.target.value)}
              >
                <option value="01.05">01.05 - Licenciamento ou Cessão de Software</option>
                <option value="01.07">01.07 - Suporte Técnico em Informática</option>
                <option value="14.01">14.01 - Manutenção e Assistência Técnica</option>
                <option value="17.06">17.06 - Propaganda e Publicidade</option>
                <option value="17.11">17.11 - Serviços de Organização e Feiras</option>
              </select>
            </div>

            <div className="form-group col-3">
              <label className="form-label">Código Tributação Municipal *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: 01"
                value={rps.servico.codigoTributacaoMunicipio}
                onChange={(e) => handleServicoChange('codigoTributacaoMunicipio', e.target.value)}
                required
              />
            </div>

            <div className="form-group col-3">
              <label className="form-label">Exigibilidade ISS</label>
              <select 
                className="form-input" 
                value={rps.servico.exigibilidadeIss} 
                onChange={(e) => handleServicoChange('exigibilidadeIss', e.target.value)}
              >
                <option value="1">1 - Exigível</option>
                <option value="2">2 - Não incidência</option>
                <option value="3">3 - Isenção</option>
                <option value="4">4 - Exportação</option>
                <option value="5">5 - Imunidade</option>
                <option value="6">6 - Exig. Suspensa Judicial</option>
              </select>
            </div>

            <div className="form-group col-3">
              <label className="form-label">ISS Retido</label>
              <select 
                className="form-input" 
                value={rps.servico.issRetido} 
                onChange={(e) => handleServicoChange('issRetido', e.target.value)}
              >
                <option value="1">1 - Sim</option>
                <option value="2">2 - Não</option>
              </select>
            </div>

            <div className="form-group col-2">
              <label className="form-label">Alíquota (%)</label>
              <input
                type="number"
                step="0.0001"
                className="form-input"
                value={rps.servico.aliquota}
                onChange={(e) => handleServicoChange('aliquota', e.target.value)}
                required
              />
            </div>

            <div className="form-group col-4">
              <label className="form-label">Valor do Serviço (R$)</label>
              <input 
                type="number" 
                step="0.01" 
                className="form-input" 
                placeholder="R$ 0,00"
                value={rps.servico.valorServicos} 
                onChange={(e) => handleServicoChange('valorServicos', e.target.value)}
                required
              />
            </div>

            <div className="form-group col-4">
              <label className="form-label">Desconto Incondicionado</label>
              <input 
                type="number" 
                step="0.01" 
                className="form-input" 
                value={rps.servico.descontoIncondicionado} 
                onChange={(e) => handleServicoChange('descontoIncondicionado', e.target.value)}
              />
            </div>

            <div className="form-group col-4">
              <label className="form-label">Retenções Federais (PIS/COFINS)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  placeholder="PIS"
                  style={{ width: '50%' }}
                  value={rps.servico.valorPis} 
                  onChange={(e) => handleServicoChange('valorPis', e.target.value)}
                />
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  placeholder="COFINS"
                  style={{ width: '50%' }}
                  value={rps.servico.valorCofins} 
                  onChange={(e) => handleServicoChange('valorCofins', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group col-12">
              <label className="form-label">Discriminação dos Serviços</label>
              <textarea 
                className="form-input" 
                rows="4" 
                placeholder="Descreva detalhadamente o serviço prestado..."
                value={rps.servico.discriminacao} 
                onChange={(e) => handleServicoChange('discriminacao', e.target.value)}
                style={{ resize: 'vertical' }}
                required
              />
            </div>

          </div>
        )}

        {/* Wizard Footer Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={prevStep}
            style={{ visibility: step === 1 ? 'hidden' : 'visible' }}
          >
            <ArrowLeft size={16} />
            Anterior
          </button>

          {step < 3 ? (
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={nextStep}
            >
              Próximo
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)' }}
            >
              <Save size={18} />
              {editingRps ? 'Salvar Edição' : 'Salvar RPS'}
            </button>
          )}

        </div>

      </form>
    </div>
  );
}
