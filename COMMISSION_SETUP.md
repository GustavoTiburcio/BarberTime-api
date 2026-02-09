# Sistema de Comissão - Barber API

Este documento explica como configurar e usar o sistema de comissão para profissionais.

## 📋 Visão Geral

O sistema de comissão permite calcular automaticamente quanto cada profissional deve receber com base nos serviços completados. O cálculo é feito usando:

- **`professionals.comission`**: Porcentagem de comissão do profissional (ex: 40 = 40%)
- **`bookings.service_price`**: Preço do serviço salvo no momento do agendamento
- **Fórmula**: `comissão = service_price × (comission / 100)`

## 🔧 Configuração Inicial

### 1. Executar a Migration

Execute a migration para adicionar as novas colunas e constraints:

```bash
# Conecte ao seu banco de dados PostgreSQL
psql -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE -f lib/migrations/add_service_price_and_completed_status.sql
```

Ou use seu cliente SQL favorito para executar o script em:
`lib/migrations/add_service_price_and_completed_status.sql`

### 2. Configurar Comissão dos Profissionais

Atualize a porcentagem de comissão de cada profissional:

```sql
-- Exemplo: Definir comissão de 40% para um profissional
UPDATE professionals
SET comission = 40
WHERE id = 'uuid-do-profissional';
```

### 3. Backfill de Dados (Opcional)

Se você já tem bookings antigos sem `service_price`, execute:

```sql
-- Preencher service_price com o preço atual do serviço
UPDATE bookings b
SET service_price = s.price
FROM services s
WHERE b.service_id = s.id AND b.service_price IS NULL;
```

## 📡 Endpoints

### 1. GET /api/bookings

**Atualizado** para incluir `servicePrice` na resposta:

```json
{
  "id": "uuid",
  "clientName": "João Silva",
  "date": "2026-02-15",
  "time": "14:00:00",
  "status": "completed",
  "servicePrice": 50.00,  // ✨ NOVO CAMPO
  "service": {
    "id": "uuid",
    "name": "Corte + Barba",
    "price": 55.00  // Preço atual do serviço (pode ter mudado)
  }
}
```

### 2. POST /api/bookings

**Atualizado** para salvar automaticamente o preço do serviço:

```bash
POST /api/bookings
{
  "clientName": "João Silva",
  "clientPhone": "11999999999",
  "date": "2026-02-15",
  "time": "14:00:00",
  "serviceId": "uuid-do-servico",
  "professionalId": "uuid-do-profissional"
}

# O campo service_price é salvo automaticamente
```

### 3. PUT /api/bookings?id={bookingId}

**Atualizado** para permitir ajuste manual do preço (opcional):

```bash
PUT /api/bookings?id=uuid-do-booking
{
  "clientName": "João Silva",
  "clientPhone": "11999999999",
  "date": "2026-02-15",
  "time": "14:00:00",
  "status": "completed",
  "serviceId": "uuid-do-servico",
  "professionalId": "uuid-do-profissional",
  "servicePrice": 45.00  // ✨ OPCIONAL: ajustar preço manualmente
}

# Se servicePrice não for enviado, usa o preço atual do serviço
```

### 4. GET /api/commission-report ✨ NOVO

Gera relatório de comissão para um profissional em um período:

**Query Parameters:**
- `professionalId` (obrigatório): UUID do profissional
- `startDate` (obrigatório): Data inicial (formato: YYYY-MM-DD)
- `endDate` (obrigatório): Data final (formato: YYYY-MM-DD)

**Exemplo de Requisição:**

```bash
GET /api/commission-report?professionalId=123e4567-e89b-12d3-a456-426614174000&startDate=2026-02-01&endDate=2026-02-28
```

**Exemplo de Resposta:**

```json
{
  "professional": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "João Barbeiro",
    "commissionRate": 40
  },
  "period": {
    "startDate": "2026-02-01",
    "endDate": "2026-02-28"
  },
  "summary": {
    "totalBookings": 25,
    "totalServicePrice": 1250.00,
    "totalCommission": 500.00,
    "averageServicePrice": 50.00,
    "averageCommission": 20.00
  },
  "bookings": [
    {
      "id": "uuid",
      "clientName": "João Silva",
      "clientPhone": "11999999999",
      "date": "2026-02-15",
      "time": "14:00:00",
      "status": "completed",
      "servicePrice": 50.00,
      "commissionRate": 40,
      "commissionAmount": 20.00,  // 50 × 40% = R$ 20
      "createdAt": "2026-02-10T10:00:00Z",
      "service": {
        "id": "uuid",
        "name": "Corte + Barba",
        "duration": 60
      }
    }
    // ... mais bookings
  ]
}
```

## 🔄 Status de Booking

Os status válidos agora são:
- `pending` - Agendamento pendente
- `confirmed` - Agendamento confirmado
- `completed` - **✨ NOVO** - Serviço completado (gera comissão)
- `cancelled` - Agendamento cancelado

**Importante:** Apenas bookings com status `completed` são incluídos no relatório de comissão.

## 💡 Casos de Uso

### Calcular Comissão do Mês

```bash
# Janeiro 2026
GET /api/commission-report?professionalId={id}&startDate=2026-01-01&endDate=2026-01-31
```

### Calcular Comissão da Semana

```bash
# Semana de 01/02 a 07/02
GET /api/commission-report?professionalId={id}&startDate=2026-02-01&endDate=2026-02-07
```

### Mudar Status para Completed

```bash
# Após o serviço ser realizado
PATCH /api/bookings?id={bookingId}
{
  "status": "completed"
}
```

## 📊 Exemplo de Fluxo Completo

1. **Cliente agenda serviço:**
   ```bash
   POST /api/bookings
   # service_price é salvo automaticamente (ex: R$ 50,00)
   ```

2. **Preço do serviço muda no cadastro:**
   ```sql
   UPDATE services SET price = 55.00 WHERE id = 'uuid';
   ```

3. **Serviço é realizado:**
   ```bash
   PATCH /api/bookings?id={id}
   { "status": "completed" }
   ```

4. **Gerar relatório de comissão:**
   ```bash
   GET /api/commission-report?professionalId={id}&startDate=2026-02-01&endDate=2026-02-28
   # Comissão calculada sobre R$ 50,00 (preço salvo), não R$ 55,00
   ```

## ⚙️ Configuração Recomendada

### Definir Comissões Padrão

```sql
-- Profissionais experientes: 50%
UPDATE professionals
SET comission = 50
WHERE role = 'senior';

-- Profissionais em treinamento: 30%
UPDATE professionals
SET comission = 30
WHERE role = 'junior';

-- Proprietário: 100%
UPDATE professionals
SET comission = 100
WHERE role = 'owner';
```

## 🔒 Segurança

- Considere adicionar autenticação JWT para proteger o endpoint de relatório
- Restrinja acesso: profissionais devem ver apenas sua própria comissão
- Administradores podem ver todas as comissões

Exemplo com autenticação:

```typescript
import { verifyToken } from './_utils/auth';

// No início do handler
const user = verifyToken(req);
if (!user) {
  return res.status(401).json({ error: 'Não autenticado' });
}

// Permitir apenas o próprio profissional ou admin
if (user.role !== 'admin' && user.id !== professionalId) {
  return res.status(403).json({ error: 'Sem permissão' });
}
```

## 📈 Melhorias Futuras

- [ ] Adicionar autenticação ao endpoint de comissão
- [ ] Gráficos de evolução de comissão
- [ ] Exportar relatório em PDF
- [ ] Notificações automáticas de comissão mensal
- [ ] Dashboard com métricas de performance
