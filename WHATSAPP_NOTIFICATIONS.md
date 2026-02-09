# Notificações WhatsApp - Barber API

Sistema de notificações automáticas via WhatsApp usando a API WhatsGw.

## 📋 Visão Geral

O sistema envia automaticamente mensagens WhatsApp para os clientes quando:
- ✅ Um novo agendamento é criado (POST /bookings)
- 📊 O status de um agendamento é atualizado (PATCH /bookings) - opcional

## 🔧 Configuração

### 1. Criar conta na WhatsGw

1. Acesse: https://app.whatsgw.com.br
2. Crie sua conta e configure seu número
3. Obtenha sua **API Key** no painel

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:

```bash
# WhatsApp Notification (WhatsGw API)
WHATSAPP_API_KEY=sua_api_key_aqui
WHATSAPP_PHONE_NUMBER=5511999999999
```

**Importante:**
- `WHATSAPP_API_KEY`: Sua chave de API do WhatsGw
- `WHATSAPP_PHONE_NUMBER`: Número do WhatsApp do estabelecimento (com DDI + DDD)
  - Formato: `55` (Brasil) + `11` (DDD) + `999999999` (número)
  - Exemplo: `5511987654321`

### 3. Instalar Dependências (se necessário)

O sistema usa apenas o `fetch` nativo do Node.js (disponível no Vercel), então não precisa instalar nada adicional.

## 📱 Mensagens Enviadas

### Confirmação de Agendamento

Enviada automaticamente após criar um novo booking:

```
🎉 *Agendamento Confirmado!*

Olá *João Silva*! ✨

Seu agendamento foi confirmado com sucesso:

📅 *Data:* Segunda, 15 de fevereiro
🕐 *Horário:* 14:00
💈 *Serviço:* Corte + Barba
👤 *Profissional:* Carlos Barbeiro

_Aguardamos você! Qualquer dúvida, entre em contato._

Até breve! 👋
```

### Atualização de Status (Opcional)

Para enviar notificação de atualização de status, use a função `sendStatusUpdate`:

```typescript
import { sendStatusUpdate } from './_utils/whatsapp';

// Exemplo de uso
await sendStatusUpdate({
  clientName: 'João Silva',
  clientPhone: '5511999999999',
  date: '2026-02-15',
  time: '14:00',
  serviceName: 'Corte + Barba',
  professionalName: 'Carlos',
  status: 'confirmed', // ou 'cancelled', 'completed'
});
```

## 🛠️ Função Utilitária

### `sendBookingConfirmation`

Localizada em: `api/_utils/whatsapp.ts`

**Parâmetros:**

```typescript
interface BookingNotificationData {
  clientName: string;        // Nome do cliente
  clientPhone: string;       // Telefone com DDI+DDD (ex: 5511999999999)
  date: string;             // Data no formato YYYY-MM-DD
  time: string;             // Hora no formato HH:MM:SS
  serviceName: string;      // Nome do serviço
  professionalName: string; // Nome do profissional
  status?: string;          // Status (opcional)
}

interface WhatsAppConfig {
  apikey: string;      // Sobrescreve WHATSAPP_API_KEY
  phoneNumber: string; // Sobrescreve WHATSAPP_PHONE_NUMBER
}
```

**Uso Básico:**

```typescript
import { sendBookingConfirmation } from './_utils/whatsapp';

// Usa variáveis de ambiente
await sendBookingConfirmation({
  clientName: 'João Silva',
  clientPhone: '5511999999999',
  date: '2026-02-15',
  time: '14:00:00',
  serviceName: 'Corte + Barba',
  professionalName: 'Carlos',
});
```

**Uso com Configuração Customizada:**

```typescript
// Sobrescreve as variáveis de ambiente
await sendBookingConfirmation(
  {
    clientName: 'João Silva',
    clientPhone: '5511999999999',
    date: '2026-02-15',
    time: '14:00:00',
    serviceName: 'Corte + Barba',
    professionalName: 'Carlos',
  },
  {
    apikey: 'custom_api_key',
    phoneNumber: '5511988888888',
  }
);
```

## 🔍 Como Funciona

### No POST /bookings

1. Cliente cria agendamento via API
2. Sistema valida e salva no banco
3. **Após commit bem-sucedido:**
   - Busca nome do serviço e profissional
   - Envia notificação via WhatsApp (assíncrono)
   - Retorna resposta para o cliente
4. **Se envio falhar:**
   - Apenas loga o erro (não afeta o agendamento)
   - Booking continua criado normalmente

### Fluxo de Envio

```
POST /bookings
    ↓
Validações
    ↓
INSERT no banco
    ↓
COMMIT
    ↓
Enviar WhatsApp (assíncrono) ← Não bloqueia
    ↓
Retornar 201
```

## ⚙️ Personalização

### Customizar Mensagem

Edite o arquivo `api/_utils/whatsapp.ts` na função `sendBookingConfirmation`:

```typescript
const message = `
🎉 *Agendamento Confirmado!*

Olá *${bookingData.clientName}*! ✨

Seu agendamento foi confirmado:

📅 *Data:* ${formattedDate}
🕐 *Horário:* ${formattedTime}
💈 *Serviço:* ${bookingData.serviceName}
👤 *Profissional:* ${bookingData.professionalName}

_Aguardamos você!_

Até breve! 👋
`.trim();
```

### Formatação WhatsApp

- `*texto*` - **Negrito**
- `_texto_` - _Itálico_
- `~texto~` - ~~Tachado~~
- ` ```texto``` ` - `Monoespaçado`
- Emojis: 🎉 ✨ 📅 🕐 💈 👤 👋

## 🧪 Testes

### Testar Envio Manualmente

Crie um arquivo `test-whatsapp.ts`:

```typescript
import { sendBookingConfirmation } from './api/_utils/whatsapp';

async function test() {
  const result = await sendBookingConfirmation({
    clientName: 'Teste Cliente',
    clientPhone: '5511999999999',
    date: '2026-02-15',
    time: '14:00:00',
    serviceName: 'Corte Masculino',
    professionalName: 'João Barbeiro',
  });

  console.log('Resultado:', result ? 'Sucesso' : 'Falhou');
}

test();
```

Execute:
```bash
npx ts-node test-whatsapp.ts
```

### Testar via API

```bash
# Criar um booking (deve enviar WhatsApp automaticamente)
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "João Silva",
    "clientPhone": "5511999999999",
    "date": "2026-02-15",
    "time": "14:00",
    "serviceId": "uuid-do-servico",
    "professionalId": "uuid-do-profissional"
  }'
```

## 🚨 Troubleshooting

### Mensagem não é enviada

**Verificar:**

1. ✅ Variáveis de ambiente configuradas?
   ```bash
   echo $WHATSAPP_API_KEY
   echo $WHATSAPP_PHONE_NUMBER
   ```

2. ✅ API Key válida?
   - Acesse o painel WhatsGw
   - Verifique se a key está ativa

3. ✅ Formato do telefone correto?
   - Deve ter DDI + DDD + número
   - Exemplo: `5511999999999` (não `11999999999`)

4. ✅ Verificar logs:
   ```bash
   # Procure por erros no console
   grep "WhatsApp:" logs.txt
   ```

### Erro "Configuração incompleta"

**Causa:** `WHATSAPP_API_KEY` ou `WHATSAPP_PHONE_NUMBER` não configurados

**Solução:**
```bash
# No Vercel (deploy)
vercel env add WHATSAPP_API_KEY
vercel env add WHATSAPP_PHONE_NUMBER

# Local (desenvolvimento)
# Adicione no arquivo .env
```

### Erro na API WhatsGw

**Possíveis causas:**
- API Key inválida
- Créditos insuficientes
- Número de origem não configurado
- Rate limit excedido

**Solução:**
- Acesse o painel WhatsGw
- Verifique saldo e configurações
- Consulte documentação: https://app.whatsgw.com.br/docs

## 📊 Monitoramento

### Logs de Sucesso

```
WhatsApp: Mensagem enviada com sucesso { messageId: '...' }
```

### Logs de Erro

```
WhatsApp: Configuração incompleta (apikey ou phoneNumber ausente)
WhatsApp: Erro ao enviar mensagem: 401 Unauthorized
WhatsApp: Erro ao enviar notificação: Error: ...
```

### Verificar no Painel WhatsGw

1. Acesse https://app.whatsgw.com.br
2. Vá em "Mensagens" ou "Histórico"
3. Verifique status das mensagens enviadas

## 🔒 Segurança

### Boas Práticas:

✅ **NUNCA commite** `.env` no Git
✅ Use variáveis de ambiente para API Key
✅ Valide número de telefone antes de enviar
✅ Implemente rate limiting se necessário
✅ Monitore custos de envio

### Validação de Telefone

Adicione validação no POST de bookings:

```typescript
// Validar formato do telefone
const phoneRegex = /^55\d{10,11}$/;
if (!phoneRegex.test(clientPhone)) {
  return res.status(400).json({
    error: 'Telefone inválido. Use formato: 5511999999999'
  });
}
```

## 💰 Custos

- Verifique preços na WhatsGw: https://app.whatsgw.com.br/pricing
- Cada mensagem enviada consome créditos
- Monitore uso para evitar surpresas

## 🔧 Desabilitar Temporariamente

Para desabilitar o envio sem remover código:

```bash
# Remova ou comente as variáveis de ambiente
# WHATSAPP_API_KEY=
# WHATSAPP_PHONE_NUMBER=
```

O sistema detectará automaticamente e não enviará mensagens.

## 📚 Recursos Adicionais

- 📖 Documentação WhatsGw: https://app.whatsgw.com.br/docs
- 🔑 Obter API Key: https://app.whatsgw.com.br/settings
- 💬 Suporte WhatsGw: https://app.whatsgw.com.br/support

---

Sistema implementado e pronto para uso! 🚀
