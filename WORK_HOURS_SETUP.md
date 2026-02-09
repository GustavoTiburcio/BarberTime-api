# Sistema de Horários de Trabalho - Barber API

Este documento explica como configurar e usar o sistema de horários de trabalho personalizados por profissional.

## 📋 Visão Geral

O sistema permite que cada profissional tenha horários de trabalho diferentes por dia da semana, incluindo múltiplos períodos no mesmo dia (ex: manhã e tarde).

### Recursos:
- ✅ Horários personalizados por dia da semana
- ✅ Múltiplos períodos no mesmo dia (ex: 09:00-12:00 e 14:00-20:00)
- ✅ Dias de folga (sem horários cadastrados)
- ✅ Fallback para horários padrão se não configurado
- ✅ Integração automática com disponibilidade

## 🔧 Configuração Inicial

### 1. Executar a Migration

Execute a migration para criar a tabela de horários:

```bash
psql -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE -f lib/migrations/create_professional_work_hours.sql
```

### 2. Configurar Horários dos Profissionais

#### Exemplo: Barbeiro Samuel

**Segunda a Sexta**: 14:00 às 20:00
**Sábado**: 09:00 às 12:00 e 14:00 às 20:00
**Domingo**: Folga

```sql
-- Substituir 'uuid-do-samuel' pelo ID real do profissional

-- Segunda a Sexta (1-5): 14:00-20:00
INSERT INTO professional_work_hours (professional_id, day_of_week, start_time, end_time)
VALUES
  ('uuid-do-samuel', 1, '14:00', '20:00'),  -- Segunda
  ('uuid-do-samuel', 2, '14:00', '20:00'),  -- Terça
  ('uuid-do-samuel', 3, '14:00', '20:00'),  -- Quarta
  ('uuid-do-samuel', 4, '14:00', '20:00'),  -- Quinta
  ('uuid-do-samuel', 5, '14:00', '20:00');  -- Sexta

-- Sábado (6): Dois períodos
INSERT INTO professional_work_hours (professional_id, day_of_week, start_time, end_time)
VALUES
  ('uuid-do-samuel', 6, '09:00', '12:00'),  -- Manhã
  ('uuid-do-samuel', 6, '14:00', '20:00');  -- Tarde

-- Domingo (0): Sem registros = dia de folga
```

## 📡 Endpoints

### 1. GET /api/work-hours

Busca todos os horários de trabalho de um profissional.

**Query Parameters:**
- `professionalId` (obrigatório): UUID do profissional

**Exemplo:**
```bash
GET /api/work-hours?professionalId=123e4567-e89b-12d3-a456-426614174000
```

**Resposta:**
```json
[
  {
    "id": "uuid",
    "professionalId": "uuid-do-samuel",
    "dayOfWeek": 1,
    "dayName": "Segunda-feira",
    "startTime": "14:00:00",
    "endTime": "20:00:00",
    "createdAt": "2026-02-09T10:00:00Z"
  },
  {
    "id": "uuid",
    "professionalId": "uuid-do-samuel",
    "dayOfWeek": 6,
    "dayName": "Sábado",
    "startTime": "09:00:00",
    "endTime": "12:00:00",
    "createdAt": "2026-02-09T10:00:00Z"
  },
  {
    "id": "uuid",
    "professionalId": "uuid-do-samuel",
    "dayOfWeek": 6,
    "dayName": "Sábado",
    "startTime": "14:00:00",
    "endTime": "20:00:00",
    "createdAt": "2026-02-09T10:00:00Z"
  }
]
```

### 2. POST /api/work-hours

Cria um novo período de trabalho.

**Body:**
```json
{
  "professionalId": "uuid-do-profissional",
  "dayOfWeek": 1,
  "startTime": "14:00",
  "endTime": "20:00"
}
```

**Dias da Semana:**
- `0` = Domingo
- `1` = Segunda-feira
- `2` = Terça-feira
- `3` = Quarta-feira
- `4` = Quinta-feira
- `5` = Sexta-feira
- `6` = Sábado

**Resposta (201):**
```json
{
  "id": "uuid-gerado",
  "professionalId": "uuid-do-profissional",
  "dayOfWeek": 1,
  "dayName": "Segunda-feira",
  "startTime": "14:00:00",
  "endTime": "20:00:00",
  "createdAt": "2026-02-09T10:00:00Z"
}
```

### 3. PUT /api/work-hours?id={workHourId}

Atualiza um período de trabalho existente.

**Body:**
```json
{
  "dayOfWeek": 1,
  "startTime": "15:00",
  "endTime": "21:00"
}
```

**Resposta (200):**
```json
{
  "id": "uuid",
  "professionalId": "uuid-do-profissional",
  "dayOfWeek": 1,
  "dayName": "Segunda-feira",
  "startTime": "15:00:00",
  "endTime": "21:00:00",
  "createdAt": "2026-02-09T10:00:00Z"
}
```

### 4. DELETE /api/work-hours?id={workHourId}

Remove um período de trabalho.

**Resposta (200):**
```json
{
  "message": "Horário de trabalho removido com sucesso"
}
```

## 🔄 Integração com Availability

O endpoint `/api/availability` foi atualizado para usar automaticamente os horários personalizados.

### Comportamento:

1. **Com horários cadastrados**: Usa os períodos configurados para o dia da semana
2. **Sem horários cadastrados**: Usa horários padrão (09:00-20:00) como fallback
3. **Múltiplos períodos**: Gera slots para cada período (ex: manhã e tarde)
4. **Dia de folga**: Se não houver horários para o dia, retorna array vazio `[]`

### Exemplo de Uso:

```bash
# Consultar disponibilidade de sábado para o Samuel
GET /api/availability?date=2026-02-15&professionalId=uuid-do-samuel&serviceId=uuid-servico
```

**Resposta (considerando horários: 09:00-12:00 e 14:00-20:00):**
```json
[
  "09:00",
  "10:00",
  "11:00",
  // Intervalo de almoço (12:00-14:00) não aparece
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00"
]
```

## 💡 Casos de Uso

### Caso 1: Profissional com Horário Fixo

**Cenário**: João trabalha todos os dias úteis das 09:00 às 18:00

```bash
# Criar horários (Segunda a Sexta)
for i in {1..5}; do
  curl -X POST /api/work-hours \
    -H "Content-Type: application/json" \
    -d "{
      \"professionalId\": \"uuid-do-joao\",
      \"dayOfWeek\": $i,
      \"startTime\": \"09:00\",
      \"endTime\": \"18:00\"
    }"
done
```

### Caso 2: Profissional com Múltiplos Períodos

**Cenário**: Maria trabalha com intervalo de almoço

```bash
# Período 1: Manhã (09:00-12:00)
curl -X POST /api/work-hours \
  -H "Content-Type: application/json" \
  -d '{
    "professionalId": "uuid-da-maria",
    "dayOfWeek": 1,
    "startTime": "09:00",
    "endTime": "12:00"
  }'

# Período 2: Tarde (14:00-18:00)
curl -X POST /api/work-hours \
  -H "Content-Type: application/json" \
  -d '{
    "professionalId": "uuid-da-maria",
    "dayOfWeek": 1,
    "startTime": "14:00",
    "endTime": "18:00"
  }'
```

### Caso 3: Alterar Horário de um Dia

**Cenário**: Mudar horário de quinta-feira

```bash
# 1. Buscar ID do horário
GET /api/work-hours?professionalId=uuid-do-profissional

# 2. Atualizar
PUT /api/work-hours?id=uuid-do-horario
{
  "dayOfWeek": 4,
  "startTime": "10:00",
  "endTime": "19:00"
}
```

### Caso 4: Remover Dia de Trabalho (Criar Folga)

```bash
# Deletar todos os horários de domingo
DELETE /api/work-hours?id=uuid-do-horario-domingo
```

## 📊 Exemplos Práticos

### Exemplo Completo: Configurar Barbeiro Novo

```javascript
// 1. Criar horários padrão (Segunda a Sexta: 14:00-20:00)
const professionalId = 'uuid-do-profissional';
const weekdayHours = {
  startTime: '14:00',
  endTime: '20:00'
};

for (let day = 1; day <= 5; day++) {
  await fetch('/api/work-hours', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      professionalId,
      dayOfWeek: day,
      ...weekdayHours
    })
  });
}

// 2. Sábado com dois períodos
await fetch('/api/work-hours', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    professionalId,
    dayOfWeek: 6,
    startTime: '09:00',
    endTime: '12:00'
  })
});

await fetch('/api/work-hours', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    professionalId,
    dayOfWeek: 6,
    startTime: '14:00',
    endTime: '20:00'
  })
});

// 3. Consultar disponibilidade
const availability = await fetch(
  `/api/availability?date=2026-02-15&professionalId=${professionalId}&serviceId=${serviceId}`
).then(r => r.json());

console.log('Horários disponíveis:', availability);
```

## ⚙️ Validações e Regras

### Validações Automáticas:

1. **Validação de Horário**: `startTime` deve ser menor que `endTime`
2. **Validação de Dia**: `dayOfWeek` deve estar entre 0 e 6
3. **Foreign Key**: `professionalId` deve existir na tabela `professionals`
4. **Cascade Delete**: Ao deletar um profissional, seus horários são removidos automaticamente

### Regras de Negócio:

- Slots são gerados a cada 60 minutos (configurável via `SLOT_INTERVAL`)
- Serviços que não cabem no período disponível não geram slots
- Múltiplos períodos no mesmo dia são permitidos
- Sem horários = usa fallback padrão (09:00-20:00)
- Dia sem registros na disponibilidade = dia de folga (retorna `[]`)

## 🚨 Troubleshooting

### Problema: Disponibilidade retorna vazio mesmo com horários cadastrados

**Solução**: Verificar:
1. `professionalId` está correto na consulta
2. `dayOfWeek` está correto (considerar fuso horário)
3. Horários cobrem o período esperado

```sql
-- Verificar horários cadastrados
SELECT * FROM professional_work_hours WHERE professional_id = 'uuid';
```

### Problema: Erro "Horário inválido"

**Causa**: `startTime >= endTime`

**Solução**: Garantir que horário de início é menor que horário de fim:
```json
{
  "startTime": "09:00",  // ✅ Correto
  "endTime": "18:00"
}
```

### Problema: Slots não aparecem no intervalo de almoço

**Causa**: Isso é esperado! Se você tem dois períodos (manhã e tarde), o intervalo entre eles não gera slots.

**Solução**: Não é um problema. É o comportamento correto para respeitar o horário de almoço.

## 🔮 Melhorias Futuras

- [ ] Exceções para datas específicas (feriados, férias)
- [ ] Configuração de intervalo entre slots por profissional
- [ ] Horários sazonais (ex: verão vs inverno)
- [ ] Interface administrativa para gerenciar horários
- [ ] Validação de sobreposição de períodos
- [ ] Histórico de alterações de horários

## 📝 Resumo

O sistema de horários de trabalho permite total flexibilidade na configuração de quando cada profissional está disponível, com suporte a:

✅ Horários diferentes por dia da semana
✅ Múltiplos períodos no mesmo dia
✅ Dias de folga
✅ Integração transparente com availability
✅ Fallback automático para horários padrão

Isso resolve perfeitamente o caso do Barbeiro Samuel e permite configurar qualquer padrão de horários necessário!
