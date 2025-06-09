import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AdminGuard } from '@/admin/guards/admin.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RateLimiterService } from '../services/rate-limiter.service';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { User } from '@/generated/prisma';

class UpdateRateLimitsDto {
  auth?: number;
  admin?: number;
  api?: number;
}

@ApiTags('Admin')
@Controller('admin/rate-limits')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT')
export class RateLimitController {
  constructor(private rateLimiterService: RateLimiterService) {}

  @Get()
  @ApiOperation({ summary: 'Get current rate limits' })
  async getRateLimits() {
    return await this.rateLimiterService.getRateLimits();
  }

  @Put()
  @ApiOperation({ summary: 'Update rate limits' })
  async updateRateLimits(
    @Body() limits: UpdateRateLimitsDto,
    @CurrentUser() user: User,
  ) {
    await this.rateLimiterService.updateRateLimits(limits, user.id);
    return await this.rateLimiterService.getRateLimits();
  }
}
