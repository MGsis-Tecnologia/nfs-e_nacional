import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

export function loadCertificate(pfxBuffer, password) {
  try {
    const p12Der = forge.util.createBuffer(pfxBuffer.toString('binary'));
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

    let keyObj;
    let certObj;

    // Encontrar chave privada
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const pkcs8Bags = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
    if (pkcs8Bags && pkcs8Bags.length > 0) {
      keyObj = pkcs8Bags[0].key;
    }

    if (!keyObj) {
      const standardKeyBags = p12.getBags({ bagType: forge.pki.oids.keyBag });
      const standardBags = standardKeyBags[forge.pki.oids.keyBag];
      if (standardBags && standardBags.length > 0) {
        keyObj = standardBags[0].key;
      }
    }

    // Encontrar certificado
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certs = certBags[forge.pki.oids.certBag];
    if (certs && certs.length > 0) {
      certObj = certs[0].cert;
    }

    if (!keyObj || !certObj) {
      throw new Error("Não foi possível encontrar a chave privada ou o certificado no arquivo.");
    }

    const privateKeyPem = forge.pki.privateKeyToPem(keyObj);
    const certPem = forge.pki.certificateToPem(certObj);
    
    const certPemClean = certPem
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\r?\n|\r/g, '');

    return { privateKeyPem, certPem, certPemClean };
  } catch (err) {
    throw new Error("Erro ao descriptografar o certificado P12. Verifique a senha. Detalhes: " + err.message);
  }
}

// Function to sign an element in the XML
function signElement({ xml, targetElementXpath, targetId, privateKeyPem, certPemClean }) {
  const sig = new SignedXml({
    privateKey: Buffer.from(privateKeyPem),
    publicCert: Buffer.from(certPemClean), // xml-crypto requires the raw base64 or PEM
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  });

  // Configure key info provider to output <X509Data><X509Certificate>
  sig.keyInfoProvider = {
    getKeyInfo: () => {
      return `<X509Data><X509Certificate>${certPemClean}</X509Certificate></X509Data>`;
    },
    getKey: () => {
      return Buffer.from(privateKeyPem);
    }
  };

  sig.addReference({
    xpath: targetElementXpath,
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    ],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1'
  });

  sig.computeSignature(xml, {
    prefix: '', // No prefix for Signature, i.e. <Signature> instead of <ds:Signature>
    location: {
      reference: targetElementXpath,
      action: 'after' // GestaoISS accepts Signature as sibling or child. Putting it after the element is standard for some, but ABRASF expects Signature inside the element as last child.
      // Wait, let's see. The schema says:
      // <xsd:element name="InfDeclaracaoPrestacaoServico" ...> ... </xsd:element>
      // <xsd:element ref="ds:Signature" minOccurs="0" maxOccurs="1" />
      // Wait! Under <Rps>, the sequence is:
      // 1. InfDeclaracaoPrestacaoServico
      // 2. ds:Signature
      // And under <LoteRps>, the sequence is:
      // 1. ... (elements)
      // 2. ListaRps
      // 3. ds:Signature
      // So the Signature is a SIBLING of InfDeclaracaoPrestacaoServico, inside Rps, and a SIBLING of ListaRps, inside LoteRps.
      // Wait, let's check ABRASF v2.02 standard schema.
      // Yes:
      // Rps contains: InfDeclaracaoPrestacaoServico (minOccurs=1), Signature (minOccurs=0)
      // LoteRps contains: NumeroLote, Cnpj, InscricaoMunicipal, QuantidadeRps, ListaRps, Signature (minOccurs=0)
      // So putting the signature AFTER the target element (InfDeclaracaoPrestacaoServico and LoteRps/ListaRps) or inside it?
      // Wait! The target element for RPS signature is InfDeclaracaoPrestacaoServico, but the Signature element is inside Rps (after InfDeclaracaoPrestacaoServico).
      // The target element for Lote signature is LoteRps, and the Signature element is inside LoteRps (after ListaRps).
      // Wait, if the Reference URI points to #rps_xxx, then the Signature is placed after InfDeclaracaoPrestacaoServico.
      // Let's use 'after' for InfDeclaracaoPrestacaoServico, and 'after' for ListaRps (which puts it inside LoteRps after ListaRps).
      // Or we can place it 'append' (as last child) inside the parent.
      // Let's put it 'after' the element being signed, or as last child.
      // Actually, if we use xml-crypto:
      // For InfDeclaracaoPrestacaoServico: Reference is "//*[local-name()='InfDeclaracaoPrestacaoServico']". We can insert the Signature AFTER this element.
      // For LoteRps: Reference is "//*[local-name()='LoteRps']". Since the LoteRps element contains all elements, we insert the Signature as a child of LoteRps, after ListaRps.
    }
  });

  return sig.getSignedXml();
}

export function signRpsXml({ xml, rpsId, loteId, privateKeyPem, certPemClean }) {
  try {
    // 1. Sign InfDeclaracaoPrestacaoServico (RPS)
    // The signature goes inside the Rps tag, after InfDeclaracaoPrestacaoServico
    let signedXml = signElement({
      xml,
      targetElementXpath: `//*[local-name()='InfDeclaracaoPrestacaoServico' and @Id='${rpsId}']`,
      targetId: rpsId,
      privateKeyPem,
      certPemClean
    });

    // 2. Sign LoteRps
    // The signature goes inside LoteRps, after ListaRps
    signedXml = signElement({
      xml: signedXml,
      targetElementXpath: `//*[local-name()='LoteRps' and @Id='${loteId}']`,
      targetId: loteId,
      privateKeyPem,
      certPemClean
    });

    return signedXml;
  } catch (err) {
    throw new Error("Erro na assinatura digital do XML: " + err.message);
  }
}
