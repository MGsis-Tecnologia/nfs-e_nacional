#!/usr/bin/env node
// Testes de casos extremos e validação de erros
// Uso: node test-casos-extremos.js

import 'dotenv/config';
import * as dpsGenerator from './utils/dpsGenerator.js';
import * as nfseValidation from './utils/nfseValidation.js';

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  TESTES DE CASOS EXTREMOS - NFSE.GOV.BR NACIONAL         ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Emissor base para todos os testes
const emissorBase = {
  cnpj: '11222333000181',
  inscricaoMunicipal: '123456789',
  razaoSocial: 'Empresa Teste LTDA',
  cnae: '6209100',
  incentivoFiscal: false,
  optanteSimplesNacional: '2',
  regimeEspecialTributacao: '0',
  padraoIntegracao: 'nfse-gov-br',
  versaoLayout: '2.00'
};

// Testes
const testes = [];

// ============ TESTE 1: Tomador com CPF ============
testes.push({
  nome: 'Tomador com CPF (não CNPJ)',
  nota: {
    id: 'test-cpf-001',
    numeroRps: '1',
    numeroLote: '1',
    serieRps: '1',
    dataEmissao: new Date().toISOString(),
    competencia: '2026-09',
    tomador: {
      cpfCnpj: '12345678901', // CPF: 11 dígitos
      razaoSocial: 'João da Silva',
      endereco: {
        logradouro: 'Rua A',
        numero: '100',
        bairro: 'Centro',
        codigoMunicipio: '4106902',
        uf: 'PR',
        cep: '80010000'
      }
    },
    servico: {
      itemListaServico: '01.07',
      codigoTributacaoMunicipio: '080502',
      discriminacao: 'Consultoria',
      codigoMunicipio: '4106902',
      valorServicos: '500.00',
      aliquota: '3.00',
      issRetido: '2'
    }
  }
});

// ============ TESTE 2: Tomador com CNPJ ============
testes.push({
  nome: 'Tomador com CNPJ',
  nota: {
    id: 'test-cnpj-001',
    numeroRps: '2',
    numeroLote: '1',
    serieRps: '1',
    dataEmissao: new Date().toISOString(),
    competencia: '2026-09',
    tomador: {
      cpfCnpj: '98765432000190', // CNPJ: 14 dígitos
      razaoSocial: 'Cliente Empresa LTDA',
      endereco: {
        logradouro: 'Av. Principal',
        numero: '500',
        bairro: 'Bairro',
        codigoMunicipio: '4106902',
        uf: 'PR',
        cep: '80010000'
      }
    },
    servico: {
      itemListaServico: '01.07',
      codigoTributacaoMunicipio: '080502',
      discriminacao: 'Serviço de consultoria',
      codigoMunicipio: '4106902',
      valorServicos: '1000.00',
      aliquota: '3.00'
    }
  }
});

// ============ TESTE 3: Valor muito pequeno ============
testes.push({
  nome: 'Valor muito pequeno (R$ 0,01)',
  nota: {
    id: 'test-small-001',
    numeroRps: '3',
    numeroLote: '1',
    serieRps: '1',
    dataEmissao: new Date().toISOString(),
    competencia: '2026-09',
    tomador: {
      cpfCnpj: '11222333000181',
      razaoSocial: 'Empresa Teste',
      endereco: {
        logradouro: 'Rua',
        numero: '1',
        bairro: 'Centro',
        codigoMunicipio: '4106902',
        uf: 'PR',
        cep: '80010000'
      }
    },
    servico: {
      itemListaServico: '01.07',
      codigoTributacaoMunicipio: '080502',
      discriminacao: 'Serviço mínimo',
      codigoMunicipio: '4106902',
      valorServicos: '0.01',
      aliquota: '3.00'
    }
  }
});

// ============ TESTE 4: Valor muito grande ============
testes.push({
  nome: 'Valor muito grande (R$ 999.999.99)',
  nota: {
    id: 'test-large-001',
    numeroRps: '4',
    numeroLote: '1',
    serieRps: '1',
    dataEmissao: new Date().toISOString(),
    competencia: '2026-09',
    tomador: {
      cpfCnpj: '11222333000181',
      razaoSocial: 'Empresa Teste',
      endereco: {
        logradouro: 'Rua',
        numero: '1',
        bairro: 'Centro',
        codigoMunicipio: '4106902',
        uf: 'PR',
        cep: '80010000'
      }
    },
    servico: {
      itemListaServico: '01.07',
      codigoTributacaoMunicipio: '080502',
      discriminacao: 'Serviço premium',
      codigoMunicipio: '4106902',
      valorServicos: '999999.99',
      aliquota: '3.00'
    }
  }
});

// ============ TESTE 5: Sem alíquota ============
testes.push({
  nome: 'Serviço sem alíquota (aliquota = 0)',
  nota: {
    id: 'test-noaliq-001',
    numeroRps: '5',
    numeroLote: '1',
    serieRps: '1',
    dataEmissao: new Date().toISOString(),
    competencia: '2026-09',
    tomador: {
      cpfCnpj: '11222333000181',
      razaoSocial: 'Empresa Teste',
      endereco: {
        logradouro: 'Rua',
        numero: '1',
        bairro: 'Centro',
        codigoMunicipio: '4106902',
        uf: 'PR',
        cep: '80010000'
      }
    },
    servico: {
      itemListaServico: '01.07',
      codigoTributacaoMunicipio: '080502',
      discriminacao: 'Serviço isento',
      codigoMunicipio: '4106902',
      valorServicos: '100.00',
      aliquota: '0', // Sem alíquota
      issRetido: '2'
    }
  }
});

// ============ TESTE 6: ISS Retido ============
testes.push({
  nome: 'ISS Retido na Fonte',
  nota: {
    id: 'test-retido-001',
    numeroRps: '6',
    numeroLote: '1',
    serieRps: '1',
    dataEmissao: new Date().toISOString(),
    competencia: '2026-09',
    tomador: {
      cpfCnpj: '11222333000181',
      razaoSocial: 'Empresa Teste',
      endereco: {
        logradouro: 'Rua',
        numero: '1',
        bairro: 'Centro',
        codigoMunicipio: '4106902',
        uf: 'PR',
        cep: '80010000'
      }
    },
    servico: {
      itemListaServico: '01.07',
      codigoTributacaoMunicipio: '080502',
      discriminacao: 'Serviço com retenção',
      codigoMunicipio: '4106902',
      valorServicos: '500.00',
      aliquota: '3.00',
      issRetido: '1' // Sim, retido
    }
  }
});

// ============ TESTE 7: Simples Nacional ============
testes.push({
  nome: 'Empresa Simples Nacional',
  nota: {
    id: 'test-simples-001',
    numeroRps: '7',
    numeroLote: '1',
    serieRps: '1',
    dataEmissao: new Date().toISOString(),
    competencia: '2026-09',
    tomador: {
      cpfCnpj: '11222333000181',
      razaoSocial: 'Empresa',
      endereco: {
        logradouro: 'Rua',
        numero: '1',
        bairro: 'Centro',
        codigoMunicipio: '4106902',
        uf: 'PR',
        cep: '80010000'
      }
    },
    servico: {
      itemListaServico: '01.07',
      codigoTributacaoMunicipio: '080502',
      discriminacao: 'Serviço',
      codigoMunicipio: '4106902',
      valorServicos: '100.00',
      aliquota: '3.00'
    }
  },
  emissor: {
    ...emissorBase,
    optanteSimplesNacional: '1',
    regimeEspecialTributacao: '6' // ME/EPP
  }
});

// ============ TESTE 8: Descrição longa ============
testes.push({
  nome: 'Descrição de serviço muito longa',
  nota: {
    id: 'test-long-001',
    numeroRps: '8',
    numeroLote: '1',
    serieRps: '1',
    dataEmissao: new Date().toISOString(),
    competencia: '2026-09',
    tomador: {
      cpfCnpj: '11222333000181',
      razaoSocial: 'Empresa Teste',
      endereco: {
        logradouro: 'Rua',
        numero: '1',
        bairro: 'Centro',
        codigoMunicipio: '4106902',
        uf: 'PR',
        cep: '80010000'
      }
    },
    servico: {
      itemListaServico: '01.07',
      codigoTributacaoMunicipio: '080502',
      discriminacao: 'Consultoria especializada em gestão empresarial, incluindo análise estratégica, planejamento financeiro, reorganização operacional e treinamento de pessoal com foco em maximização de lucros e eficiência operacional.',
      codigoMunicipio: '4106902',
      valorServicos: '5000.00',
      aliquota: '3.00'
    }
  }
});

// ============ TESTE 9: CEP com hífen ============
testes.push({
  nome: 'CEP com formatação (80010-000)',
  nota: {
    id: 'test-cep-001',
    numeroRps: '9',
    numeroLote: '1',
    serieRps: '1',
    dataEmissao: new Date().toISOString(),
    competencia: '2026-09',
    tomador: {
      cpfCnpj: '11222333000181',
      razaoSocial: 'Empresa',
      endereco: {
        logradouro: 'Rua',
        numero: '1',
        bairro: 'Centro',
        codigoMunicipio: '4106902',
        uf: 'PR',
        cep: '80010-000' // Com hífen
      }
    },
    servico: {
      itemListaServico: '01.07',
      codigoTributacaoMunicipio: '080502',
      discriminacao: 'Serviço',
      codigoMunicipio: '4106902',
      valorServicos: '100.00',
      aliquota: '3.00'
    }
  }
});

// ============ TESTE 10: Diferentes municípios ============
testes.push({
  nome: 'Diferentes códigos de município',
  nota: {
    id: 'test-munic-001',
    numeroRps: '10',
    numeroLote: '1',
    serieRps: '1',
    dataEmissao: new Date().toISOString(),
    competencia: '2026-09',
    tomador: {
      cpfCnpj: '11222333000181',
      razaoSocial: 'Empresa SP',
      endereco: {
        logradouro: 'Rua',
        numero: '1',
        bairro: 'Centro',
        codigoMunicipio: '3550308', // São Paulo
        uf: 'SP',
        cep: '01310100'
      }
    },
    servico: {
      itemListaServico: '01.07',
      codigoTributacaoMunicipio: '080502',
      discriminacao: 'Serviço em SP',
      codigoMunicipio: '3550308',
      valorServicos: '1000.00',
      aliquota: '3.00'
    }
  }
});

// ============ ERROS - Dados Inválidos ============

const erros = [];

// Erro 1: CPF/CNPJ inválido
erros.push({
  nome: 'Erro: CPF/CNPJ inválido',
  nota: {
    id: 'test-err-cpf',
    numeroRps: '100',
    numeroLote: '1',
    serieRps: '1',
    dataEmissao: new Date().toISOString(),
    competencia: '2026-09',
    tomador: {
      cpfCnpj: 'invalid', // INVÁLIDO
      razaoSocial: 'Empresa',
      endereco: {
        logradouro: 'Rua',
        numero: '1',
        bairro: 'Centro',
        codigoMunicipio: '4106902',
        uf: 'PR',
        cep: '80010000'
      }
    },
    servico: {
      itemListaServico: '01.07',
      codigoTributacaoMunicipio: '080502',
      discriminacao: 'Serviço',
      codigoMunicipio: '4106902',
      valorServicos: '100.00',
      aliquota: '3.00'
    }
  }
});

// Erro 2: Valor zero
erros.push({
  nome: 'Erro: Valor de serviço zero',
  nota: {
    id: 'test-err-zero',
    numeroRps: '101',
    numeroLote: '1',
    serieRps: '1',
    dataEmissao: new Date().toISOString(),
    competencia: '2026-09',
    tomador: {
      cpfCnpj: '11222333000181',
      razaoSocial: 'Empresa',
      endereco: {
        logradouro: 'Rua',
        numero: '1',
        bairro: 'Centro',
        codigoMunicipio: '4106902',
        uf: 'PR',
        cep: '80010000'
      }
    },
    servico: {
      itemListaServico: '01.07',
      codigoTributacaoMunicipio: '080502',
      discriminacao: 'Serviço',
      codigoMunicipio: '4106902',
      valorServicos: '0.00', // ZERO - INVÁLIDO
      aliquota: '3.00'
    }
  }
});

// Erro 3: CEP inválido
erros.push({
  nome: 'Erro: CEP com menos de 8 dígitos',
  nota: {
    id: 'test-err-cep',
    numeroRps: '102',
    numeroLote: '1',
    serieRps: '1',
    dataEmissao: new Date().toISOString(),
    competencia: '2026-09',
    tomador: {
      cpfCnpj: '11222333000181',
      razaoSocial: 'Empresa',
      endereco: {
        logradouro: 'Rua',
        numero: '1',
        bairro: 'Centro',
        codigoMunicipio: '4106902',
        uf: 'PR',
        cep: '1234' // INVÁLIDO - menos de 8 dígitos
      }
    },
    servico: {
      itemListaServico: '01.07',
      codigoTributacaoMunicipio: '080502',
      discriminacao: 'Serviço',
      codigoMunicipio: '4106902',
      valorServicos: '100.00',
      aliquota: '3.00'
    }
  }
});

// ============ EXECUTAR TESTES ============

async function executarTodos() {
  console.log('📋 TESTES DE CASOS EXTREMOS\n');
  console.log('─'.repeat(60) + '\n');

  let sucessos = 0;
  let falhas = 0;

  // Testes normais
  console.log('✅ CASOS VÁLIDOS (devem passar):\n');

  for (let i = 0; i < testes.length; i++) {
    const teste = testes[i];
    const emissor = teste.emissor || emissorBase;

    console.log(`[${i + 1}] ${teste.nome}`);

    try {
      const { dpsXml } = dpsGenerator.gerarDpsXmlNfseCentral(teste.nota, emissor);
      console.log(`    ✅ PASSOU (XML: ${dpsXml.length} bytes)\n`);
      sucessos++;
    } catch (err) {
      console.log(`    ❌ ERRO: ${err.message}\n`);
      falhas++;
    }
  }

  // Testes de erro
  console.log('\n❌ TESTES DE VALIDAÇÃO (devem falhar):\n');
  console.log('─'.repeat(60) + '\n');

  for (let i = 0; i < erros.length; i++) {
    const teste = erros[i];

    console.log(`[${testes.length + i + 1}] ${teste.nome}`);

    const errosValidacao = dpsGenerator.validarDpsNfseCentral(teste.nota, emissorBase);
    if (errosValidacao.length > 0) {
      console.log(`    ✅ CORRETAMENTE REJEITADO`);
      errosValidacao.forEach(e => console.log(`       - ${e}`));
      sucessos++;
    } else {
      console.log(`    ❌ NÃO FOI REJEITADO (deveria ter falhado)`);
      falhas++;
    }
    console.log('');
  }

  // Resumo
  console.log('\n' + '='.repeat(60));
  console.log(`RESUMO: ${sucessos} sucessos, ${falhas} falhas`);
  console.log(`Taxa de sucesso: ${Math.round((sucessos / (sucessos + falhas)) * 100)}%`);
  console.log('='.repeat(60) + '\n');

  process.exit(falhas > 0 ? 1 : 0);
}

executarTodos().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
