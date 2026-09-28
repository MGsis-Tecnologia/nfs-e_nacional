// Script de teste para validar integração com nfse.gov.br em homologação
// Uso: node test-homologacao.js
// Este script simula o fluxo completo sem realmente enviar para a API

import 'dotenv/config';
import * as nfseValidation from './utils/nfseValidation.js';
import * as dpsGenerator from './utils/dpsGenerator.js';

console.log('\n========== TESTE DE INTEGRAÇÃO - NFSE.GOV.BR HOMOLOGAÇÃO ==========\n');

// Dados de exemplo para teste
const emissorExemplo = {
  id: 'test-001',
  cnpj: '11222333000181', // CNPJ válido (fake)
  inscricaoMunicipal: '123456789',
  razaoSocial: 'Empresa Teste LTDA',
  nomeFantasia: 'Empresa Teste',
  cnae: '6209100',
  incentivoFiscal: false,
  optanteSimplesNacional: '1',
  regimeEspecialTributacao: '6',
  ambiente: '2', // Homologação
  padraoIntegracao: 'nfse-gov-br',
  versaoLayout: '2.00',
  endereco: {
    logradouro: 'Rua Teste',
    numero: '123',
    bairro: 'Centro',
    cep: '12345678',
    uf: 'PR',
    codigoMunicipio: '4106902' // Curitiba
  },
  contato: {
    telefone: '4133334444',
    email: 'teste@empresa.com.br'
  }
};

const notaExemplo = {
  id: 'nota-001',
  numeroRps: '1',
  numeroLote: '1',
  serieRps: '1',
  dataEmissao: new Date().toISOString(),
  competencia: new Date().toISOString().slice(0, 10),
  tomador: {
    cpfCnpj: '98765432000190',
    razaoSocial: 'Cliente Teste LTDA',
    inscricaoMunicipal: '987654',
    endereco: {
      logradouro: 'Av. Cliente',
      numero: '456',
      complemento: 'Sala 789',
      bairro: 'Bairro',
      codigoMunicipio: '4106902',
      uf: 'PR',
      cep: '87654321'
    },
    contato: {
      telefone: '4187654321',
      email: 'cliente@empresa.com.br'
    }
  },
  servico: {
    itemListaServico: '01.07',
    codigoTributacaoMunicipio: '080502',
    discriminacao: 'Consultoria empresarial',
    codigoMunicipio: '4106902',
    municipioIncidencia: '4106902',
    valorServicos: '1000.00',
    aliquota: '3.0000',
    issRetido: '2',
    exigibilidadeIss: '1'
  }
};

// ============ TESTES ============

async function executarTestes() {
  let totalTestes = 0;
  let sucessos = 0;

  const teste = (nome, funcao) => {
    totalTestes++;
    console.log(`\n[${totalTestes}] ${nome}`);
    try {
      funcao();
      sucessos++;
      console.log('✅ PASSOU');
    } catch (err) {
      console.log(`❌ FALHOU: ${err.message}`);
    }
  };

  const testeAsync = async (nome, funcao) => {
    totalTestes++;
    console.log(`\n[${totalTestes}] ${nome}`);
    try {
      await funcao();
      sucessos++;
      console.log('✅ PASSOU');
    } catch (err) {
      console.log(`❌ FALHOU: ${err.message}`);
    }
  };

  // --------- Testes Síncronos ---------

  teste('Validar dados da DPS', () => {
    const resultado = dpsGenerator.validarDpsNfseCentral(notaExemplo, emissorExemplo);
    if (resultado.length > 0) {
      throw new Error(`Validação falhou: ${resultado.join(', ')}`);
    }
  });

  teste('Gerar DPS XML', () => {
    const { dpsXml, metadados } = dpsGenerator.gerarDpsXmlNfseCentral(notaExemplo, emissorExemplo);
    if (!dpsXml || dpsXml.length === 0) {
      throw new Error('XML gerado vazio');
    }
    if (!dpsXml.includes('<EnviarLoteRpsSincronoEnvio')) {
      throw new Error('XML não contém estrutura esperada');
    }
    console.log(`   (XML gerado com ${dpsXml.length} bytes)`);
  });

  teste('Preparar payload REST', () => {
    const { dpsXml } = dpsGenerator.gerarDpsXmlNfseCentral(notaExemplo, emissorExemplo);
    const payload = dpsGenerator.prepararPayloadNfseCentral(dpsXml, {
      cnpj: emissorExemplo.cnpj,
      numeroRps: notaExemplo.numeroRps,
      numeroLote: notaExemplo.numeroLote,
      codigoMunicipioServico: notaExemplo.servico.codigoMunicipio
    });
    if (!payload.xmlDPS || !payload.cnpj) {
      throw new Error('Payload incompleto');
    }
  });

  teste('Extrair dados NFS-e de resposta simulada', () => {
    const resposta = {
      numeroNfse: '123456',
      codigoVerificacao: 'ABC123DEF',
      chaveAcesso: 'CHV123456789',
      dataAutorizacao: '2026-09-28T10:30:00'
    };
    const dados = dpsGenerator.extrairDadosNfseResposta(resposta);
    if (!dados.numeroNfse || dados.numeroNfse !== '123456') {
      throw new Error('Extração falhou');
    }
  });

  // --------- Testes Assíncronos ---------

  await testeAsync('Validar dados para envio DPS', () => {
    const resultado = nfseValidation.validarDadosParaEnvioDps(notaExemplo, emissorExemplo);
    if (!resultado.valido) {
      throw new Error(`Validação falhou: ${resultado.erros.join(', ')}`);
    }
  });

  await testeAsync('Simular fluxo de envio DPS', async () => {
    const resultado = await nfseValidation.simularFluxoEnvioDps(notaExemplo, emissorExemplo);
    if (!resultado.sucesso) {
      throw new Error(`Simulação falhou: ${resultado.erros.join(', ')}`);
    }
    console.log(`   (${resultado.etapas.length} etapas concluídas)`);
  });

  await testeAsync('Verificar conectividade nfse.gov.br', async () => {
    console.log('   (conectando aos servidores...)')
    const resultado = await nfseValidation.verificarConectividadeNfseCentral();
    const homolog = resultado.homologacao;
    const prod = resultado.producao;

    console.log(`   Homologação: ${homolog.status ? '✓ OK' : '✗ ERRO'} (status ${homolog.statusCode || 'N/A'})`);
    console.log(`   Produção: ${prod.status ? '✓ OK' : '✗ ERRO'} (status ${prod.statusCode || 'N/A'})`);

    if (!homolog.status) {
      console.log(`   ⚠️  Aviso: não foi possível alcançar ambiente de homologação`);
      // Não falhar o teste, pois pode estar offline
    }
  });

  // --------- Resumo ---------

  console.log('\n========== RESUMO ==========');
  console.log(`Total de testes: ${totalTestes}`);
  console.log(`Sucessos: ${sucessos}`);
  console.log(`Falhas: ${totalTestes - sucessos}`);
  console.log(`Taxa de sucesso: ${Math.round((sucessos / totalTestes) * 100)}%`);

  if (sucessos === totalTestes) {
    console.log('\n✅ TODOS OS TESTES PASSARAM!');
    console.log('\nPróximo passo: Integrar com certificado real e testar envio em homologação.');
    process.exit(0);
  } else {
    console.log('\n❌ ALGUNS TESTES FALHARAM');
    process.exit(1);
  }
}

executarTestes().catch(err => {
  console.error('Erro ao executar testes:', err);
  process.exit(1);
});
