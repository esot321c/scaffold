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
