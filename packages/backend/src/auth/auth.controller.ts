import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  Delete,
  Param,
  UnauthorizedException,
  Logger,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './services/auth.service';
import { AppConfig } from '@/config/configuration';
import { ApiBody, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OAuthUser } from './interfaces/oauth-user.interface';
import { MobileAuthDto } from './dto/mobile-auth.dto';
import { AuthCookieService } from './services/auth-cookie.service';
import { AuthEventType } from '@scaffold/types';
import { LoggingService } from '@/logging/services/logging.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private config: AppConfig,
    private prisma: PrismaService,
    private cookieService: AuthCookieService,
    private readonly loggingService: LoggingService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // This route initiates the Google OAuth flow
    // The guard triggers the authentication
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleCallback(@Req() req: Request, @Res() res: Response) {
    return this.handleOAuthCallback(req, res);
  }

  // Add more providers as needed
  // @Get('linkedin/callback')
  // @UseGuards(AuthGuard('linkedin'))
  // linkedinCallback(@Req() req, @Res() res: Response) {
  //   return this.handleOAuthCallback(req, res);
  // }

  private async handleOAuthCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as OAuthUser;
    this.cookieService.setCookie(res, user.accessToken);
    this.cookieService.setCsrfCookie(res);
    return res.redirect(`${this.config.auth.frontendUrl}/auth/success`);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      this.logger.log('Logout - User data:', req.user);

      const user = req.user as OAuthUser;

      if (user?.sessionId) {
        await this.authService.invalidateSession(user.sessionId);

        // Log logout event
        await this.loggingService.logSecurityEvent({
          level: 'info',
          userId: user.id,
          event: AuthEventType.LOGOUT,
          success: true,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          sessionId: user.sessionId,
          requestId: req.headers['x-request-id'] as string,
          details: {
            logoutMethod: 'user_initiated',
          },
        });
      }
    } catch (error) {
      this.logger.error('Error during logout:', error);
    }

    this.cookieService.clearCookie(res);
    return { success: true };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  async getSessions(@Req() req: Request) {
    const user = req.user as OAuthUser;

    return this.prisma.session.findMany({
      where: {
        userId: user.id,
        isValid: true,
      },
      select: {
        id: true,
        createdAt: true,
        lastActiveAt: true,
        ipAddress: true,
        userAgent: true,
      },
    });
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  async invalidateSession(@Param('id') id: string, @Req() req: Request) {
    // Verify session belongs to current user
    const session = await this.prisma.session.findUnique({
      where: { id },
      select: { userId: true },
    });

    const user = req.user as OAuthUser;

    if (!session || session.userId !== user.id) {
      throw new UnauthorizedException('Session not found or not owned by user');
    }

    await this.authService.invalidateSession(id);

    await this.loggingService.logSecurityEvent({
      level: 'info',
      userId: user.id,
      event: AuthEventType.SESSION_EXPIRED,
      success: true,
      sessionId: id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string,
      details: {
        terminationType: 'user_terminated',
      },
    });

    return { success: true };
  }

  @Delete('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  async invalidateAllSessions(@Req() req: Request) {
    const user = req.user as OAuthUser;

    // Log this security action
    await this.loggingService.logSecurityEvent({
      level: 'info',
      userId: user.id,
      event: AuthEventType.SESSION_EXPIRED,
      success: true,
      sessionId: user.sessionId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string,
      details: {
        terminationType: 'user_terminated_all',
      },
    });

    // Invalidate all user sessions except current one
    await this.authService.invalidateAllUserSessions(user.id);
    return { success: true };
  }

  @Post('token')
  @ApiOperation({ summary: 'Get access token for mobile clients' })
  @ApiBody({ type: MobileAuthDto })
  async getToken(
    @Body() authData: MobileAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokenData = await this.authService.verifyMobileToken(
      authData.provider,
      authData.token,
      authData.deviceInfo,
    );

    const csrfToken = this.cookieService.setCsrfCookie(res);

    return {
      user: tokenData.user,
      access_token: tokenData.accessToken,
      csrf_token: csrfToken,
    };
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = req.user as OAuthUser;

    if (!user?.id || !user?.sessionId) {
      this.cookieService.clearCookie(res);
      throw new UnauthorizedException('Invalid session');
    }

    try {
      const result = await this.authService.refreshAccessToken(
        user.id,
        user.sessionId,
        req.ip,
        req.headers['user-agent'],
      );

      // Set the new token in a cookie
      this.cookieService.setCookie(res, result.accessToken);

      return { user: result.user };
    } catch (error) {
      // On token refresh failure, clear cookies and force re-login
      this.cookieService.clearCookie(res);
      throw new UnauthorizedException('Session expired, please login again');
    }
  }

  @Get('csrf')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a new CSRF token' })
  getCsrfToken(@Res({ passthrough: true }) res: Response) {
    const token = this.cookieService.setCsrfCookie(res);
    return { token };
  }
}
