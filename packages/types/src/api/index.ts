import { AuthEventType } from '../enums/index.js';
import { AdminUser } from './admin.js';

export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface ApiStatus {
  status: string;
  timestamp: string;
  version: string;
}

export interface BaseLog {
  timestamp?: string;
  level: string;
  requestId?: string;
}

export interface ApiLog extends BaseLog {
  message: string;
  context: string;
  userId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  responseTime?: number;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface UserBasic {
  id: string;
  email: string;
  name?: string | null;
}

export interface SecurityLog extends BaseLog {
  id?: string;
  userId: string;
  user?: UserBasic;
  event: AuthEventType;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  sessionId?: string;
  details?: Record<string, any>;
}

export interface LogFilter {
  page?: number;
  limit?: number;
  search?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface SecurityLogFilter extends LogFilter {
  userId?: string;
  userIds?: string[];
  event?: AuthEventType;
  success?: boolean;
  includeDetails?: boolean;
}

export interface ApiLogFilter extends LogFilter {
  path?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
}
