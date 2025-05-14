import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { AppConfig } from '@/config/configuration';
import * as crypto from 'crypto';

@Injectable()
export class AuthCookieService {
  constructor(private config: AppConfig) {}

  setCookie(res: Response, token: string) {
    res.cookie('auth_token', token, this.getCookieOptions());
  }

  clearCookie(res: Response) {
    res.clearCookie('auth_token', this.getCookieOptions());
  }

  private getCookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: (isProduction ? 'none' : 'lax') as
        | boolean
        | 'none'
        | 'lax'
        | 'strict'
        | undefined,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    };
  }

  generateCsrfToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  setCsrfCookie(res: Response): string {
    const token = this.generateCsrfToken();

    res.cookie('csrf_token', token, {
      httpOnly: false, // Must be accessible from JS
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return token;
  }
}
