import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from 'src/config/configuration';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ScheduleModule } from '@nestjs/schedule';
import { DeviceService } from './services/device/device.service';
import { TokenRotationService } from './services/token-rotation/token-rotation.service';
import { AuthService } from './services/auth/auth.service';
import { AuthCookieService } from './services/auth-cookie/auth-cookie.service';

@Module({
  imports: [
    PassportModule,
    PrismaModule,
    JwtModule.registerAsync({
      useFactory: (config: AppConfig) => ({
        secret: config.auth.jwtSecret,
        signOptions: { expiresIn: '7d' },
      }),
      inject: [AppConfig],
    }),
    ScheduleModule.forRoot(), // For token rotation cron job
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleStrategy,
    JwtStrategy,
    AuthCookieService,
    TokenRotationService,
    DeviceService,
  ],
  exports: [AuthService, AuthCookieService, DeviceService],
})
export class AuthModule {}
