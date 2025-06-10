import { UserRole } from '../users/users.types.js';

// Admin-specific view of user data
export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string | null;
  sessionCount: number;
}
