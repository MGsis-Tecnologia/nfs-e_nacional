import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'brasao-foz.png');

// ---- formatadores ----
const num2 = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return isNaN(n) ? '0,00' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const ali4 = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return isNaN(n) ? '0,0000' : n.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
};
const fmtDoc = (cnpj, cpf) => {
  if (cnpj) return String(cnpj).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (cpf) return String(cpf).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return '';
};
const fmtCep = (c) => c ? String(c).replace(/^(\d{5})(\d{3})$/, '$1-$2') : '';
const fmtFone = (f) => {
  const d = String(f || '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return f || '';
};
const dataHora = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
const dataBR = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR');
};
const competencia = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
};

const REGIMES = {
  '1': 'Microempresa Municipal',
  '2': 'Estimativa',
  '3': 'Sociedade de Profissionais',
  '4': 'Cooperativa',
  '5': 'Microempresário Individual (MEI)',
  '6': 'Microempresário e Empresa de Pequeno Porte (ME EPP)'
};
// Descrições da lista de serviços (LC 116) — adicione mais conforme necessário.
const ITENS_LC116 = {
  '0107': 'Suporte técnico em informática, inclusive instalação, configuração e manutenção de programas de computação e bancos de dados.'
};

const enderecoLinha = (e) => {
  if (!e) return '';
  const p1 = [e.logradouro, e.numero, e.complemento, e.bairro].filter(Boolean).join(', ');
  const p2 = ['CEP: ' + fmtCep(e.cep), 'Foz do Iguaçu', e.uf].filter(x => x && x !== 'CEP: ').join(' - ');
  return [p1, p2].filter(Boolean).join(' - ');
};

export async function generateNfsePdf(nfse, settings = {}, rps = null) {
  const isSimples = String(settings.optanteSimplesNacional) === '1';
  const mask = '*****';
  const sv = nfse.servico || {};
  const vv = nfse.valores || {};
  const rpsSv = (rps && rps.servico) || {};

  // QR Code (chave de acesso nacional)
  let qrBuf = null;
  try {
    if (nfse.chaveAcesso) qrBuf = await QRCode.toBuffer(nfse.chaveAcesso, { margin: 0, width: 150 });
  } catch { /* segue sem QR */ }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 28 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const L = 28;
      const R = doc.page.width - 28;
      const W = R - L;
      const GRAY = '#555';

      const hr = (y) => doc.lineWidth(0.6).strokeColor('#999').moveTo(L, y).lineTo(R, y).stroke();
      const lbl = (t, x, y, w) => doc.fontSize(6.5).fillColor(GRAY).font('Helvetica').text(t || '', x, y, { width: w });
      const val = (t, x, y, opts = {}) =>
        doc.fontSize(opts.size || 9).fillColor('#000').font(opts.font || 'Helvetica-Bold')
          .text(t != null && t !== '' ? String(t) : '', x, y, { width: opts.w, align: opts.align });
      const sec = (t, y) => { hr(y); doc.fontSize(7).fillColor(GRAY).font('Helvetica').text(t, L, y + 3); };
      // campo: rótulo + valor logo abaixo
      const field = (label, value, x, y, w, opts = {}) => { lbl(label, x, y, w); val(value, x, y + 8, { w, ...opts }); };

      // ===== CABEÇALHO =====
      let y = 28;
      // Logo (brasão) se existir
      if (fs.existsSync(LOGO_PATH)) {
        try { doc.image(LOGO_PATH, L, y, { fit: [72, 72] }); } catch { /* ignore */ }
      } else {
        doc.lineWidth(0.6).strokeColor('#bbb').rect(L, y, 72, 72).stroke();
        doc.fontSize(6).fillColor('#bbb').font('Helvetica').text('BRASÃO', L, y + 33, { width: 72, align: 'center' });
      }

      const cx = L + 84;
      const cw = 330;
      doc.fontSize(14).fillColor('#000').font('Helvetica-Bold').text('MUNICÍPIO DE FOZ DO IGUAÇU', cx, y, { width: cw });
      doc.fontSize(8.5).font('Helvetica').fillColor('#222').text('Secretaria Municipal de Finanças e Orçamento', cx, y + 18, { width: cw });
      doc.fontSize(7).fillColor('#333')
        .text('CNPJ: 76.206.606/0001-40', cx, y + 30, { width: cw })
        .text('Praça Getúlio Vargas, Nº 280 - Centro - CEP: 85851-340 - Foz do Iguaçu-PR', cx, y + 39, { width: cw })
        .text('Email: fazenda.foz@pmfi.pr.gov.br   Home Page: https://www.foz.pr.gov.br', cx, y + 48, { width: cw });

      // Caixa direita: número, código verificação, QR
      const bx = R - 140, bw = 140, bh = 100;
      doc.lineWidth(0.8).strokeColor('#333').rect(bx, y, bw, bh).stroke();
      const numStr = String(nfse.numero || '');
      const head = numStr.length > 7 ? numStr.slice(0, numStr.length - 7) : '';
      const tail = numStr.length > 7 ? numStr.slice(-7) : numStr;
      doc.fontSize(7).fillColor('#000').font('Helvetica').text(`Nota: ${head}`, bx + 6, y + 5, { width: bw - 12, align: 'right' });
      doc.fontSize(15).font('Helvetica-Bold').text(tail, bx + 6, y + 13, { width: bw - 12, align: 'right' });
      doc.fontSize(7).font('Helvetica').text('Código Verificação', bx + 6, y + 31, { width: bw - 12, align: 'right' });
      doc.fontSize(10).font('Helvetica-Bold').text(nfse.codigoVerificacao || '', bx + 6, y + 39, { width: bw - 12, align: 'right' });
      // QR centralizado e dentro da caixa (caixa: y .. y+bh, bh=100)
      if (qrBuf) { try { doc.image(qrBuf, bx + (bw - 44) / 2, y + 53, { fit: [44, 44] }); } catch { /* ignore */ } }

      // ===== TÍTULO =====
      y = 132;
      hr(y); y += 4;
      doc.fontSize(11).fillColor('#000').font('Helvetica-Bold').text('NOTA FISCAL DE SERVIÇOS ELETRÔNICA - NFS-e', L, y, { width: W, align: 'center' });
      doc.fontSize(8).font('Helvetica').text(
        `RPS número ${nfse.rps?.numero || rps?.numeroRps || ''} Série ${nfse.rps?.serie || rps?.serieRps || ''} emitido em ${dataBR(nfse.dataEmissao)}`,
        L, y + 14, { width: W, align: 'center' });
      y += 28; hr(y); y += 5;

      // ===== INFO PRINCIPAL =====
      const c3 = W / 3;
      field('Emissão (Horário de Brasília)', dataHora(nfse.dataEmissao), L, y, c3 - 6);
      field('Período de Competência', competencia(nfse.competencia), L + c3, y, c3 - 6);
      field('Município de Prestação do Serviço', 'Foz do Iguaçu - PR', L + 2 * c3, y, c3 - 6);
      y += 22;
      field('Reg. Especial Tributação', REGIMES[String(parseInt(settings.regimeEspecialTributacao, 10))] || '-', L, y, c3 * 2 - 6, { size: 8 });
      field('Exigibilidade do ISS', 'Exigível em Foz do Iguaçu', L + 2 * c3, y, c3 - 6, { size: 8 });
      y += 24;

      // ===== PRESTADOR =====
      const pr = nfse.prestador || {};
      // Contato do prestador: vem do cadastro da prefeitura na RESPOSTA (PrestadorServico/Contato),
      // que é o que a DANFSE oficial mostra. Usamos esse valor; se vier vazio ou placeholder
      // (email@nao_informado.com / 0000000000), caímos no contato das Configurações.
      const ehPlaceholderEmail = (e) => !e || /nao_informado/i.test(e);
      const ehPlaceholderFone = (f) => !f || /^0+$/.test(String(f).replace(/\D/g, ''));
      const prEmail = !ehPlaceholderEmail(pr.contato?.email) ? pr.contato.email : ((settings.contato && settings.contato.email) || '');
      const prFone = !ehPlaceholderFone(pr.contato?.telefone) ? pr.contato.telefone : ((settings.contato && settings.contato.telefone) || '');
      sec('PRESTADOR DE SERVIÇOS', y); y += 13;
      field('Razão Social', pr.razaoSocial, L, y, W); y += 18;
      field('Nome Fantasia', pr.nomeFantasia, L, y, c3 * 2 - 6);
      field('Email', prEmail, L + 2 * c3, y, c3 - 6, { size: 8 }); y += 18;
      const c6 = W / 6;
      field('CPF/CNPJ', fmtDoc(pr.cnpj), L, y, c6 - 4, { size: 8 });
      field('Inscrição Municipal', pr.inscricaoMunicipal, L + c6, y, c6 - 4, { size: 8 });
      field('Inscrição Estadual', '', L + 2 * c6, y, c6 - 4, { size: 8 });
      field('Simples Nacional', isSimples ? 'Sim' : 'Não', L + 3 * c6, y, c6 - 4, { size: 8 });
      field('Incentivador Cultural', settings.incentivoFiscal ? 'Sim' : 'Não', L + 4 * c6, y, c6 - 4, { size: 8 });
      field('Fone/Fax', fmtFone(prFone), L + 5 * c6, y, c6 - 4, { size: 8 }); y += 18;
      field('Endereço', enderecoLinha(pr.endereco), L, y, W, { font: 'Helvetica-BoldOblique', size: 8 }); y += 20;

      // ===== TOMADOR =====
      const to = nfse.tomador || {};
      sec('TOMADOR DE SERVIÇOS', y); y += 13;
      field('Nome/Razão Social', to.razaoSocial, L, y, W); y += 18;
      field('CPF/CNPJ', fmtDoc(to.cnpj, to.cpf), L, y, c3 - 6, { size: 8 });
      field('Fone/Fax', fmtFone(to.contato?.telefone), L + c3, y, c3 - 6, { size: 8 });
      field('E-mail', to.contato?.email, L + 2 * c3, y, c3 - 6, { size: 8 }); y += 18;
      field('Endereço', enderecoLinha(to.endereco), L, y, W, { font: 'Helvetica-BoldOblique', size: 8 }); y += 20;

      // ===== SERVIÇO PRESTADO =====
      sec('SERVIÇO PRESTADO', y); y += 13;
      const itemFmt = sv.itemListaServico ? String(sv.itemListaServico) : '';
      const descrItem = ITENS_LC116[itemFmt] ? ` - ${ITENS_LC116[itemFmt]}` : '';
      doc.fontSize(8).fillColor('#000').font('Helvetica-Bold')
        .text(`${itemFmt}${descrItem} CNAE: ${sv.codigoCnae || '-'}.`, L, y, { width: W }); y += 22;

      // ===== DESCRIÇÃO =====
      sec('DESCRIÇÃO DOS SERVIÇOS', y); y += 13;
      doc.fontSize(8.5).fillColor('#000').font('Courier-Bold').text(sv.discriminacao || '', L, y, { width: W });

      // ===== RETENÇÕES FEDERAIS (parte inferior) =====
      let yb = 640;
      sec('RETENÇÕES FEDERAIS', yb); yb += 14;
      const r6 = W / 6;
      const ret = [
        ['PIS (R$)', num2(rpsSv.valorPis)],
        ['COFINS (R$)', num2(rpsSv.valorCofins)],
        ['INSS (R$)', num2(rpsSv.valorInss)],
        ['IR (R$)', num2(rpsSv.valorIr)],
        ['CSLL (R$)', num2(rpsSv.valorCsll)],
        ['Outras Retenções (R$)', num2(rpsSv.outrasRetencoes)]
      ];
      ret.forEach(([t, v], i) => {
        const x = L + i * r6;
        lbl(t, x, yb, r6 - 4);
        val(v, x, yb + 8, { w: r6 - 6, align: i === 5 ? 'right' : 'left', size: 8 });
      });
      yb += 24;

      // ===== VALORES =====
      sec('VALORES', yb); yb += 14;
      const c5 = W / 5;
      const cell = (t, v, i, opts = {}) => {
        const x = L + i * c5;
        lbl(t, x, yb, c5 - 4);
        val(v, x, yb + 8, { w: c5 - 6, align: opts.align || 'left', size: opts.size || 9, font: opts.font });
      };
      cell('Deduções (R$)', num2(rpsSv.valorDeducoes), 0);
      cell('Desc. Cond. (R$)', num2(rpsSv.descontoCondicionado), 1);
      cell('Desc. Incond. (R$)', num2(rpsSv.descontoIncondicionado), 2);
      cell('Base de Cálculo ISS (R$)', isSimples ? mask : num2(vv.baseCalculo), 3, { align: 'right' });
      cell('Alíquota ISS (%)', ali4(vv.aliquota || rpsSv.aliquota), 4, { align: 'right' });
      yb += 24;
      cell('Valor dos Serviços (R$)', num2(sv.valorServicos || rpsSv.valorServicos), 0);
      cell('ISS (R$)', isSimples ? mask : num2(vv.valorIss), 1, { align: 'left' });
      cell('ISS Retido (R$)', isSimples ? mask : num2(0), 2, { align: 'left' });
      cell('Valor Líquido (R$)', num2(vv.valorLiquidoNfse), 3, { align: 'right' });
      cell('Valor Total da Nota (R$)', num2(vv.valorLiquidoNfse || sv.valorServicos), 4, { align: 'right', font: 'Helvetica-Bold' });
      yb += 26;

      // ===== OUTRAS INFORMAÇÕES =====
      sec('OUTRAS INFORMAÇÕES', yb); yb += 14;
      doc.fontSize(7.5).fillColor('#000').font('Helvetica').text(nfse.outrasInformacoes || '', L, yb, { width: W });

      // ===== RODAPÉ =====
      doc.fontSize(7).fillColor('#333').font('Helvetica').text(
        `Para validação desta NFS-e acesse: http://fozdoiguacupr.gestaoiss.com.br/externo/nfse/validar`,
        L, doc.page.height - 50, { width: W });
      doc.fontSize(7).fillColor('#333').text(
        'Esta NFS-e é autodeclaratória. Esta NFS-e foi emitida com respaldo no Decreto nº 33.951 de 16 de Setembro de 2025.',
        L, doc.page.height - 40, { width: W });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
