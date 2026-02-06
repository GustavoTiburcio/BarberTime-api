import jwt from 'jsonwebtoken';
import type { VercelRequest } from '@vercel/node';

export function authenticate(req: VercelRequest) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new Error('Token não informado');
  }

  const [, token] = authHeader.split(' ');

  if (!token) {
    throw new Error('Token inválido');
  }

  return jwt.verify(token, process.env.JWT_SECRET!);
}
