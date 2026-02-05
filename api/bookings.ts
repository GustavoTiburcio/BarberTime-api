import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool } from '../lib/db';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    clientName,
    clientPhone,
    date,
    time,
    serviceId,
    professionalId,
  } = req.body;

  // 🧪 Validação básica
  if (
    !clientName ||
    !clientPhone ||
    !date ||
    !time ||
    !serviceId ||
    !professionalId
  ) {
    return res.status(400).json({
      error: 'Dados obrigatórios não informados',
    });
  }

  try {
    /**
     * 🔒 Importante:
     * Não precisamos checar conflito manualmente
     * porque o banco já garante isso via UNIQUE INDEX
     */

    const result = await pool.query(
      `
      INSERT INTO bookings
        (client_name, client_phone, date, time, service_id, professional_id, status)
      VALUES
        ($1, $2, $3, $4, $5, $6, 'confirmed')
      RETURNING id, status
      `,
      [
        clientName,
        clientPhone,
        date,
        time,
        serviceId,
        professionalId,
      ]
    );

    const booking = result.rows[0];

    res.status(201).json(booking);
  } catch (error: any) {
    console.error('Erro ao criar agendamento:', error);

    // 🚫 Conflito de horário
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Horário indisponível para este profissional',
      });
    }

    res.status(500).json({
      error: 'Erro interno ao criar agendamento',
    });
  }
}
