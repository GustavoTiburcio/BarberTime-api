import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool } from '../lib/db';
import { withCors } from './_utils/cors';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (withCors(req, res)) return;

  // GET - Buscar horários de trabalho de um profissional
  if (req.method === 'GET') {
    const { professionalId } = req.query;

    if (!professionalId || typeof professionalId !== 'string') {
      return res.status(400).json({ error: 'professionalId é obrigatório' });
    }

    try {
      const result = await pool.query(
        `
        SELECT
          id,
          professional_id,
          day_of_week,
          start_time,
          end_time,
          created_at
        FROM professional_work_hours
        WHERE professional_id = $1
        ORDER BY day_of_week ASC, start_time ASC
        `,
        [professionalId]
      );

      const workHours = result.rows.map(row => ({
        id: row.id,
        professionalId: row.professional_id,
        dayOfWeek: row.day_of_week,
        dayName: getDayName(row.day_of_week),
        startTime: row.start_time,
        endTime: row.end_time,
        createdAt: row.created_at,
      }));

      return res.status(200).json(workHours);
    } catch (error) {
      console.error('Erro ao buscar horários de trabalho:', error);
      return res.status(500).json({ error: 'Erro ao buscar horários de trabalho' });
    }
  }

  // POST - Criar novo horário de trabalho
  if (req.method === 'POST') {
    const { professionalId, dayOfWeek, startTime, endTime } = req.body;

    if (
      !professionalId ||
      dayOfWeek === undefined ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        error: 'professionalId, dayOfWeek, startTime e endTime são obrigatórios',
      });
    }

    // Validar dayOfWeek
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({
        error: 'dayOfWeek deve estar entre 0 (Domingo) e 6 (Sábado)',
      });
    }

    try {
      const result = await pool.query(
        `
        INSERT INTO professional_work_hours
          (professional_id, day_of_week, start_time, end_time)
        VALUES
          ($1, $2, $3, $4)
        RETURNING id, professional_id, day_of_week, start_time, end_time, created_at
        `,
        [professionalId, dayOfWeek, startTime, endTime]
      );

      const row = result.rows[0];
      const workHour = {
        id: row.id,
        professionalId: row.professional_id,
        dayOfWeek: row.day_of_week,
        dayName: getDayName(row.day_of_week),
        startTime: row.start_time,
        endTime: row.end_time,
        createdAt: row.created_at,
      };

      return res.status(201).json(workHour);
    } catch (error: any) {
      console.error('Erro ao criar horário de trabalho:', error);

      if (error.code === '23503') {
        return res.status(400).json({ error: 'Profissional não encontrado' });
      }

      if (error.code === '23514') {
        return res.status(400).json({ error: 'Horário inválido (start_time deve ser menor que end_time)' });
      }

      return res.status(500).json({ error: 'Erro ao criar horário de trabalho' });
    }
  }

  // PUT - Atualizar horário de trabalho existente
  if (req.method === 'PUT') {
    const { id } = req.query;
    const { dayOfWeek, startTime, endTime } = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'ID do horário é obrigatório' });
    }

    if (
      dayOfWeek === undefined ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        error: 'dayOfWeek, startTime e endTime são obrigatórios',
      });
    }

    // Validar dayOfWeek
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({
        error: 'dayOfWeek deve estar entre 0 (Domingo) e 6 (Sábado)',
      });
    }

    try {
      const result = await pool.query(
        `
        UPDATE professional_work_hours
        SET
          day_of_week = $1,
          start_time = $2,
          end_time = $3
        WHERE id = $4
        RETURNING id, professional_id, day_of_week, start_time, end_time, created_at
        `,
        [dayOfWeek, startTime, endTime, id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Horário de trabalho não encontrado' });
      }

      const row = result.rows[0];
      const workHour = {
        id: row.id,
        professionalId: row.professional_id,
        dayOfWeek: row.day_of_week,
        dayName: getDayName(row.day_of_week),
        startTime: row.start_time,
        endTime: row.end_time,
        createdAt: row.created_at,
      };

      return res.status(200).json(workHour);
    } catch (error: any) {
      console.error('Erro ao atualizar horário de trabalho:', error);

      if (error.code === '23514') {
        return res.status(400).json({ error: 'Horário inválido (start_time deve ser menor que end_time)' });
      }

      return res.status(500).json({ error: 'Erro ao atualizar horário de trabalho' });
    }
  }

  // DELETE - Remover horário de trabalho
  if (req.method === 'DELETE') {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'ID do horário é obrigatório' });
    }

    try {
      const result = await pool.query(
        `DELETE FROM professional_work_hours WHERE id = $1 RETURNING id`,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Horário de trabalho não encontrado' });
      }

      return res.status(200).json({ message: 'Horário de trabalho removido com sucesso' });
    } catch (error) {
      console.error('Erro ao remover horário de trabalho:', error);
      return res.status(500).json({ error: 'Erro ao remover horário de trabalho' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Helper function to get day name in Portuguese
function getDayName(dayOfWeek: number): string {
  const days = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];
  return days[dayOfWeek] || 'Desconhecido';
}
