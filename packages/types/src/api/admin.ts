// ============================================================================
// CONSTANTS
// ============================================================================

import { PaginatedResponse } from './index.js';

export const CONFIG_CONSTRAINTS = {
  LOG_RETENTION: {
    MIN_DAYS: 1,
    MAX_DAYS: 365,
  },
  LOGGING_METHODS: {
    REQUIRE_AT_LEAST_ONE: true,
  },
} as const;

export const CONFIG_KEYS = {
  AUTH_LOG_RETENTION: 'auth_log_retention_days',
  API_LOG_RETENTION: 'api_log_retention_days',
  LOGGING_MONGO_ENABLED: 'logging_mongo_enabled',
  LOGGING_FILE_ENABLED: 'logging_file_enabled',
} as const;

export const CONFIG_DEFAULTS = {
  SECURITY_LOG_DAYS: 90,
  API_LOG_DAYS: 30,
  MONGO_ENABLED: false,
  FILE_ENABLED: true,
} as const;

export const ADMIN_CONFIG_ENDPOINTS = {
  LOG_RETENTION: 'admin/config/log-retention',
  LOGGING_CONFIG: 'admin/config/logging-config',
} as const;

// ============================================================================
// ENUMS
// ============================================================================

// (None currently for admin domain)

// ============================================================================
// INTERFACES
// ============================================================================

export interface LogRetentionSettings {
  securityLogDays: number;
  apiLogDays: number;
  mongoEnabled: boolean;
  fileEnabled: boolean;
}

export interface UpdateLogRetentionRequest {
  securityLogDays: number;
  apiLogDays: number;
}

export interface UpdateLoggingConfigRequest {
  mongoEnabled: boolean;
  fileEnabled: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  createdAt: string; // ISO string representation of date
  lastLoginAt: string | null; // ISO string or null
  sessionCount: number;
}

export interface AdminUsersResponse extends PaginatedResponse<AdminUser> {}
