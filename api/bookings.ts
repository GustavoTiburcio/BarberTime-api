import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool } from '../lib/db';
import { withCors } from './_utils/cors';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (withCors(req, res)) return;

  if (req.method === 'GET') {
    const { startDate, endDate, professionalId, status } = req.query;

    if (!startDate || typeof startDate !== 'string') {
      return res.status(400).json({ error: 'Parâmetro startDate é obrigatório' });
    }

    if (!endDate || typeof endDate !== 'string') {
      return res.status(400).json({ error: 'Parâmetro endDate é obrigatório' });
    }

    try {
      const values: any[] = [];
      let whereClause = 'WHERE b.date >= $1 AND b.date <= $2';

      values.push(startDate, endDate);

      if (professionalId && typeof professionalId === 'string') {
        values.push(professionalId);
        whereClause += ` AND b.professional_id = $${values.length}`;
      }

      if (status && typeof status === 'string') {
        const multipleStatuses = status
          .split(',')
          .map(s => s.trim().toLowerCase())
          .filter(Boolean);

        if (multipleStatuses.length > 0) {
          const statusPlaceholders = multipleStatuses
            .map((_, idx) => `$${values.length + idx + 1}`)
            .join(', ');

          values.push(...multipleStatuses);
          whereClause += ` AND b.status IN (${statusPlaceholders})`;
        }
      }

      const query = `
      SELECT
        b.id,
        b.client_name,
        b.client_phone,
        b.date,
        b.time,
        b.status,
        b.created_at,

        s.id AS service_id,
        s.name AS service_name,
        s.duration AS service_duration,
        s.price AS service_price,

        p.id AS professional_id,
        p.name AS professional_name

      FROM bookings b
      JOIN services s ON s.id = b.service_id
      JOIN professionals p ON p.id = b.professional_id

      ${whereClause}

      ORDER BY b.date ASC, b.time ASC
    `;

      const result = await pool.query(query, values);

      const bookings = result.rows.map(row => ({
        id: row.id,
        clientName: row.client_name,
        clientPhone: row.client_phone,
        date: row.date,
        time: row.time,
        status: row.status,
        createdAt: row.created_at,
        service: {
          id: row.service_id,
          name: row.service_name,
          duration: row.service_duration,
          price: Number(row.service_price),
        },
        professional: {
          id: row.professional_id,
          name: row.professional_name,
        },
      }));

      return res.status(200).json(bookings);
    } catch (error) {
      console.error('Erro ao buscar agenda:', error);
      return res.status(500).json({ error: 'Erro ao buscar agenda' });
    }
  }

  if (req.method === 'POST') {

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
          AND (b.status = 'pending' OR b.status = 'confirmed' OR b.status = 'completed')
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
          ($1, $2, $3, $4, $5, $6, 'pending')
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

      return res.status(201).json(insertResult.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(error);
      return res.status(500).json({ error: 'Erro ao criar agendamento' });
    } finally {
      client.release();
    }
  }

  if (req.method === 'PATCH') {
    const { id, status } = req.body;

    if (!id || !status) {
      return res.status(400).json({ error: 'ID e status são obrigatórios' });
    }

    try {
      const updateResult = await pool.query(
        `UPDATE bookings SET status = $1 WHERE id = $2 RETURNING id`,
        [status, id]
      );

      if (updateResult.rowCount === 0) {
        return res.status(404).json({ error: 'Agendamento não encontrado' });
      }

      return res.status(200).json({ message: 'Status atualizado com sucesso' });
    } catch (error) {
      console.error('Erro ao atualizar status do agendamento:', error);
      return res.status(500).json({ error: 'Erro ao atualizar status do agendamento' });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'ID do agendamento é obrigatório' });
    }
    try {
      const deleteResult = await pool.query(
        `UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING id`,
        [id]
      );
      if (deleteResult.rowCount === 0) {
        return res.status(404).json({ error: 'Agendamento não encontrado' });
      }
      return res.status(200).json({ message: 'Agendamento cancelado com sucesso' });
    } catch (error) {
      console.error('Erro ao cancelar agendamento:', error);
      return res.status(500).json({ error: 'Erro ao cancelar agendamento' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
