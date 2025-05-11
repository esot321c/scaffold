import { UserRole } from '../enums/index.js';

export interface User {
  id: string;
  email: string;
  name?: string | null;
  companyName?: string | null;
  companyLogo?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  createdAt: Date;
  updatedAt: Date;
  role: UserRole;
}

export interface UserWithSession extends User {
  session: {
    id: string;
    expiresAt: Date;
    lastActiveAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  };
}
