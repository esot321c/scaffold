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

export enum SystemEventType {
  // Service health
  SERVICE_DOWN = 'service_down',
  SERVICE_RECOVERED = 'service_recovered',
  HIGH_ERROR_RATE = 'high_error_rate',

  // Database
  DATABASE_CONNECTION_LOST = 'database_connection_lost',
  DATABASE_CONNECTION_RESTORED = 'database_connection_restored',
  DATABASE_SLOW_QUERY = 'database_slow_query',

  // Queue system
  QUEUE_FAILURE = 'queue_failure',
  QUEUE_BACKED_UP = 'queue_backed_up',
  QUEUE_RECOVERY = 'queue_recovered',

  // System resources
  DISK_SPACE_LOW = 'disk_space_low',
  DISK_SPACE_NORMAL = 'disk_space_normal',
  MEMORY_USAGE_HIGH = 'memory_usage_high',
  MEMORY_USAGE_NORMAL = 'memory_usage_normal',
  CPU_USAGE_HIGH = 'cpu_usage_high',
  CPU_USAGE_NORMAL = 'cpu_usage_normal',

  // API
  API_RATE_LIMIT_EXCEEDED = 'api_rate_limit_exceeded',
  API_ENDPOINT_SLOW = 'api_endpoint_slow',

  // Deployments
  DEPLOYMENT_STARTED = 'deployment_started',
  DEPLOYMENT_COMPLETED = 'deployment_completed',
  DEPLOYMENT_FAILED = 'deployment_failed',

  // Backups
  BACKUP_STARTED = 'backup_started',
  BACKUP_COMPLETED = 'backup_completed',
  BACKUP_FAILED = 'backup_failed',

  // General
  CRITICAL_ERROR = 'critical_error',
  SECURITY_ALERT = 'security_alert',
}
