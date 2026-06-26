import React, { useState } from 'react';
import { Shield, CheckCircle2, AlertTriangle, Upload, Save, ArrowLeft, KeyRound } from 'lucide-react';
import { apiFetch, apiJson } from '../api';

const vazio = {
  cnpj: '', inscricaoMunicipal: '', razaoSocial: '', nomeFantasia: '', cnae: '',
  incentivoFiscal: false, optanteSimplesNacional: '2', regimeEspecialTributacao: '0', ambiente: '2',
  endereco: { logradouro: '', numero: '', complemento: '', bairro: '', codigoMunicipio: '4108304', uf: 'PR', cep: '' },
  contato: { telefone: '', email: '' }
};

export default function EmissorForm({ emissor, onSaved, onCancel, onShowToast }) {
  const isEdit = !!(emissor && emissor.id);
  const [form, setForm] = useState(() => ({ ...vazio, ...(emissor || {}), endereco: { ...vazio.endereco, ...(emissor?.endereco || {}) }, contato: { ...vazio.contato, ...(emissor?.contato || {}) } }));
  const [token, setToken] = useState(emissor?.apiToken || '');
  const [certConfigured, setCertConfigured] = useState(!!emissor?.certConfigured);
  const [certFile, setCertFile] = useState(null);
  const [certPassword, setCertPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setNested = (sec, k, v) => setForm(p => ({ ...p, [sec]: { ...p[sec], [k]: v } }));

  const salvar = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = isEdit ? `/api/emissores/${emissor.id}` : '/api/emissores';
      const saved = await apiJson(url, { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(form) });
      onShowToast('Emissor salvo com sucesso!', 'success');
      onSaved(saved);
    } catch (err) { onShowToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const enviarCert = async (e) => {
    e.preventDefault();
    if (!certFile) return onShowToast('Selecione o arquivo .pfx/.p12', 'warning');
    if (!certPassword) return onShowToast('Informe a senha do certificado', 'warning');
    setUploading(true);
    const fd = new FormData();
    fd.append('certificate', certFile); fd.append('password', certPassword);
    try {
      const res = await apiFetch(`/api/emissores/${emissor.id}/cert`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar certificado.');
      setCertConfigured(true); setCertFile(null); setCertPassword('');
      onShowToast(data.message, 'success');
    } catch (err) { onShowToast(err.message, 'error'); }
    finally { setUploading(false); }
  };

  const regenerarToken = async () => {
    if (!window.confirm('Gerar novo token invalida o atual; o ERP precisará ser atualizado. Continuar?')) return;
    try {
      const data = await apiJson(`/api/emissores/${emissor.id}/token/regenerate`, { method: 'POST' });
      setToken(data.apiToken);
      onShowToast('Novo token gerado! Atualize no ERP.', 'success');
    } catch (err) { onShowToast(err.message, 'error'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <button className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={onCancel}><ArrowLeft size={16} /> Voltar</button>

      {/* Token + Certificado (apenas após salvar o emissor) */}
      {isEdit && (
        <div className="card">
          <h3 style={{ color: '#FFF', marginBottom: '1rem' }}>Token do ERP & Certificado</h3>
          <div className="form-group">
            <label className="form-label"><KeyRound size={14} /> Token (x-api-key) deste emissor</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input className="form-input" value={token} readOnly style={{ fontFamily: 'monospace' }} />
              <button type="button" className="btn btn-secondary" onClick={() => { navigator.clipboard?.writeText(token); onShowToast('Token copiado!', 'success'); }}>Copiar</button>
              <button type="button" className="btn btn-secondary" onClick={regenerarToken} style={{ whiteSpace: 'nowrap' }}>Gerar novo</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem', alignItems: 'end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: certConfigured ? 'rgba(16,185,129,0.05)' : 'rgba(245,158,11,0.05)', border: `1px solid ${certConfigured ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}` }}>
              {certConfigured ? <CheckCircle2 style={{ color: 'var(--color-success)' }} /> : <AlertTriangle style={{ color: 'var(--color-warning)' }} />}
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{certConfigured ? 'Certificado configurado' : 'Sem certificado'}</div>
            </div>
            <form onSubmit={enviarCert} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input type="file" accept=".p12,.pfx" id="certfile" style={{ display: 'none' }} onChange={(e) => setCertFile(e.target.files?.[0] || null)} />
              <label htmlFor="certfile" className="dropzone" style={{ padding: '0.75rem' }}>
                <Upload className="dropzone-icon" size={18} />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{certFile ? certFile.name : 'Selecionar .pfx/.p12'}</span>
              </label>
              <input type="password" className="form-input" placeholder="Senha do certificado" value={certPassword} onChange={(e) => setCertPassword(e.target.value)} />
              <button type="submit" className="btn btn-primary" disabled={uploading}>{uploading ? 'Enviando...' : <><Shield size={16} /> Salvar certificado</>}</button>
            </form>
          </div>
        </div>
      )}

      {/* Dados do emissor */}
      <form onSubmit={salvar} className="card">
        <h3 style={{ marginBottom: '1.5rem', color: '#FFF' }}>{isEdit ? 'Editar Emissor' : 'Novo Emissor'}</h3>
        <div className="form-grid">
          <div className="form-group col-4"><label className="form-label">Ambiente</label>
            <select name="ambiente" className="form-input" value={form.ambiente} onChange={(e) => set('ambiente', e.target.value)}>
              <option value="2">Homologação (Testes)</option><option value="1">Produção (Real)</option></select></div>
          <div className="form-group col-4"><label className="form-label">CNPJ</label>
            <input className="form-input" placeholder="00.000.000/0000-00" value={form.cnpj} onChange={(e) => set('cnpj', e.target.value)} required disabled={isEdit} /></div>
          <div className="form-group col-4"><label className="form-label">Inscrição Municipal</label>
            <input className="form-input" value={form.inscricaoMunicipal} onChange={(e) => set('inscricaoMunicipal', e.target.value)} required /></div>
          <div className="form-group col-6"><label className="form-label">Razão Social</label>
            <input className="form-input" value={form.razaoSocial} onChange={(e) => set('razaoSocial', e.target.value)} required /></div>
          <div className="form-group col-6"><label className="form-label">Nome Fantasia</label>
            <input className="form-input" value={form.nomeFantasia || ''} onChange={(e) => set('nomeFantasia', e.target.value)} /></div>
          <div className="form-group col-4"><label className="form-label">CNAE</label>
            <input className="form-input" placeholder="6202300" value={form.cnae || ''} onChange={(e) => set('cnae', e.target.value)} /></div>
          <div className="form-group col-4"><label className="form-label">Optante Simples Nacional</label>
            <select className="form-input" value={form.optanteSimplesNacional} onChange={(e) => set('optanteSimplesNacional', e.target.value)}>
              <option value="1">Sim</option><option value="2">Não</option></select></div>
          <div className="form-group col-4"><label className="form-label">Regime Especial de Tributação</label>
            <select className="form-input" value={form.regimeEspecialTributacao} onChange={(e) => set('regimeEspecialTributacao', e.target.value)}>
              <option value="0">Nenhum</option>
              <option value="01">01 - Microempresa Municipal</option>
              <option value="02">02 - Estimativa</option>
              <option value="03">03 - Sociedade de Profissionais</option>
              <option value="04">04 - Cooperativa</option>
              <option value="05">05 - Microempresário Individual (MEI)</option>
              <option value="06">06 - Microempresa ou Empresa de Pequeno Porte (ME/EPP)</option>
            </select></div>
          <div className="form-group col-12" style={{ display: 'flex', gap: '2rem' }}>
            <label className="form-checkbox-group"><input type="checkbox" className="form-checkbox" checked={form.incentivoFiscal} onChange={(e) => set('incentivoFiscal', e.target.checked)} />
              <span className="form-label" style={{ cursor: 'pointer' }}>Possui Incentivo Fiscal</span></label>
          </div>

          <div className="col-12 settings-section-title">Endereço da Empresa</div>
          <div className="form-group col-3"><label className="form-label">CEP</label>
            <input className="form-input" value={form.endereco.cep} onChange={(e) => setNested('endereco', 'cep', e.target.value)} required /></div>
          <div className="form-group col-6"><label className="form-label">Logradouro</label>
            <input className="form-input" value={form.endereco.logradouro} onChange={(e) => setNested('endereco', 'logradouro', e.target.value)} required /></div>
          <div className="form-group col-3"><label className="form-label">Número</label>
            <input className="form-input" value={form.endereco.numero} onChange={(e) => setNested('endereco', 'numero', e.target.value)} required /></div>
          <div className="form-group col-4"><label className="form-label">Complemento</label>
            <input className="form-input" value={form.endereco.complemento} onChange={(e) => setNested('endereco', 'complemento', e.target.value)} /></div>
          <div className="form-group col-4"><label className="form-label">Bairro</label>
            <input className="form-input" value={form.endereco.bairro} onChange={(e) => setNested('endereco', 'bairro', e.target.value)} required /></div>
          <div className="form-group col-2"><label className="form-label">UF</label>
            <input className="form-input" value={form.endereco.uf} onChange={(e) => setNested('endereco', 'uf', e.target.value)} /></div>
          <div className="form-group col-2"><label className="form-label">Cód. Município</label>
            <input className="form-input" value={form.endereco.codigoMunicipio} onChange={(e) => setNested('endereco', 'codigoMunicipio', e.target.value)} /></div>

          <div className="col-12 settings-section-title">Contato</div>
          <div className="form-group col-6"><label className="form-label">Telefone</label>
            <input className="form-input" value={form.contato.telefone} onChange={(e) => setNested('contato', 'telefone', e.target.value)} /></div>
          <div className="form-group col-6"><label className="form-label">E-mail</label>
            <input type="email" className="form-input" value={form.contato.email} onChange={(e) => setNested('contato', 'email', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}><Save size={18} /> {saving ? 'Salvando...' : 'Salvar Emissor'}</button>
        </div>
        {!isEdit && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Após salvar, você poderá enviar o certificado e copiar o token do ERP.</p>}
      </form>
    </div>
  );
}
