import { Injectable } from '@nestjs/common';

@Injectable()
export class ErrorHandlingService {
  /**
   * Determines if an error from Resend API is non-recoverable
   * (i.e., retrying the request won't help)
   */
  isNonRecoverableResendError(error: {
    name?: string;
    message?: string;
  }): boolean {
    // No error object at all
    if (!error) {
      return false;
    }

    // Check error by name
    if (error.name) {
      // Auth/permission errors (non-recoverable)
      const authErrors = [
        'unauthorized',
        'forbidden',
        'authentication_failed',
        'invalid_api_key',
      ];

      // Configuration errors (non-recoverable)
      const configErrors = [
        'invalid_sender',
        'invalid_to_address',
        'invalid_from_address',
        'domain_not_verified',
        'account_suspended',
        'permission_denied',
      ];

      // Validation errors (non-recoverable)
      const validationErrors = [
        'validation_error',
        'invalid_payload',
        'invalid_request',
      ];

      if (
        [...authErrors, ...configErrors, ...validationErrors].includes(
          error.name,
        )
      ) {
        return true;
      }

      // Rate limit errors (potentially recoverable after delay)
      if (error.name === 'rate_limit_exceeded') {
        return false;
      }
    }

    // Check error message content as fallback
    if (error.message) {
      const nonRecoverablePatterns = [
        /api key/i,
        /authentication/i,
        /invalid sender/i,
        /invalid recipient/i,
        /domain not verified/i,
        /account suspended/i,
        /permission denied/i,
        /validation error/i,
      ];

      if (
        error.message !== undefined &&
        nonRecoverablePatterns.some((pattern) => pattern.test(error.message!))
      ) {
        return true;
      }
    }

    // Default to considering unknown errors as potentially recoverable
    return false;
  }

  /**
   * Generic method to determine if any API error is non-recoverable
   */
  isNonRecoverableError(error: any): boolean {
    // Handle Resend errors
    if (error.name !== undefined) {
      return this.isNonRecoverableResendError(error);
    }

    // Handle HTTP status code based errors
    if (error.status || error.statusCode) {
      const status = error.status || error.statusCode;

      // Auth errors (401, 403) are not recoverable without intervention
      if (status === 401 || status === 403) {
        return true;
      }

      // Bad requests (validation errors, etc) are not recoverable
      if (status === 400 || status === 422) {
        return true;
      }

      // Rate limit errors might be recoverable after some time
      if (status === 429) {
        return false;
      }

      // Server errors might be recoverable
      if (status >= 500) {
        return false;
      }
    }

    // Default to considering unknown errors as potentially recoverable
    return false;
  }
}
