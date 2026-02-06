import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../lib/db';
import { withCors } from './_utils/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (withCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha obrigatórios' });
  }

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM professionals
      WHERE username = $1
        AND active = true
      `,
      [username]
    );

    const professional = result.rows[0];

    if (!professional) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      professional.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const token = jwt.sign(
      {
        sub: professional.id,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      token,
      professional: {
        id: professional.id,
        name: professional.name,
        avatar: professional.avatar,
        specialties: professional.specialties,
        rating: professional.rating,
        username: professional.username,
        role: professional.role,
      },
    });

  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
