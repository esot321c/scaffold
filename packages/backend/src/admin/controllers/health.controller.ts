import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AdminGuard } from '@/admin/guards/admin.guard';
import { SystemHealthService } from '@/monitoring/services/system-health.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/services/redis.service';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { SystemHealth, ServiceHealth } from '@scaffold/types';
import { SystemHealthResponseDto } from '../dto/health.dto';

@ApiTags('admin')
@Controller('admin/health')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT')
export class HealthController {
  constructor(
    private systemHealthService: SystemHealthService,
    private prismaService: PrismaService,
    private redisService: RedisService,
    @InjectConnection() private mongoConnection: Connection,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get comprehensive system health status',
    description:
      'Returns health status for all system components including database, Redis, MongoDB, and system resources',
  })
  @ApiResponse({
    status: 200,
    description: 'System health status retrieved successfully',
    type: SystemHealthResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'One or more system components are unhealthy',
  })
  async getSystemHealth(): Promise<SystemHealth> {
    const now = new Date().toISOString();

    // Check database health
    const databaseHealth = await this.checkDatabaseHealth();

    // Check Redis health
    const redisHealth = await this.checkRedisHealth();

    // Check MongoDB health
    const mongoHealth = await this.checkMongoHealth();

    // Get system metrics
    const systemMetrics = await this.getSystemMetrics();

    return {
      database: {
        ...databaseHealth,
        lastChecked: now,
      },
      redis: {
        ...redisHealth,
        lastChecked: now,
      },
      mongodb: {
        ...mongoHealth,
        lastChecked: now,
      },
      system: {
        ...systemMetrics,
        lastChecked: now,
      },
    };
  }

  private async checkDatabaseHealth(): Promise<
    Omit<ServiceHealth, 'lastChecked'>
  > {
    const startTime = Date.now();

    try {
      // Simple health check query
      await this.prismaService.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        status: responseTime > 1000 ? 'degraded' : 'healthy',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
      };
    }
  }

  private async checkRedisHealth(): Promise<
    Omit<ServiceHealth, 'lastChecked'>
  > {
    const startTime = Date.now();

    try {
      const redis = this.redisService.getConnection();
      await redis.ping();
      const responseTime = Date.now() - startTime;

      return {
        status: responseTime > 500 ? 'degraded' : 'healthy',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
      };
    }
  }

  private async checkMongoHealth(): Promise<
    Omit<ServiceHealth, 'lastChecked'>
  > {
    const startTime = Date.now();

    try {
      // Check if MongoDB is connected
      if (this.mongoConnection.readyState !== 1) {
        return {
          status: 'down',
          responseTime: Date.now() - startTime,
        };
      }

      // Simple ping to test connection
      await this.mongoConnection.db?.admin().ping();
      const responseTime = Date.now() - startTime;

      return {
        status: responseTime > 500 ? 'degraded' : 'healthy',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
      };
    }
  }

  private async getSystemMetrics() {
    try {
      return await this.systemHealthService.getCurrentMetrics();
    } catch (error) {
      // Return safe defaults if metrics collection fails
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
      };
    }
  }
}
