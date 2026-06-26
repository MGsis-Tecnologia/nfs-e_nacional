import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle2, AlertTriangle, Upload, Save, HelpCircle } from 'lucide-react';

export default function Settings({ onShowToast }) {
  const [settings, setSettings] = useState({
    cnpj: "",
    inscricaoMunicipal: "",
    razaoSocial: "",
    nomeFantasia: "",
    cnae: "",
    simplesNacional: false,
    incentivoFiscal: false,
    regimeEspecialTributacao: "0",
    optanteSimplesNacional: "2",
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
    },
    ambiente: "2"
  });

  const [cert, setCert] = useState(null);
  const [certFile, setCertFile] = useState(null);
  const [certPassword, setCertPassword] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isUploadingCert, setIsUploadingCert] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error("Erro ao carregar configurações.");
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
      if (data.cert) setCert(data.cert);
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleNestedInputChange = (section, field, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error("Erro ao salvar dados do emissor.");
      onShowToast("Configurações do emissor salvas com sucesso!", "success");
    } catch (err) {
      onShowToast(err.message, "error");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setCertFile(e.target.files[0]);
    }
  };

  const handleUploadCert = async (e) => {
    e.preventDefault();
    if (!certFile) {
      onShowToast("Selecione o arquivo do certificado (.pfx ou .p12)", "warning");
      return;
    }
    if (!certPassword) {
      onShowToast("Insira a senha do certificado", "warning");
      return;
    }

    setIsUploadingCert(true);
    const formData = new FormData();
    formData.append('certificate', certFile);
    formData.append('password', certPassword);

    try {
      const res = await fetch('/api/settings/cert', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao configurar certificado.");
      
      setCert(data.cert);
      setCertPassword("");
      setCertFile(null);
      onShowToast(data.message, "success");
    } catch (err) {
      onShowToast(err.message, "error");
    } finally {
      setIsUploadingCert(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Certificado Digital Section */}
      <div className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#FFF' }}>
          <Shield style={{ color: cert ? 'var(--color-success)' : 'var(--color-warning)' }} />
          Certificado Digital A1 (.p12 / .pfx)
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
          
          {/* Status do Certificado */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>
              A assinatura digital dos RPS e a comunicação SSL mútua com o WebService da prefeitura exigem um certificado digital A1 válido.
            </p>
            {cert ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                <CheckCircle2 style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-success)' }}>Certificado Ativo</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Arquivo: {cert.filename}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Senha: Configurada e salva localmente</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                <AlertTriangle style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-warning)' }}>Nenhum Certificado Ativo</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Faça o upload do seu certificado ao lado para habilitar assinaturas e envios.</div>
                </div>
              </div>
            )}
          </div>

          {/* Upload Form */}
          <form onSubmit={handleUploadCert} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Arquivo do Certificado (.p12 / .pfx)</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="file" 
                  accept=".p12,.pfx" 
                  onChange={handleFileChange} 
                  id="cert-file-input"
                  style={{ display: 'none' }}
                />
                <label 
                  htmlFor="cert-file-input" 
                  className="dropzone"
                  style={{ padding: '1.5rem 1rem' }}
                >
                  <Upload className="dropzone-icon" />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {certFile ? certFile.name : "Clique para selecionar arquivo do certificado"}
                  </span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Senha do Certificado</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="Insira a senha do certificado"
                value={certPassword}
                onChange={(e) => setCertPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={isUploadingCert} style={{ alignSelf: 'flex-end' }}>
              {isUploadingCert ? <div className="spinner"></div> : "Salvar Certificado"}
            </button>
          </form>
        </div>
      </div>

      {/* Cadastro do Emissor Section */}
      <form onSubmit={handleSaveSettings} className="card">
        <h3 style={{ marginBottom: '1.5rem', color: '#FFF' }}>Dados da Empresa Emissora</h3>
        
        <div className="form-grid">
          
          <div className="form-group col-4">
            <label className="form-label">Ambiente de Operação</label>
            <select name="ambiente" className="form-input" value={settings.ambiente} onChange={handleInputChange}>
              <option value="2">Homologação (Testes)</option>
              <option value="1">Produção (Real)</option>
            </select>
          </div>

          <div className="form-group col-4">
            <label className="form-label">CNPJ do Prestador</label>
            <input 
              type="text" 
              name="cnpj" 
              className="form-input" 
              placeholder="00.000.000/0000-00" 
              value={settings.cnpj} 
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group col-4">
            <label className="form-label">Inscrição Municipal</label>
            <input 
              type="text" 
              name="inscricaoMunicipal" 
              className="form-input" 
              placeholder="12345678" 
              value={settings.inscricaoMunicipal} 
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group col-6">
            <label className="form-label">Razão Social</label>
            <input 
              type="text" 
              name="razaoSocial" 
              className="form-input" 
              placeholder="Minha Empresa LTDA" 
              value={settings.razaoSocial} 
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group col-6">
            <label className="form-label">Nome Fantasia</label>
            <input 
              type="text" 
              name="nomeFantasia" 
              className="form-input" 
              placeholder="Minha Empresa" 
              value={settings.nomeFantasia} 
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group col-4">
            <label className="form-label">CNAE Principal</label>
            <input 
              type="text" 
              name="cnae" 
              className="form-input" 
              placeholder="6202300" 
              value={settings.cnae} 
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group col-4">
            <label className="form-label">Optante Simples Nacional</label>
            <select name="optanteSimplesNacional" className="form-input" value={settings.optanteSimplesNacional} onChange={handleInputChange}>
              <option value="1">Sim</option>
              <option value="2">Não</option>
            </select>
          </div>

          <div className="form-group col-4">
            <label className="form-label">Regime Especial de Tributação</label>
            <select name="regimeEspecialTributacao" className="form-input" value={settings.regimeEspecialTributacao} onChange={handleInputChange}>
              <option value="0">Nenhum</option>
              <option value="01">01 - Microempresa Municipal</option>
              <option value="02">02 - Estimativa</option>
              <option value="03">03 - Sociedade de Profissionais</option>
              <option value="04">04 - Cooperativa</option>
              <option value="05">05 - Microempresário Individual (MEI)</option>
              <option value="06">06 - Microempresa ou Empresa de Pequeno Porte (ME/EPP)</option>
            </select>
            {settings.optanteSimplesNacional === "1" && (settings.regimeEspecialTributacao === "0" || !settings.regimeEspecialTributacao) && (
              <span style={{ fontSize: '0.8rem', color: 'var(--color-warning)', marginTop: '0.35rem', display: 'block' }}>
                Optante do Simples Nacional: selecione "05" (MEI) ou "06" (ME/EPP) — obrigatório pela prefeitura.
              </span>
            )}
          </div>

          <div className="form-group col-12" style={{ display: 'flex', gap: '2rem' }}>
            <label className="form-checkbox-group">
              <input 
                type="checkbox" 
                name="incentivoFiscal" 
                className="form-checkbox" 
                checked={settings.incentivoFiscal} 
                onChange={handleInputChange}
              />
              <span className="form-label" style={{ cursor: 'pointer' }}>Possui Incentivo Fiscal</span>
            </label>
          </div>

          {/* Endereço */}
          <div className="col-12 settings-section-title">Endereço da Empresa</div>

          <div className="form-group col-3">
            <label className="form-label">CEP</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="85851-000" 
              value={settings.endereco.cep} 
              onChange={(e) => handleNestedInputChange('endereco', 'cep', e.target.value)}
              required
            />
          </div>

          <div className="form-group col-6">
            <label className="form-label">Logradouro</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Avenida Brasil" 
              value={settings.endereco.logradouro} 
              onChange={(e) => handleNestedInputChange('endereco', 'logradouro', e.target.value)}
              required
            />
          </div>

          <div className="form-group col-3">
            <label className="form-label">Número</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="1000" 
              value={settings.endereco.numero} 
              onChange={(e) => handleNestedInputChange('endereco', 'numero', e.target.value)}
              required
            />
          </div>

          <div className="form-group col-4">
            <label className="form-label">Complemento</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Sala 10" 
              value={settings.endereco.complemento} 
              onChange={(e) => handleNestedInputChange('endereco', 'complemento', e.target.value)}
            />
          </div>

          <div className="form-group col-4">
            <label className="form-label">Bairro</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Centro" 
              value={settings.endereco.bairro} 
              onChange={(e) => handleNestedInputChange('endereco', 'bairro', e.target.value)}
              required
            />
          </div>

          <div className="form-group col-2">
            <label className="form-label">UF</label>
            <input 
              type="text" 
              className="form-input" 
              value={settings.endereco.uf} 
              onChange={(e) => handleNestedInputChange('endereco', 'uf', e.target.value)}
              disabled
            />
          </div>

          <div className="form-group col-2">
            <label className="form-label">Cód. Município</label>
            <input 
              type="text" 
              className="form-input" 
              value={settings.endereco.codigoMunicipio} 
              onChange={(e) => handleNestedInputChange('endereco', 'codigoMunicipio', e.target.value)}
              disabled
            />
          </div>

          {/* Contato */}
          <div className="col-12 settings-section-title">Informações de Contato</div>

          <div className="form-group col-6">
            <label className="form-label">Telefone</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="(45) 3000-0000" 
              value={settings.contato.telefone} 
              onChange={(e) => handleNestedInputChange('contato', 'telefone', e.target.value)}
            />
          </div>

          <div className="form-group col-6">
            <label className="form-label">E-mail</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="contato@minhaempresa.com" 
              value={settings.contato.email} 
              onChange={(e) => handleNestedInputChange('contato', 'email', e.target.value)}
            />
          </div>

        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <button type="submit" className="btn btn-primary" disabled={isSavingSettings}>
            <Save size={18} />
            {isSavingSettings ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      </form>
    </div>
  );
}
