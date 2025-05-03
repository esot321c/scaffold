export enum ErrorType {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  SERVER = 'server',
  NETWORK = 'network',
  UNKNOWN = 'unknown',
}

export interface ApiError extends Error {
  status?: number;
  type: ErrorType;
  requestId?: string;
  errors?: Record<string, string[]>; // For validation errors
  timestamp?: string;
}

// Function to determine error type
export function determineErrorType(status?: number): ErrorType {
  if (!status) return ErrorType.NETWORK;

  if (status === 401) return ErrorType.AUTHENTICATION;
  if (status === 403) return ErrorType.AUTHORIZATION;
  if (status === 422 || status === 400) return ErrorType.VALIDATION;
  if (status >= 500) return ErrorType.SERVER;

  return ErrorType.UNKNOWN;
}

// Create customized error from response
export function createApiError(
  message: string,
  status?: number,
  data?: any,
): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.type = determineErrorType(status);

  if (data) {
    error.requestId = data.requestId;
    error.errors = data.errors;
    error.timestamp = data.timestamp;
  }

  return error;
}
