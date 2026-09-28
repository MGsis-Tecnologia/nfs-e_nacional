#!/usr/bin/env node
// Script interativo para teste completo em homologação nfse.gov.br
// Uso: node test-homologacao-completo.js

import 'dotenv/config';
import readline from 'readline';
import { initPrisma, prisma } from './prisma.js';
import * as nfseValidation from './utils/nfseValidation.js';
import * as dpsGenerator from './utils/dpsGenerator.js';
import { loadCertificate } from './utils/xmlSigner.js';
import { signRpsXml } from './utils/xmlSigner.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const perguntar = (msg) => new Promise(resolve => rl.question(msg, resolve));

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  TESTE COMPLETO - INTEGRAÇÃO NFSE.GOV.BR HOMOLOGAÇÃO     ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

async function executarTeste() {
  try {
    // Conectar ao banco
    console.log('🔌 Conectando ao banco de dados...');
    await initPrisma();
    console.log('✅ Banco conectado\n');

    // ========== ETAPA 1: Selecionar Emissor ==========
    console.log('📋 ETAPA 1: Selecionar Emissor para Teste');
    console.log('─────────────────────────────────────────────\n');

    const emissores = await prisma.emissor.findMany({ take: 10 });
    if (emissores.length === 0) {
      console.log('❌ Nenhum emissor cadastrado. Por favor, cadastre um antes de rodar os testes.');
      process.exit(1);
    }

    console.log('Emissores disponíveis:');
    emissores.forEach((e, i) => {
      const certStatus = e.certPfxBase64 ? '✓' : '✗';
      console.log(`  ${i + 1}. [${certStatus}] ${e.razaoSocial} (${e.cnpj})`);
    });

    const opcaoEmissor = await perguntar('\nSelecione um emissor (1-' + emissores.length + '): ');
    const indexEmissor = parseInt(opcaoEmissor) - 1;

    if (indexEmissor < 0 || indexEmissor >= emissores.length) {
      console.log('❌ Opção inválida');
      process.exit(1);
    }

    const emissor = emissores[indexEmissor];

    if (!emissor.certPfxBase64) {
      console.log('❌ Este emissor não tem certificado configurado');
      process.exit(1);
    }

    console.log(`✅ Emissor selecionado: ${emissor.razaoSocial}\n`);

    // ========== ETAPA 2: Validar Certificado ==========
    console.log('🔐 ETAPA 2: Validar Certificado Digital');
    console.log('──────────────────────────────────────────\n');

    const certBuffer = Buffer.from(emissor.certPfxBase64, 'base64');
    const valCert = await nfseValidation.validarCertificadoParaNfseCentral(certBuffer, emissor.certPassword);

    if (valCert.valido) {
      console.log('✅ Certificado válido!');
      console.log(`   Tamanho da chave: ${valCert.certificadoInfo.tamanhoChave} bytes\n`);
    } else {
      console.log('❌ Certificado inválido:');
      valCert.erros.forEach(e => console.log(`   - ${e}`));
      process.exit(1);
    }

    // ========== ETAPA 3: Verificar Conectividade ==========
    console.log('🌐 ETAPA 3: Verificar Conectividade com nfse.gov.br');
    console.log('────────────────────────────────────────────────────\n');

    const conectividade = await nfseValidation.verificarConectividadeNfseCentral();

    console.log('Homologação:', conectividade.homologacao.status ? '✅ OK' : '❌ ERRO');
    if (conectividade.homologacao.statusCode) {
      console.log(`  Status: ${conectividade.homologacao.statusCode}`);
    }
    if (conectividade.homologacao.erro) {
      console.log(`  Erro: ${conectividade.homologacao.erro}`);
    }

    console.log('Produção:', conectividade.producao.status ? '✅ OK' : '❌ ERRO');
    if (!conectividade.homologacao.status) {
      console.log('⚠️  AVISO: Não conseguiu conectar a homologação. Testes não prosseguirão.\n');
      process.exit(1);
    }
    console.log('');

    // ========== ETAPA 4: Testar Integração Completa ==========
    console.log('🔗 ETAPA 4: Testar Integração Completa (mTLS)');
    console.log('───────────────────────────────────────────────\n');

    const testeInteg = await nfseValidation.testarIntegracaoNfseCentral({
      cnpj: emissor.cnpj,
      certificadoBuffer: certBuffer,
      certificadoSenha: emissor.certPassword,
      ambiente: 'homologacao'
    });

    if (testeInteg.sucesso) {
      console.log('✅ Integração OK!');
      testeInteg.mensagens.forEach(m => console.log(`   ${m}`));
    } else {
      console.log('❌ Erro na integração:');
      testeInteg.erros.forEach(e => console.log(`   - ${e}`));
    }
    console.log('');

    // ========== ETAPA 5: Criar Nota de Teste ==========
    console.log('📄 ETAPA 5: Preparar Nota de Teste');
    console.log('──────────────────────────────────\n');

    const notaTeste = {
      id: 'test-' + Date.now(),
      numeroRps: '999',
      numeroLote: '1',
      serieRps: '1',
      dataEmissao: new Date().toISOString(),
      competencia: new Date().toISOString().slice(0, 10),
      tomador: {
        cpfCnpj: '11222333000181',
        razaoSocial: 'Empresa Teste para Homologação LTDA',
        inscricaoMunicipal: '123456',
        endereco: {
          logradouro: 'Rua de Teste',
          numero: '123',
          complemento: 'Apto 456',
          bairro: 'Centro',
          codigoMunicipio: '4106902',
          uf: 'PR',
          cep: '80010000'
        },
        contato: {
          telefone: '4133334444',
          email: 'teste@example.com'
        }
      },
      servico: {
        itemListaServico: '01.07',
        codigoTributacaoMunicipio: '080502',
        discriminacao: 'Serviço de teste para homologação nfse.gov.br',
        codigoMunicipio: '4106902',
        municipioIncidencia: '4106902',
        valorServicos: '100.00',
        aliquota: '3.0000',
        issRetido: '2',
        exigibilidadeIss: '1'
      }
    };

    const errosValidacao = dpsGenerator.validarDpsNfseCentral(notaTeste, emissor);
    if (errosValidacao.length > 0) {
      console.log('❌ Nota de teste inválida:');
      errosValidacao.forEach(e => console.log(`   - ${e}`));
      process.exit(1);
    }

    console.log('✅ Nota de teste válida');
    console.log(`   RPS: ${notaTeste.numeroRps}`);
    console.log(`   Valor: R$ ${notaTeste.servico.valorServicos}`);
    console.log(`   Tomador: ${notaTeste.tomador.razaoSocial}\n`);

    // ========== ETAPA 6: Gerar DPS ==========
    console.log('🔧 ETAPA 6: Gerar DPS XML');
    console.log('──────────────────────────\n');

    const { dpsXml, metadados } = dpsGenerator.gerarDpsXmlNfseCentral(notaTeste, emissor);
    console.log(`✅ DPS gerada com sucesso`);
    console.log(`   Tamanho XML: ${dpsXml.length} bytes`);
    console.log(`   ID da DPS: ${metadados.numeroRps}\n`);

    // ========== ETAPA 7: Pergunta se quer enviar ==========
    console.log('⚠️  PRÓXIMA ETAPA: Enviar para Homologação');
    console.log('────────────────────────────────────────────\n');
    console.log('Você pode:');
    console.log('  1. Enviar DPS real para nfse.gov.br homologação (criar NFS-e)');
    console.log('  2. Apenas simular (ver fluxo sem enviar)');
    console.log('  3. Sair');

    const opcaoFinal = await perguntar('\nEscolha (1-3): ');

    if (opcaoFinal === '1') {
      console.log('\n📤 Enviando DPS para nfse.gov.br homologação...\n');

      // Assinar DPS
      const { privateKeyPem, certPem } = loadCertificate(certBuffer, emissor.certPassword);
      const dpsXmlAssinado = signRpsXml({
        xml: dpsXml,
        rpsId: `rps_${notaTeste.id}`,
        loteId: `lote_${Date.now()}`,
        privateKeyPem,
        certPem
      });

      // Enviar
      const { enviarDpsNfseCentral, extrairMensagensErro } = await import('./utils/nfseCentralApi.js');
      const resultado = await enviarDpsNfseCentral({
        dpsXmlAssinado,
        ambiente: 'homologacao',
        certConfig: { privateKeyPem, certPem },
        cnpj: emissor.cnpj
      });

      if (resultado.success) {
        console.log('✅ DPS ENVIADA COM SUCESSO!');
        console.log(`   Status: ${resultado.statusCode}`);
        if (resultado.responseData?.numeroNfse) {
          console.log(`   NFS-e gerada: ${resultado.responseData.numeroNfse}`);
          console.log(`   Código de verificação: ${resultado.responseData.codigoVerificacao}`);
        }
      } else {
        console.log('❌ ERRO ao enviar DPS');
        const msgs = extrairMensagensErro(resultado.responseData);
        msgs.forEach(m => console.log(`   [${m.codigo}] ${m.mensagem}`));
      }
    } else if (opcaoFinal === '2') {
      console.log('\n🎭 Simulando envio (sem realmente enviar)...\n');
      const simulacao = await nfseValidation.simularFluxoEnvioDps(notaTeste, emissor);
      console.log('✅ Simulação concluída:');
      simulacao.etapas.forEach(e => {
        const icon = e.status === 'sucesso' ? '✅' : e.status === 'erro' ? '❌' : 'ℹ️';
        console.log(`   ${icon} ${e.nome}: ${e.status}`);
      });
    }

    console.log('\n✅ Teste concluído!\n');
  } catch (err) {
    console.error('\n❌ Erro:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

executarTeste();
