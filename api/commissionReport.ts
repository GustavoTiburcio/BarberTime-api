import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool } from '../lib/db';
import { withCors } from './_utils/cors';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (withCors(req, res)) return;

  if (req.method === 'GET') {
    const { professionalId, startDate, endDate } = req.query;

    // Validação dos parâmetros obrigatórios
    if (!professionalId || typeof professionalId !== 'string') {
      return res.status(400).json({ error: 'professionalId é obrigatório' });
    }

    if (!startDate || typeof startDate !== 'string') {
      return res.status(400).json({ error: 'startDate é obrigatório' });
    }

    if (!endDate || typeof endDate !== 'string') {
      return res.status(400).json({ error: 'endDate é obrigatório' });
    }

    try {
      // Buscar informações do profissional incluindo comissão
      const professionalResult = await pool.query(
        `SELECT id, name, comission FROM professionals WHERE id = $1`,
        [professionalId]
      );

      if (professionalResult.rowCount === 0) {
        return res.status(404).json({ error: 'Profissional não encontrado' });
      }

      const professional = professionalResult.rows[0];
      const commissionRate = Number(professional.comission) || 0;

      // Buscar bookings completados no período
      const bookingsResult = await pool.query(
        `
        SELECT
          b.id,
          b.client_name,
          b.client_phone,
          b.date,
          b.time,
          b.status,
          b.service_price,
          b.created_at,

          s.id AS service_id,
          s.name AS service_name,
          s.duration AS service_duration

        FROM bookings b
        JOIN services s ON s.id = b.service_id

        WHERE
          b.professional_id = $1
          AND b.date >= $2
          AND b.date <= $3
          AND b.status = 'completed'

        ORDER BY b.date ASC, b.time ASC
        `,
        [professionalId, startDate, endDate]
      );

      // Calcular comissão para cada booking
      const bookingsWithCommission = bookingsResult.rows.map(row => {
        const servicePrice = Number(row.service_price) || 0;
        const commissionAmount = (servicePrice * commissionRate) / 100;

        return {
          id: row.id,
          clientName: row.client_name,
          clientPhone: row.client_phone,
          date: row.date,
          time: row.time,
          status: row.status,
          servicePrice: servicePrice,
          commissionRate: commissionRate,
          commissionAmount: Number(commissionAmount.toFixed(2)),
          createdAt: row.created_at,
          service: {
            id: row.service_id,
            name: row.service_name,
            duration: row.service_duration,
          },
        };
      });

      // Calcular totais
      const totalServicePrice = bookingsWithCommission.reduce(
        (sum, booking) => sum + booking.servicePrice,
        0
      );

      const totalCommission = bookingsWithCommission.reduce(
        (sum, booking) => sum + booking.commissionAmount,
        0
      );

      const totalBookings = bookingsWithCommission.length;

      // Retornar relatório completo
      return res.status(200).json({
        professional: {
          id: professional.id,
          name: professional.name,
          commissionRate: commissionRate,
        },
        period: {
          startDate,
          endDate,
        },
        summary: {
          totalBookings,
          totalServicePrice: Number(totalServicePrice.toFixed(2)),
          totalCommission: Number(totalCommission.toFixed(2)),
          averageServicePrice: totalBookings > 0
            ? Number((totalServicePrice / totalBookings).toFixed(2))
            : 0,
          averageCommission: totalBookings > 0
            ? Number((totalCommission / totalBookings).toFixed(2))
            : 0,
        },
        bookings: bookingsWithCommission,
      });
    } catch (error) {
      console.error('Erro ao gerar relatório de comissão:', error);
      return res.status(500).json({ error: 'Erro ao gerar relatório de comissão' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
