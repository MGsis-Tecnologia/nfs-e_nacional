// Serviço de emissão de NFS-e — camada de abstração
// Roteia para Foz (SOAP) ou nfse.gov.br (REST) conforme configuração do emissor
// Usado entre front web (/api/rps/:id/send) e integração ERP (/api/nfse/emitir)

import * as nfseAdapter from './nfseAdapter.js';

/**
 * Valida o RPS + configurações antes de enviar
 * Retorna array de mensagens de erro (vazio = ok)
 * Escolhe validações apropriadas baseado no padrão configurado
 */
export function validarEmissao(nota, emissor) {
  return nfseAdapter.validarEmissao(nota, emissor);
}

/**
 * Assina e envia RPS/DPS para o sistema apropriado
 * Retorna { statusText, responseObj }
 * Lança erro apenas para problemas de configuração/certificado (antes do envio)
 */
export async function assinarEEnviar(nota, emissor, certConfig) {
  return nfseAdapter.assinarEEnviar(nota, emissor, certConfig);
}
