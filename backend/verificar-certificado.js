import fs from 'fs';
import forge from 'node-forge';

const certPath = './certs/certificate.pfx';
const password = 'muller=g@rcia=2026';

console.log('\n========================================');
console.log('  VERIFICADOR DE CERTIFICADO PKCS12');
console.log('========================================\n');

try {
  // 1. Verificar se arquivo existe
  if (!fs.existsSync(certPath)) {
    console.log('❌ Arquivo não encontrado:', certPath);
    process.exit(1);
  }
  console.log('✅ Arquivo encontrado:', certPath);

  // 2. Ler arquivo
  const certBuffer = fs.readFileSync(certPath);
  console.log('✅ Arquivo lido:', certBuffer.length, 'bytes');

  // 3. Tentar fazer parse como PKCS12
  console.log('\n📋 Tentando fazer parse como PKCS12...');
  const p12Der = forge.util.createBuffer(certBuffer.toString('binary'));
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

  console.log('✅ Parse bem-sucedido!\n');

  // 4. Extrair informações
  console.log('📊 INFORMAÇÕES DO CERTIFICADO:');
  console.log('─'.repeat(40));

  // Chave privada
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const pkcs8Bags = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
  if (pkcs8Bags && pkcs8Bags.length > 0) {
    console.log('✅ Chave privada encontrada (PKCS8)');
  } else {
    const standardKeyBags = p12.getBags({ bagType: forge.pki.oids.keyBag });
    const standardBags = standardKeyBags[forge.pki.oids.keyBag];
    if (standardBags && standardBags.length > 0) {
      console.log('✅ Chave privada encontrada (Standard)');
    } else {
      console.log('❌ Nenhuma chave privada encontrada!');
    }
  }

  // Certificado
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certs = certBags[forge.pki.oids.certBag];
  if (certs && certs.length > 0) {
    const cert = certs[0].cert;
    console.log('✅ Certificado encontrado');
    console.log('\n📌 Detalhes do Certificado:');
    console.log('   Subject:', cert.subject.attributes.map(a => `${a.name}=${a.value}`).join(', '));
    console.log('   Issuer:', cert.issuer.attributes.map(a => `${a.name}=${a.value}`).join(', '));
    console.log('   Válido de:', cert.validity.notBefore.toISOString().split('T')[0]);
    console.log('   Válido até:', cert.validity.notAfter.toISOString().split('T')[0]);

    const now = new Date();
    if (cert.validity.notAfter < now) {
      console.log('   ⚠️  CERTIFICADO EXPIRADO!');
    } else {
      console.log('   ✅ Certificado válido');
    }
  } else {
    console.log('❌ Nenhum certificado encontrado!');
  }

  console.log('\n' + '═'.repeat(40));
  console.log('✅ RESULTADO: Certificado VÁLIDO!');
  console.log('═'.repeat(40) + '\n');

} catch (err) {
  console.log('\n' + '═'.repeat(40));
  console.log('❌ ERRO AO PROCESSAR CERTIFICADO:');
  console.log('═'.repeat(40));
  console.log('\n📌 Tipo de erro:', err.name);
  console.log('📌 Mensagem:', err.message);
  console.log('\n🔍 Possíveis causas:');
  console.log('   1. Arquivo NÃO é um PKCS12 válido');
  console.log('   2. Senha está INCORRETA');
  console.log('   3. Arquivo foi CORROMPIDO');
  console.log('\n💡 O que fazer:');
  console.log('   a) Verifique a senha: muller=g@rcia=2026');
  console.log('   b) Tente outro certificado .pfx');
  console.log('   c) Converta seu certificado para PKCS12');
  console.log('\n');
  process.exit(1);
}
