import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserRole } from '../src/generated/prisma';
import { AuthService } from '../src/auth/services/auth.service';
import { AppModule } from '@/app.module';
import { AuthCookieService } from '@/auth/services/auth-cookie.service';

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = (...args) => {
  originalConsoleLog('\x1b[32m[TEST LOG]\x1b[0m', ...args);
};

console.error = (...args) => {
  originalConsoleError('\x1b[31m[TEST ERROR]\x1b[0m', ...args);
};

// Define a test context interface to share state between tests
interface TestContext {
  // User and session data
  user: any;

  // Auth flows
  getBrowserAuth: () => Promise<BrowserAuthContext>;
  getMobileAuth: () => Promise<MobileAuthContext>;

  // Current auth contexts for different test suites
  browserAuth?: BrowserAuthContext;
  mobileAuth?: MobileAuthContext;
}

// Browser-specific authentication context
interface BrowserAuthContext {
  sessionId: string;
  authCookie: string;
  csrfToken: string;
  csrfCookie: string;
  refreshCSRF: () => Promise<void>;
}

// Mobile/API specific authentication context
interface MobileAuthContext {
  sessionId: string;
  bearerToken: string;
}

describe('Authentication System (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let authService: AuthService;
  let authCookieService: AuthCookieService;

  // Create a test context to share between tests
  const ctx: TestContext = {
    user: null,

    // These will be implemented in beforeAll
    getBrowserAuth: async () => {
      throw new Error('Browser auth flow not implemented yet');
    },

    getMobileAuth: async () => {
      throw new Error('Mobile auth flow not implemented yet');
    },
  };

  beforeAll(async () => {
    // Create the test application with the entire app module
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply middleware that the app normally has
    app.use(cookieParser());

    await app.init();

    // Get required services
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    authService = app.get<AuthService>(AuthService);
    authCookieService = app.get<AuthCookieService>(AuthCookieService);

    // Setup: Create a test user
    const user = await prismaService.user.create({
      data: {
        email: `e2e-test-${Date.now()}@example.com`,
        name: 'E2E Test User',
        role: UserRole.USER,
      },
    });

    ctx.user = user;

    // Implement the browser auth flow
    ctx.getBrowserAuth = async (): Promise<BrowserAuthContext> => {
      // Create a browser session
      const session = await prismaService.session.create({
        data: {
          userId: user.id,
          token: `browser-session-${Date.now()}`,
          isValid: true,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          ipAddress: '127.0.0.1',
          userAgent: 'Browser E2E Test',
        },
      });

      // Generate cookie-based token
      const cookieToken = authService.generateJwtToken(
        user,
        session.id,
        true, // forCookie = true
      );

      // Get CSRF token (simulating what happens after browser login)
      const csrfResponse = await request(app.getHttpServer())
        .get('/auth/csrf')
        .set('Cookie', `auth_token=${cookieToken}`);

      if (csrfResponse.status !== 200) {
        throw new Error(`Failed to get CSRF token: ${csrfResponse.status}`);
      }

      const csrfToken = csrfResponse.body.token;
      const csrfCookie =
        getCookieFromResponse(csrfResponse, 'csrf_token') ?? '';

      const browserAuth: BrowserAuthContext = {
        sessionId: session.id,
        authCookie: `auth_token=${cookieToken}`,
        csrfToken,
        csrfCookie,
        refreshCSRF: async () => {
          // Function to refresh CSRF token when needed
          const refreshResponse = await request(app.getHttpServer())
            .get('/auth/csrf')
            .set('Cookie', `auth_token=${cookieToken}`);

          browserAuth.csrfToken = refreshResponse.body.token;
          browserAuth.csrfCookie =
            getCookieFromResponse(refreshResponse, 'csrf_token') ?? '';
        },
      };

      return browserAuth;
    };

    // Implement the mobile/API auth flow
    ctx.getMobileAuth = async (): Promise<MobileAuthContext> => {
      // Create a mobile/API session
      const session = await prismaService.session.create({
        data: {
          userId: user.id,
          token: `mobile-session-${Date.now()}`,
          isValid: true,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days for mobile
          ipAddress: '192.168.1.1',
          userAgent: 'Mobile E2E Test',
        },
      });

      // Generate API token
      const bearerToken = authService.generateJwtToken(
        user,
        session.id,
        false, // forCookie = false
      );

      return {
        sessionId: session.id,
        bearerToken,
      };
    };
  }, 30000);

  afterAll(async () => {
    // Cleanup: Delete all test user data
    if (ctx.user) {
      await prismaService.session.deleteMany({
        where: { userId: ctx.user.id },
      });

      await prismaService.user.delete({
        where: { id: ctx.user.id },
      });
    }

    await app.close();
  }, 10000);

  // Browser-based Authentication tests
  describe('Browser Authentication Flow', () => {
    beforeAll(async () => {
      // Get browser auth context for this test suite
      ctx.browserAuth = await ctx.getBrowserAuth();
      console.log('Browser auth setup complete:', !!ctx.browserAuth);
    });

    it('should allow access to protected routes with valid cookie auth', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Cookie', ctx.browserAuth?.authCookie ?? '');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', ctx.user.id);
      expect(response.body).toHaveProperty('email', ctx.user.email);
    });

    it('should update session lastActiveAt timestamp on access', async () => {
      // Get the current timestamp
      const beforeAccess = await prismaService.session.findUnique({
        where: { id: ctx.browserAuth?.sessionId },
        select: { lastActiveAt: true },
      });

      // Wait a moment to ensure timestamp will be different
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Access a protected route
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Cookie', ctx.browserAuth?.authCookie ?? '');

      // Check if timestamp updated
      const afterAccess = await prismaService.session.findUnique({
        where: { id: ctx.browserAuth?.sessionId },
        select: { lastActiveAt: true },
      });

      expect(afterAccess?.lastActiveAt).not.toEqual(beforeAccess?.lastActiveAt);
      expect(afterAccess?.lastActiveAt).toBeInstanceOf(Date);
      expect(afterAccess?.lastActiveAt.getTime()).toBeGreaterThan(
        beforeAccess?.lastActiveAt.getTime() ?? 0,
      );
    });

    describe('CSRF Protection', () => {
      it('should require CSRF token for non-GET requests', async () => {
        // Try a POST request with auth_token cookie but without CSRF token
        const noTokenResponse = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Cookie', [
            ctx.browserAuth?.authCookie ?? '',
            ctx.browserAuth?.csrfCookie ?? '',
          ]);

        // Should fail with 403 Forbidden
        expect(noTokenResponse.status).toBe(403);

        // Try with CSRF token
        const withTokenResponse = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Cookie', [
            ctx.browserAuth?.authCookie ?? '',
            ctx.browserAuth?.csrfCookie ?? '',
          ])
          .set('X-CSRF-Token', ctx.browserAuth?.csrfToken ?? '');

        // Should succeed
        expect(withTokenResponse.status).toBe(200);
      });

      it('should block requests with auth cookie and invalid CSRF token', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Cookie', [
            ctx.browserAuth?.authCookie ?? '',
            ctx.browserAuth?.csrfCookie ?? '',
          ])
          .set('X-CSRF-Token', 'invalid-token');

        expect(response.status).toBe(403);
      });
    });

    describe('Session Management', () => {
      it('should list active sessions for the current user', async () => {
        // Ensure browserAuth exists
        if (!ctx.browserAuth) {
          throw new Error('Browser authentication context is not initialized');
        }

        const response = await request(app.getHttpServer())
          .get('/auth/sessions')
          .set('Cookie', ctx.browserAuth.authCookie);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(1);

        // Find our test session
        const foundSession = response.body.find(
          (s: any) => s.id === ctx.browserAuth?.sessionId,
        );
        expect(foundSession).toBeDefined();
      });

      it('should allow revoking a specific session', async () => {
        // Create an additional session
        const additionalSession = await prismaService.session.create({
          data: {
            userId: ctx.user.id,
            token: `additional-token-${Date.now()}`,
            isValid: true,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            ipAddress: '127.0.0.1',
            userAgent: 'E2E Additional Session',
          },
        });

        // Refresh CSRF tokens to ensure we have valid ones
        await ctx.browserAuth?.refreshCSRF();

        // Revoke the additional session
        const response = await request(app.getHttpServer())
          .delete(`/auth/sessions/${additionalSession.id}`)
          .set('Cookie', [
            ctx.browserAuth?.authCookie ?? '',
            ctx.browserAuth?.csrfCookie ?? '',
          ])
          .set('X-CSRF-Token', ctx.browserAuth?.csrfToken ?? '');

        expect(response.status).toBe(200);

        // Verify the session was invalidated
        const updatedSession = await prismaService.session.findUnique({
          where: { id: additionalSession.id },
        });

        expect(updatedSession?.isValid).toBe(false);
      });

      it("should prevent revoking another user's session", async () => {
        // Create another user
        const anotherUser = await prismaService.user.create({
          data: {
            email: `another-e2e-test-${Date.now()}@example.com`,
            name: 'Another E2E Test User',
            role: UserRole.USER,
          },
        });

        // Create a session for the other user
        const anotherSession = await prismaService.session.create({
          data: {
            userId: anotherUser.id,
            token: `another-test-token-${Date.now()}`,
            isValid: true,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            ipAddress: '127.0.0.1',
            userAgent: 'Another E2E Test Agent',
          },
        });

        // Refresh CSRF tokens
        await ctx.browserAuth?.refreshCSRF();

        // Try to revoke the other user's session
        const response = await request(app.getHttpServer())
          .delete(`/auth/sessions/${anotherSession.id}`)
          .set('Cookie', [
            ctx.browserAuth?.authCookie ?? '',
            ctx.browserAuth?.csrfCookie ?? '',
          ])
          .set('X-CSRF-Token', ctx.browserAuth?.csrfToken ?? '');

        // Should be unauthorized or forbidden
        expect(response.status).toBe(401);

        // Verify the session is still valid
        const updatedSession = await prismaService.session.findUnique({
          where: { id: anotherSession.id },
        });

        expect(updatedSession?.isValid).toBe(true);

        // Cleanup
        await prismaService.session.deleteMany({
          where: { userId: anotherUser.id },
        });

        await prismaService.user.delete({
          where: { id: anotherUser.id },
        });
      });
    });

    describe('Logout Flow', () => {
      it('should invalidate the current session on logout', async () => {
        // Create another session for logout testing
        const logoutBrowserAuth = await ctx.getBrowserAuth();

        // Perform logout
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Cookie', [
            logoutBrowserAuth.authCookie,
            logoutBrowserAuth.csrfCookie,
          ])
          .set('X-CSRF-Token', logoutBrowserAuth.csrfToken);

        expect(response.status).toBe(200);

        // Verify the session is invalidated
        const updatedSession = await prismaService.session.findUnique({
          where: { id: logoutBrowserAuth.sessionId },
        });

        expect(updatedSession?.isValid).toBe(false);

        // Try accessing a protected route with the invalidated token
        const protectedResponse = await request(app.getHttpServer())
          .get('/users/me')
          .set('Cookie', logoutBrowserAuth.authCookie);

        expect(protectedResponse.status).toBe(401);
      });

      it('should clear auth cookie on logout', async () => {
        // Create another session for cookie testing
        const cookieAuth = await ctx.getBrowserAuth();

        // Perform logout with cookie
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Cookie', [cookieAuth.authCookie, cookieAuth.csrfCookie])
          .set('X-CSRF-Token', cookieAuth.csrfToken);

        expect(response.status).toBe(200);

        // Check response cookies
        const cookies = response.headers['set-cookie'];
        expect(cookies).toBeDefined();

        // Find the auth_token cookie
        const authCookie = getCookieFromResponse(response, 'auth_token');
        expect(authCookie).toBeDefined();

        // Verify it's cleared (empty value, expired)
        expect(isCookieCleared(authCookie)).toBe(true);

        // Verify the session is invalidated
        const updatedSession = await prismaService.session.findUnique({
          where: { id: cookieAuth.sessionId },
        });

        expect(updatedSession?.isValid).toBe(false);
      });
    });

    describe('Token Refresh Flow', () => {
      it('should issue new access token when refreshing with valid token', async () => {
        // Create a fresh browser context for refresh
        const refreshAuth = await ctx.getBrowserAuth();

        // Request token refresh
        const refreshResponse = await request(app.getHttpServer())
          .post('/auth/refresh')
          .set('Cookie', [refreshAuth.authCookie, refreshAuth.csrfCookie])
          .set('X-CSRF-Token', refreshAuth.csrfToken);

        expect(refreshResponse.status).toBe(200);
        expect(refreshResponse.body).toHaveProperty('user');

        // Check for new auth cookie
        const newAuthCookie = getCookieFromResponse(
          refreshResponse,
          'auth_token',
        );
        expect(newAuthCookie).toBeDefined();
        expect(isCookieCleared(newAuthCookie)).toBe(false);
      });

      it('should reject refresh attempts with invalidated sessions', async () => {
        // Create a session that we'll invalidate
        const invalidatedAuth = await ctx.getBrowserAuth();

        // Invalidate the session
        await prismaService.session.update({
          where: { id: invalidatedAuth.sessionId },
          data: { isValid: false },
        });

        // Try to refresh with invalidated session
        const refreshResponse = await request(app.getHttpServer())
          .post('/auth/refresh')
          .set('Cookie', [
            invalidatedAuth.authCookie,
            invalidatedAuth.csrfCookie,
          ])
          .set('X-CSRF-Token', invalidatedAuth.csrfToken);

        expect(refreshResponse.status).toBe(401);
      });
    });
  });

  // API/Mobile Authentication tests
  describe('API Authentication Flow', () => {
    beforeAll(async () => {
      // Get mobile auth context for this test suite
      ctx.mobileAuth = await ctx.getMobileAuth();
    });

    it('should allow access to protected routes with valid Bearer token', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${ctx.mobileAuth?.bearerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', ctx.user.id);
      expect(response.body).toHaveProperty('email', ctx.user.email);
    });

    it('should reject access with invalid Bearer token', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
    });

    it('should not require CSRF token for API requests', async () => {
      // Test that a POST request with Bearer auth doesn't need CSRF
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${ctx.mobileAuth?.bearerToken}`);

      // Should not fail with 403 (CSRF error)
      expect(response.status).not.toBe(403);
    });

    describe('Token Security', () => {
      it('should reject tokens with tampered claims', async () => {
        // Generate a valid token
        const validParts = ctx.mobileAuth?.bearerToken.split('.') ?? [];
        const decodedPayload = JSON.parse(
          Buffer.from(validParts[1], 'base64').toString(),
        );

        // Tamper with the user ID
        decodedPayload.sub = 'fake-user-id';

        // Re-encode payload
        const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload))
          .toString('base64')
          .replace(/=/g, '')
          .replace(/\+/g, '-')
          .replace(/\//g, '_');

        // Construct tampered token (keep original header and signature)
        const tamperedToken = `${validParts[0]}.${tamperedPayload}.${validParts[2]}`;

        // Try using the tampered token
        const response = await request(app.getHttpServer())
          .get('/users/me')
          .set('Authorization', `Bearer ${tamperedToken}`);

        expect(response.status).toBe(401);
      });

      it('should reject expired tokens', async () => {
        // Create a token that's already expired
        const expiredToken = jwtService.sign(
          {
            sub: ctx.user.id,
            email: ctx.user.email,
            sessionId: ctx.mobileAuth?.sessionId,
            authType: 'bearer',
          },
          { expiresIn: '0s' }, // Expire immediately
        );

        // Wait a bit to ensure it's expired
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Try using the expired token
        const response = await request(app.getHttpServer())
          .get('/users/me')
          .set('Authorization', `Bearer ${expiredToken}`);

        expect(response.status).toBe(401);
      });

      it('should reject tokens with invalid signatures', async () => {
        // Corrupt the signature part
        const parts = ctx.mobileAuth?.bearerToken.split('.') ?? [];
        const invalidToken = `${parts[0]}.${parts[1]}.invalidSignature`;

        // Try using the token with invalid signature
        const response = await request(app.getHttpServer())
          .get('/users/me')
          .set('Authorization', `Bearer ${invalidToken}`);

        expect(response.status).toBe(401);
      });
    });
  });

  // Cross-authentication tests
  describe('Cross Authentication Security', () => {
    it('should detect and prevent using cookie token as Bearer token', async () => {
      // Get a browser auth context
      const browserAuth = await ctx.getBrowserAuth();

      // Extract token value from cookie (remove "auth_token=" prefix)
      const cookieTokenValue = browserAuth.authCookie.split('=')[1];

      // Try using a cookie token as a Bearer token
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${cookieTokenValue}`);

      // Should be rejected as cookie tokens can't be used as Bearer tokens
      expect(response.status).toBe(401);
    });

    it('should detect and prevent using Bearer token in a cookie', async () => {
      // Try to use a Bearer token in a cookie
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Cookie', `auth_token=${ctx.mobileAuth?.bearerToken}`);

      // Should be rejected as Bearer tokens can't be used in cookies
      expect(response.status).toBe(401);
    });

    it('should reject requests with conflicting authentication methods', async () => {
      // Try using both cookie and Bearer auth simultaneously
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Cookie', ctx.browserAuth?.authCookie ?? '')
        .set('Authorization', `Bearer ${ctx.mobileAuth?.bearerToken}`);

      // This is suspicious behavior and should be rejected
      expect(response.status).toBe(401);
    });
  });

  // Security Headers tests
  describe('Security Headers', () => {
    it('should set security-related headers on responses', async () => {
      const response = await request(app.getHttpServer()).get('/');

      // Check for common security headers
      expect(response.headers).toHaveProperty(
        'x-content-type-options',
        'nosniff',
      );
      expect(response.headers).toHaveProperty(
        'x-xss-protection',
        '1; mode=block',
      );

      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('strict-transport-security');
    });
  });

  // Request ID Tracing tests
  describe('Request ID Tracing', () => {
    it('should assign and return a request ID for all API responses', async () => {
      const response = await request(app.getHttpServer()).get('/');

      // Verify the response contains a request ID header
      expect(response.headers).toHaveProperty('x-request-id');

      // The request ID should be a non-empty string
      expect(typeof response.headers['x-request-id']).toBe('string');
      expect(response.headers['x-request-id'].length).toBeGreaterThan(0);
    });

    it('should use the client-provided request ID if present', async () => {
      const customRequestId = `test-req-id-${Date.now()}`;

      const response = await request(app.getHttpServer())
        .get('/')
        .set('X-Request-ID', customRequestId);

      // Verify the response returns our custom request ID
      expect(response.headers['x-request-id']).toBe(customRequestId);
    });
  });
});

/**
 * Helper function to extract a specific cookie from response headers
 */
function getCookieFromResponse(
  response: any,
  cookieName: string,
): string | null {
  const cookies = response.headers['set-cookie'];

  if (!cookies) {
    return null;
  }

  if (Array.isArray(cookies)) {
    const cookieString = cookies.find((c) => c.includes(`${cookieName}=`));
    return cookieString || null;
  }

  if (typeof cookies === 'string' && cookies.includes(`${cookieName}=`)) {
    return cookies;
  }

  return null;
}

/**
 * Helper function to check if a cookie is cleared (set to empty or expired)
 */
function isCookieCleared(cookieString: string | null): boolean {
  if (!cookieString) {
    return false;
  }

  return (
    cookieString.includes('=;') ||
    cookieString.includes('Expires=Thu, 01 Jan 1970') ||
    cookieString.includes('Max-Age=0')
  );
}
