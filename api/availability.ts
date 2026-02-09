import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool } from '../lib/db';
import { withCors } from './_utils/cors';

const SLOT_INTERVAL = 60; // minutos

function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (withCors(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { date, professionalId, serviceId } = req.query;

  if (
    typeof date !== 'string' ||
    typeof professionalId !== 'string' ||
    typeof serviceId !== 'string'
  ) {
    return res.status(400).json({
      error: 'date, professionalId e serviceId são obrigatórios',
    });
  }

  try {
    // 1️⃣ Buscar duração do serviço
    const serviceResult = await pool.query(
      `SELECT duration FROM services WHERE id = $1 AND active = true`,
      [serviceId]
    );

    if (serviceResult.rowCount === 0) {
      return res.status(400).json({ error: 'Serviço inválido' });
    }

    const serviceDuration = serviceResult.rows[0].duration;

    // 1.5️⃣ Buscar horários de trabalho do profissional para o dia da semana
    const requestedDate = new Date(date + 'T00:00:00');
    const dayOfWeek = requestedDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

    const workHoursResult = await pool.query(
      `
      SELECT start_time, end_time
      FROM professional_work_hours
      WHERE professional_id = $1 AND day_of_week = $2
      ORDER BY start_time ASC
      `,
      [professionalId, dayOfWeek]
    );

    // Se não houver horários cadastrados, retornar array vazio (dia de folga)
    const workPeriods =
      workHoursResult.rowCount && workHoursResult.rowCount > 0
        ? workHoursResult.rows.map(row => ({
            start: timeToMinutes(row.start_time),
            end: timeToMinutes(row.end_time),
          }))
        : [];

    // 2️⃣ Buscar agendamentos do profissional no dia
    const bookingsResult = await pool.query(
      `
      SELECT
        b.time,
        s.duration
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE
        b.professional_id = $1
        AND b.date = $2
        AND b.status IN ('completed','confirmed', 'pending')
      `,
      [professionalId, date]
    );

    const bookings = bookingsResult.rows.map(b => ({
      start: timeToMinutes(b.time),
      end: timeToMinutes(b.time) + b.duration,
    }));

    // 3️⃣ Gerar slots para cada período de trabalho
    const availableSlots: string[] = [];

    for (const period of workPeriods) {
      for (
        let slotStart = period.start;
        slotStart + serviceDuration <= period.end;
        slotStart += SLOT_INTERVAL
      ) {
        const slotEnd = slotStart + serviceDuration;

        // Verificar se o slot está dentro do período de trabalho
        if (slotEnd > period.end) {
          break;
        }

        // Verificar conflito com agendamentos existentes
        const hasConflict = bookings.some(
          booking =>
            slotStart < booking.end && slotEnd > booking.start
        );

        if (!hasConflict) {
          const hours = Math.floor(slotStart / 60);
          const minutes = slotStart % 60;
          const timeSlot = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

          // Evitar duplicatas (pode acontecer se períodos se sobrepõem)
          if (!availableSlots.includes(timeSlot)) {
            availableSlots.push(timeSlot);
          }
        }
      }
    }

    // Ordenar slots
    availableSlots.sort();

    // 4️⃣ Filtrar horários que já passaram se for o dia atual
    const now = new Date();
    const isToday =
      requestedDate.getFullYear() === now.getFullYear() &&
      requestedDate.getMonth() === now.getMonth() &&
      requestedDate.getDate() === now.getDate();

    if (isToday) {
      const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();

      const futureSlots = availableSlots.filter(slot => {
        const slotTimeInMinutes = timeToMinutes(slot);
        return slotTimeInMinutes > currentTimeInMinutes;
      });

      return res.status(200).json(futureSlots);
    }

    return res.status(200).json(availableSlots);
  } catch (error) {
    console.error('Erro ao calcular disponibilidade:', error);
    return res.status(500).json({
      error: 'Erro ao calcular horários disponíveis',
    });
  }
}
