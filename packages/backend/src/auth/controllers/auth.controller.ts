import {
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
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { AppConfig } from '@/config/configuration';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OAuthUser } from '../interfaces/oauth-user.interface';
import { AuthCookieService } from '../services/auth-cookie.service';
import { AuthEventType, UserSession } from '@scaffold/types';
import { LoggingService } from '@/logging/services/logging.service';
import { UserSessionResponseDto } from '../dto/auth.dto';

@ApiTags('Authentication')
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
  @ApiOperation({
    summary: 'Initiate Google OAuth flow',
    description: 'Redirects to Google OAuth consent screen',
  })
  @ApiResponse({ status: 302, description: 'Redirect to Google OAuth' })
  googleLogin() {
    // This route initiates the Google OAuth flow
    // The guard triggers the authentication
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Google OAuth callback',
    description: 'Handles Google OAuth callback and redirects to frontend',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirect to frontend with auth success',
  })
  googleCallback(@Req() req: Request, @Res() res: Response) {
    return this.handleOAuthCallback(req, res);
  }

  private async handleOAuthCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as OAuthUser;
    this.cookieService.setCookie(res, user.accessToken);
    this.cookieService.setCsrfCookie(res);
    return res.redirect(`${this.config.auth.frontendUrl}/auth/success`);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Logout user',
    description:
      'Invalidates current session and clears authentication cookies',
  })
  @ApiResponse({ status: 204, description: 'Successfully logged out' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const user = req.user as OAuthUser;

    if (user?.sessionId) {
      await this.authService.invalidateSession(user.sessionId);

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

    this.cookieService.clearCookie(res);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get user sessions',
    description: 'Retrieve all active sessions for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'User sessions retrieved successfully',
    type: UserSessionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSessions(@Req() req: Request): Promise<UserSession[]> {
    const user = req.user as OAuthUser;

    const sessions = await this.prisma.session.findMany({
      where: {
        userId: user.id,
        isValid: true,
      },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        lastActiveAt: true,
        ipAddress: true,
        userAgent: true,
      },
      orderBy: {
        lastActiveAt: 'desc',
      },
    });

    // Transform to match UserSession interface
    return sessions.map((session) => ({
      ...session,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      lastActiveAt: session.lastActiveAt.toISOString(),
    }));
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT')
  @ApiParam({ name: 'id', description: 'Session ID to invalidate' })
  @ApiOperation({
    summary: 'Invalidate specific session',
    description:
      'Invalidate a specific session by ID. User can only invalidate their own sessions.',
  })
  @ApiResponse({ status: 204, description: 'Session invalidated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Session not found or not owned by user',
  })
  async invalidateSession(
    @Param('id') sessionId: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as OAuthUser;

    // Verify session belongs to current user
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!session || session.userId !== user.id) {
      throw new UnauthorizedException('Session not found or not owned by user');
    }

    await this.authService.invalidateSession(sessionId);

    await this.loggingService.logSecurityEvent({
      level: 'info',
      userId: user.id,
      event: AuthEventType.SESSION_EXPIRED,
      success: true,
      sessionId: sessionId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string,
      details: {
        terminationType: 'user_terminated',
      },
    });
  }

  @Delete('sessions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Invalidate all sessions',
    description:
      'Invalidate all sessions for the current user except the current one',
  })
  @ApiResponse({
    status: 204,
    description: 'All sessions invalidated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async invalidateAllSessions(@Req() req: Request): Promise<void> {
    const user = req.user as OAuthUser;

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

    await this.authService.invalidateAllUserSessions(user.id);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Refresh the current access token via cookie update',
  })
  @ApiResponse({ status: 204, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid session' })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const user = req.user as OAuthUser;

    if (!user?.id || !user?.sessionId) {
      this.cookieService.clearCookie(res);
      throw new UnauthorizedException('Invalid session');
    }

    const result = await this.authService.refreshAccessToken(
      user.id,
      user.sessionId,
      req.ip,
      req.headers['user-agent'],
    );

    this.cookieService.setCookie(res, result.accessToken);
  }

  @Get('csrf')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get CSRF token for debugging',
    description:
      'Generate and return a new CSRF token (primarily for debugging purposes)',
  })
  @ApiResponse({
    status: 200,
    description: 'CSRF token generated',
    schema: { type: 'string', example: 'abc123def456' }, // Just a string response
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getCsrfToken(@Res({ passthrough: true }) res: Response): string {
    return this.cookieService.setCsrfCookie(res); // Return token directly
  }

  /**
   * SECURITY NOTE: Mobile token authentication endpoint (DISABLED)
   *
   * This endpoint is intended to provide authentication for mobile clients
   * by verifying tokens from OAuth providers. It has been disabled because:
   *
   * 1. It lacks proper authentication guards and security measures
   * 2. It would allow unauthenticated access to token verification
   *
   * To properly implement this endpoint, the following would be needed:
   * - MobileAppAuthGuard to verify app-specific signatures/API keys
   * - Enhanced rate limiting specific to authentication attempts
   * - Device fingerprinting and verification
   * - Proper logging of authentication attempts
   * - Token validation with enhanced security checks
   *
   * IMPLEMENTATION STATUS: Disabled/Example only - Do not enable in production
   * without implementing the security measures above.
   */
  // @Post('token')
  // @ApiOperation({ summary: 'Get access token for mobile clients' })
  // @ApiBody({ type: MobileAuthDto })
  // async getToken(
  //   @Body() authData: MobileAuthDto,
  //   @Res({ passthrough: true }) res: Response,
  // ) {
  //   const tokenData = await this.authService.verifyMobileToken(
  //     authData.provider,
  //     authData.token,
  //     authData.deviceInfo,
  //   );
  //   const csrfToken = this.cookieService.setCsrfCookie(res);
  //   return {
  //     user: tokenData.user,
  //     access_token: tokenData.accessToken,
  //     csrf_token: csrfToken,
  //   };
  // }
}
