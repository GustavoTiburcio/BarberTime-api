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

  if (
    !clientName ||
    !clientPhone ||
    !date ||
    !time ||
    !serviceId ||
    !professionalId
  ) {
    return res.status(400).json({ error: 'Dados obrigatórios não informados' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1️⃣ Buscar duração do serviço
    const serviceResult = await client.query(
      `SELECT duration FROM services WHERE id = $1 AND active = true`,
      [serviceId]
    );

    if (serviceResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Serviço inválido' });
    }

    const serviceDuration = serviceResult.rows[0].duration;

    // 2️⃣ Verificar conflito de horário
    const conflictResult = await client.query(
      `
      SELECT 1
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE
        b.professional_id = $1
        AND b.date = $2
        AND b.status = 'confirmed'
        AND (
          (b.time < ($3::time + make_interval(mins => $4)))
          AND
          ((b.time + make_interval(mins => s.duration)) > $3::time)
        )
      LIMIT 1
      `,
      [
        professionalId,
        date,
        time,
        serviceDuration,
      ]
    );

    if (conflictResult?.rowCount && conflictResult.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Horário indisponível para este profissional',
      });
    }

    // 3️⃣ Inserir agendamento
    const insertResult = await client.query(
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

    await client.query('COMMIT');

    res.status(201).json(insertResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar agendamento' });
  } finally {
    client.release();
  }
}
