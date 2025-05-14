import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, DeviceInfoDto } from '../dto/mobile-auth.dto';
import * as crypto from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggingService } from '@/logging/services/logging.service';
import { AuthEventType } from '@scaffold/types';

interface OAuthUserData {
  provider: string;
  providerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  idToken?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private loggingService: LoggingService,
  ) {}

  async handleOAuthLogin(
    userData: OAuthUserData,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Step 1: Find or create user
    let user = await this.findOrCreateUser(userData);

    // Step 2: Update or create account information
    await this.upsertAccount(user.id, userData);

    // Step 3: Create a new session
    const session = await this.createSession(user.id, ipAddress, userAgent);

    // Generate device ID from user agent and IP if available
    if (ipAddress && userAgent) {
      const deviceId = this.generateDeviceIdFromRequest(ipAddress, userAgent);
      await this.prisma.device.upsert({
        where: {
          userId_deviceId: {
            userId: user.id,
            deviceId: deviceId,
          },
        },
        update: {
          lastUsedAt: new Date(),
        },
        create: {
          userId: user.id,
          deviceId: deviceId,
          platform: this.detectPlatformFromUserAgent(userAgent),
          name: this.detectDeviceNameFromUserAgent(userAgent),
        },
      });
    }

    // Step 4: Generate JWT with session token
    const accessToken = this.generateJwtToken(user, session.id);

    // Log successful login
    await this.loggingService.logSecurityEvent({
      level: 'info',
      userId: user.id,
      event: AuthEventType.LOGIN,
      success: true,
      ipAddress,
      userAgent,
      sessionId: session.id,
      // No requestId since we don't have req object
      details: {
        loginMethod: 'oauth',
        provider: userData.provider,
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      accessToken,
      sessionId: session.id,
    };
  }

  // Method for handling token-based auth for mobile if an Android or iOS app is added
  async handleTokenAuth(
    userData: OAuthUserData,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.findOrCreateUser(userData);
    await this.upsertAccount(user.id, userData);
    const session = await this.createSession(user.id, ipAddress, userAgent);
    const accessToken = this.generateJwtToken(user, session.id);

    // Log successful mobile login
    await this.loggingService.logSecurityEvent({
      level: 'info',
      userId: user.id,
      event: AuthEventType.LOGIN,
      success: true,
      ipAddress,
      userAgent,
      sessionId: session.id,
      // No requestId since we don't have req object
      details: {
        ipAddress,
        userAgent,
        loginMethod: 'token', // or mobile?
        provider: userData.provider,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      accessToken,
      sessionId: session.id,
    };
  }

  async verifyMobileToken(
    provider: AuthProvider,
    token: string,
    deviceInfo: DeviceInfoDto,
  ) {
    let userData: OAuthUserData;

    switch (provider) {
      case AuthProvider.GOOGLE:
        userData = await this.verifyGoogleToken(token);
        break;
      // case AuthProvider.LINKEDIN:
      //   userData = await this.verifyLinkedinToken(token);
      //   break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    return this.handleTokenAuth(
      userData,
      deviceInfo.deviceId,
      `${deviceInfo.platform} ${deviceInfo.osVersion}`,
    );
  }

  private async verifyGoogleToken(token: string): Promise<OAuthUserData> {
    // This would use the Google Auth Library
    // Example implementation structure:
    // const { OAuth2Client } = require('google-auth-library');
    // const client = new OAuth2Client(this.config.auth.google.clientId);
    // const ticket = await client.verifyIdToken({
    //   idToken: token,
    //   audience: this.config.auth.google.clientId,
    // });
    // const payload = ticket.getPayload();

    // For now, throw error as this needs actual implementation
    throw new Error('Token verification not implemented');
  }

  async refreshAccessToken(
    userId: string,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Validate the session is still active
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || !session.isValid || new Date() > session.expiresAt) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    // Update session last active time
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { lastActiveAt: new Date() },
    });

    // Generate new JWT
    const accessToken = this.generateJwtToken(session.user, sessionId);

    // Log token refresh with the information we have
    await this.loggingService.logSecurityEvent({
      level: 'info',
      userId,
      event: AuthEventType.TOKEN_REFRESH,
      success: true,
      ipAddress,
      userAgent,
      sessionId,
      details: {
        tokenType: 'access',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: session.user,
      accessToken,
    };
  }

  private async findOrCreateUser(userData: OAuthUserData) {
    // Try to find existing user by email
    let user = await this.prisma.user.findUnique({
      where: { email: userData.email },
    });

    // If user doesn't exist, create a new one
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: userData.email,
          name:
            userData.firstName && userData.lastName
              ? `${userData.firstName} ${userData.lastName}`
              : undefined,
        },
      });
    }

    return user;
  }

  private async upsertAccount(userId: string, userData: OAuthUserData) {
    // Calculate expiration if provided
    const expiresAt = userData.expiresIn
      ? new Date(Date.now() + userData.expiresIn * 1000)
      : null;

    // Update or create account
    return this.prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: userData.provider,
          providerAccountId: userData.providerId,
        },
      },
      update: {
        accessToken: userData.accessToken,
        refreshToken: userData.refreshToken,
        expiresAt,
        idToken: userData.idToken,
      },
      create: {
        userId,
        provider: userData.provider,
        providerAccountId: userData.providerId,
        accessToken: userData.accessToken,
        refreshToken: userData.refreshToken,
        expiresAt,
        idToken: userData.idToken,
      },
    });
  }

  async createSession(userId: string, ipAddress?: string, userAgent?: string) {
    // Calculate expiration (1 week from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // If we have IP and user agent, check for existing valid sessions from the same client
    if (ipAddress && userAgent) {
      const deviceId = this.generateDeviceIdFromRequest(ipAddress, userAgent);
      const existingSession = await this.prisma.session.findFirst({
        where: {
          userId,
          ipAddress,
          userAgent,
          isValid: true,
          expiresAt: {
            gt: new Date(), // Not expired
          },
        },
      });

      // If we found an active session, update it and return
      if (existingSession) {
        return this.prisma.session.update({
          where: { id: existingSession.id },
          data: {
            lastActiveAt: new Date(),
            // Extend expiration time
            expiresAt,
          },
        });
      }
    }

    // Otherwise create new session
    return this.prisma.session.create({
      data: {
        userId,
        token: this.generateSessionToken(),
        expiresAt,
        ipAddress,
        userAgent,
      },
    });
  }

  private generateSessionToken(): string {
    return crypto.randomUUID();
  }

  generateJwtToken(user: any, sessionId: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      sessionId,
    };

    return this.jwtService.sign(payload);
  }

  async validateSession(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || !session.isValid || new Date() > session.expiresAt) {
      return null;
    }

    // Update last active time
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { lastActiveAt: new Date() },
    });

    return session;
  }

  async invalidateSession(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isValid: false },
    });

    // Log session invalidation if we know the user
    if (session?.userId) {
      await this.loggingService.logSecurityEvent({
        level: 'info',
        userId: session.userId,
        event: AuthEventType.SESSION_TERMINATED,
        success: true,
        sessionId,
        details: {
          terminationType: 'explicit_invalidation',
        },
      });
    }

    return { success: true };
  }

  async invalidateAllUserSessions(userId: string, currentSessionId?: string) {
    await this.prisma.session.updateMany({
      where: {
        userId,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
      data: { isValid: false },
    });

    await this.loggingService.logSecurityEvent({
      level: 'info',
      userId,
      event: AuthEventType.ALL_SESSIONS_TERMINATED,
      success: true,
      details: {
        exceptSessionId: currentSessionId ?? null,
        reason: 'user_initiated',
      },
    });

    return { success: true };
  }

  verifyToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      return null;
    }
  }

  async getCurrentUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
  }

  private generateDeviceIdFromRequest(
    ipAddress: string,
    userAgent: string,
  ): string {
    // Create a deterministic but anonymized device ID
    const hash = crypto.createHash('sha256');
    hash.update(`${ipAddress}:${userAgent}`);
    return hash.digest('hex');
  }

  private detectPlatformFromUserAgent(userAgent: string): string {
    if (/windows/i.test(userAgent)) return 'Windows';
    if (/macintosh/i.test(userAgent)) return 'macOS';
    if (/android/i.test(userAgent)) return 'Android';
    if (/iphone|ipad/i.test(userAgent)) return 'iOS';
    if (/linux/i.test(userAgent)) return 'Linux';
    return 'Unknown';
  }

  private detectDeviceNameFromUserAgent(userAgent: string): string {
    // Extract browser and OS info for a friendly name
    const platform = this.detectPlatformFromUserAgent(userAgent);
    let browser = 'Browser';

    if (/chrome/i.test(userAgent) && !/edge|opr/i.test(userAgent))
      browser = 'Chrome';
    else if (/firefox/i.test(userAgent)) browser = 'Firefox';
    else if (/safari/i.test(userAgent) && !/chrome|edge/i.test(userAgent))
      browser = 'Safari';
    else if (/edge/i.test(userAgent)) browser = 'Edge';

    return `${platform} ${browser}`;
  }
}
