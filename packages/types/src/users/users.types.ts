export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  companyName: string | null;
  companyLogo: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  role: UserRole;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  id: string;
  expiresAt: string;
  createdAt: string;
  lastActiveAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface UserWithSession extends User {
  session: UserSession;
}
