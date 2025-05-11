export enum AuthEventType {
  LOGIN = 'login',
  LOGOUT = 'logout',
  TOKEN_REFRESH = 'token_refresh',
  PASSWORD_RESET = 'password_reset',
  FAILED_LOGIN = 'failed_login',
  SESSION_EXPIRED = 'session_expired',
  DEVICE_TRUSTED = 'device_trusted',
  DEVICE_REMOVED = 'device_removed',
  DEVICE_REGISTERED = 'device_registered',
  SESSION_CREATED = 'session_created',
  SESSION_ROTATED = 'session_rotated',
  SESSION_TERMINATED = 'session_terminated',
  ALL_SESSIONS_TERMINATED = 'all_sessions_terminated',
  CSRF_FAILURE = 'csrf_failure',
  SUSPICIOUS_AUTH_ACTIVITY = 'suspicious_auth_activity',
}

// Prisma Enum on backend
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}
