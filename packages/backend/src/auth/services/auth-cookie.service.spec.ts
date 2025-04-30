import { Test, TestingModule } from '@nestjs/testing';
import { AuthCookieService } from './auth-cookie.service';
import { AppConfig } from '../../config/configuration';
import { Response } from 'express';

describe('AuthCookieService', () => {
  let service: AuthCookieService;
  let mockConfig: Partial<AppConfig>;
  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    mockConfig = {
      auth: {
        frontendUrl: 'http://localhost:3000',
        jwtSecret: 'test-secret',
        google: {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
        },
      },
    };

    mockResponse = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthCookieService,
        {
          provide: AppConfig,
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<AuthCookieService>(AuthCookieService);

    // Mock environment for testing
    process.env.NODE_ENV = 'development';
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should set an auth cookie', () => {
    service.setCookie(mockResponse as Response, 'test-token');

    expect(mockResponse.cookie).toHaveBeenCalledWith(
      'auth_token',
      'test-token',
      expect.objectContaining({
        httpOnly: true,
        secure: false, // development mode
        sameSite: 'lax',
        maxAge: expect.any(Number),
        path: '/',
      }),
    );
  });

  it('should clear auth cookie', () => {
    service.clearCookie(mockResponse as Response);

    expect(mockResponse.clearCookie).toHaveBeenCalledWith(
      'auth_token',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
      }),
    );
  });

  it('should generate CSRF token', () => {
    const token = service.generateCsrfToken();
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(32); // Assuming we use a reasonably long token
  });

  it('should set a CSRF cookie and return the token', () => {
    const token = service.setCsrfCookie(mockResponse as Response);

    expect(token).toBeDefined();
    expect(mockResponse.cookie).toHaveBeenCalledWith(
      'csrf_token',
      token,
      expect.objectContaining({
        httpOnly: false, // Must be accessible from JS
        secure: false,
        sameSite: 'lax',
      }),
    );
  });

  it('should use secure cookies in production', () => {
    // Mock production environment
    process.env.NODE_ENV = 'production';

    service.setCookie(mockResponse as Response, 'test-token');

    expect(mockResponse.cookie).toHaveBeenCalledWith(
      'auth_token',
      'test-token',
      expect.objectContaining({
        secure: true,
        sameSite: 'none',
      }),
    );
  });
});
