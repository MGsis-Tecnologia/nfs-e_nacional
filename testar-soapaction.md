# Descobrir SOAPAction Correto

## Erro Atual:
```
Server did not recognize the value of HTTP Header SOAPAction: 
http://ws.integration.pmfi.pr.gov.br/EnviarLoteRpsSincrono
```

## Opções para Testar (em ordem de probabilidade):

### 1️⃣ **Sem namespace (MAIS PROVÁVEL)**
```
SOAPAction: EnviarLoteRpsSincrono
```

### 2️⃣ **Com domínio da prefeitura**
```
SOAPAction: http://fozdoiguacupr.gestaoiss.com.br/EnviarLoteRpsSincrono
```

### 3️⃣ **Com namespace ABRASF**
```
SOAPAction: http://nfse.abrasf.org.br/EnviarLoteRpsSincrono
```

### 4️⃣ **Com string vazia (às vezes funciona)**
```
SOAPAction: ""
```

### 5️⃣ **Com path do serviço**
```
SOAPAction: http://fozdoiguacupr.gestaoiss.com.br/ws/nfse/EnviarLoteRpsSincrono
```

---

## Como Testar:

No arquivo `/d/Nfs-e/backend/server.js`, linha ~286:

**Procure:**
```javascript
'SOAPAction': 'http://ws.integration.pmfi.pr.gov.br/EnviarLoteRpsSincrono'
```

**Mude para uma das opções acima e teste.**

---

## Sinais de Sucesso:

Se o SOAPAction estiver correto, você verá na resposta:
```xml
<Protocolo>xxxxx</Protocolo>
<NumeroNfse>xxxxx</NumeroNfse>
```

Em vez de erro de SOAPAction.

---

## Recomendação:

**Tente primeiro com:** `EnviarLoteRpsSincrono` (sem namespace)

Se não funcionar, tente os outros em sequência.
