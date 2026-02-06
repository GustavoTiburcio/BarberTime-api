import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';

import { pool } from '../lib/db';
import { withCors } from './_utils/cors';

export default async function handler(

  req: VercelRequest,
  res: VercelResponse
) {
  if (withCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token é obrigatório' });
  }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const professionalId = decoded.sub;

    const result = await pool.query(
      `
      SELECT id, name, avatar, specialties, rating, username, role
      FROM professionals
      WHERE id = $1
        AND active = true
      `,
      [professionalId]
    );

    const professional = result.rows[0];

    if (!professional) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }

    return res.status(200).json(professional);
  } catch (error) {
    console.error('Erro ao buscar profissional:', error);
    return res.status(401).json({ error: 'Token inválido' });
  }


}