import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool } from '../lib/db';
import { withCors } from './_utils/cors';

const OPEN_HOUR = 9;
const CLOSE_HOUR = 20;
const SLOT_INTERVAL = 60; // minutos

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m + minutes, 0, 0);
  return date.toTimeString().slice(0, 5);
}

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

    // 3️⃣ Gerar slots do dia
    const availableSlots: string[] = [];

    const startDay = OPEN_HOUR * 60;
    const endDay = CLOSE_HOUR * 60;

    for (
      let slotStart = startDay;
      slotStart + serviceDuration <= endDay;
      slotStart += SLOT_INTERVAL
    ) {
      const slotEnd = slotStart + serviceDuration;

      const hasConflict = bookings.some(
        booking =>
          slotStart < booking.end && slotEnd > booking.start
      );

      if (!hasConflict) {
        const hours = Math.floor(slotStart / 60);
        const minutes = slotStart % 60;
        availableSlots.push(
          `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        );
      }
    }

    // 4️⃣ Filtrar horários que já passaram se for o dia atual
    const now = new Date();
    const requestedDate = new Date(date + 'T00:00:00');
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
