import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthService } from './auth.service';
import { LoggingService } from '@/logging/services/logging.service';
import { AuthEventType } from '@scaffold/types';

@Injectable()
export class TokenRotationService {
  private readonly logger = new Logger(TokenRotationService.name);

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private readonly loggingService: LoggingService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async rotateExpiredSessions() {
    this.logger.log('Running scheduled token rotation');

    // Find sessions that are nearing expiration but still valid
    const nearingExpiration = new Date();
    nearingExpiration.setHours(nearingExpiration.getHours() + 24); // within 24 hours of expiration

    const sessions = await this.prisma.session.findMany({
      where: {
        isValid: true,
        expiresAt: {
          lte: nearingExpiration,
        },
      },
      include: {
        user: true,
      },
    });

    this.logger.log(`Found ${sessions.length} sessions to rotate`);

    for (const session of sessions) {
      try {
        // Create a new session
        const newSession = await this.authService.createSession(
          session.userId,
          session.ipAddress ?? undefined,
          session.userAgent ?? undefined,
        );

        // Invalidate old session
        await this.authService.invalidateSession(session.id);

        await this.loggingService.logSecurityEvent({
          level: 'info',
          userId: session.userId,
          event: AuthEventType.TOKEN_REFRESH,
          success: true,
          ipAddress: session.ipAddress ?? undefined,
          userAgent: session.userAgent ?? undefined,
          sessionId: newSession.id,
          details: {
            previousSessionId: session.id,
            rotationType: 'automatic',
            reason: 'expiration_prevention',
          },
        });

        this.logger.debug(`Rotated session for user ${session.userId}`);
      } catch (error) {
        this.logger.error(
          `Failed to rotate session: ${error.message}`,
          error.stack,
        );
      }
    }
  }
}
