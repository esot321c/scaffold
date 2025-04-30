import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';
import { AppConfig } from 'src/config/configuration';
import { Request } from 'express';
import {
  ActivityLogService,
  AuthEventType,
} from '../services/activity-log.service';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: AppConfig,
    private authService: AuthService,
    private activityLogService: ActivityLogService,
    private prisma: PrismaService,
  ) {
    super({
      clientID: configService.auth.google.clientId,
      clientSecret: configService.auth.google.clientSecret,
      callbackURL: `${configService.baseUrl.url}/auth/google/callback`,
      scope: ['email', 'profile'],
      passReqToCallback: true, // This allows us to access the request
    });
  }

  async validate(
    request: Request,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    try {
      const { id, name, emails } = profile;

      const result = await this.authService.handleOAuthLogin(
        {
          provider: 'google',
          providerId: id,
          email: emails[0].value,
          firstName: name.givenName,
          lastName: name.familyName,
          accessToken,
          refreshToken,
          expiresIn: 3600, // Default to 1 hour if Google doesn't provide expiry
          idToken: profile._json.id_token,
        },
        request.ip,
        request.headers['user-agent'],
      );

      done(null, result);
    } catch (error) {
      const errorDetails = {
        message: error.message,
        stack: error.stack,
        code: error.code ?? 'unknown',
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      };

      // Log failed login attempts
      if (profile?.emails?.length > 0) {
        try {
          const user = await this.prisma.user.findUnique({
            where: { email: profile.emails[0].value },
          });

          if (user) {
            await this.activityLogService.logActivity(
              user.id,
              AuthEventType.FAILED_LOGIN,
              false,
              {
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'],
                details: {
                  provider: 'google',
                  error: errorDetails,
                  profileData: {
                    id: profile.id,
                    email: profile.emails[0].value,
                    name: profile.displayName,
                  },
                },
              },
            );
          } else {
            // Log attempt for non-existent user
            console.warn(
              `Failed login attempt for non-existent user: ${profile.emails[0].value}`,
            );
          }
        } catch (dbError) {
          console.error('Error during failed login logging:', dbError);
        }
      }

      done(error, undefined);
    }
  }
}
