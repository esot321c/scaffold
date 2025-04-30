import Cookies from 'js-cookie';

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

  const response = await fetch(`${API_URL}/${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // Important for cookies
  });

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

    // Create an error object with status code and response data
    const error = new Error(errorMessage) as Error & {
      status?: number;
      data?: any;
    };

    error.status = response.status;
    error.data = errorData;

    throw error;
  }

  // Handle empty responses
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
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
