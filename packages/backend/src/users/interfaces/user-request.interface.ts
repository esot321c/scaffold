import { UserRole } from '@/generated/prisma';
import { Request } from 'express';

interface JwtPayload {
  sub: string;
  email: string;
  sessionId: string;
}

export interface RequestWithUser extends Request {
  user: JwtPayload;
}

export interface JwtUser {
  id: string;
  email: string;
  role?: UserRole;
  sessionId: string;
}
