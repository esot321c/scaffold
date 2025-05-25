import Cookies from 'js-cookie';
import { createApiError } from './api-errors';
import type { ApiError } from './api-errors';

const API_URL = import.meta.env.VITE_API_URL;

export function getCsrfToken(): string | undefined {
  return Cookies.get('csrf_token');
}

// Generic request function
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Add CSRF token for non-GET requests
  if (options.method && options.method !== 'GET') {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  try {
    const response = await fetch(`${API_URL}/${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // Important for cookies
    });

    // Handle 401 with automatic retry
    if (response.status === 401 && !endpoint.includes('auth/refresh')) {
      try {
        // Try to refresh token
        await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        // Retry original request
        const retryResponse = await fetch(`${API_URL}/${endpoint}`, {
          ...options,
          headers,
          credentials: 'include',
        });

        if (retryResponse.ok) {
          return retryResponse.status === 204
            ? ({} as T)
            : retryResponse.json();
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        window.location.href = '/login?error=session_expired';
        throw createApiError('Session expired', 401);
      }
    }

    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = 'An unknown error occurred';
      let errorData = {};

      try {
        const data = await response.json();
        errorMessage = data.message ?? errorMessage;
        errorData = data;
      } catch (e) {
        // If parsing fails, use status text
        errorMessage = response.statusText ?? errorMessage;
      }

      throw createApiError(errorMessage, response.status, errorData);
    }

    // Handle empty responses
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  } catch (error) {
    // Handle fetch errors (network errors)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw createApiError(
        'Unexpected network error. The server may be down or not responding. ',
        undefined,
      );
    }

    // Rethrow ApiErrors
    if ((error as ApiError).type) {
      throw error;
    }

    // Handle other errors
    throw createApiError(
      error instanceof Error ? error.message : 'An unknown error occurred',
      undefined,
    );
  }
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, data?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};

// Re-export error types
export * from './api-errors';
