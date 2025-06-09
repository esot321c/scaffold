import { ApiProperty } from '@nestjs/swagger';
import { SystemHealth, ServiceHealth } from '@scaffold/types';

export class SystemHealthResponseDto implements SystemHealth {
  @ApiProperty({
    description: 'Database connection health status',
    example: {
      status: 'healthy',
      responseTime: 45,
      lastChecked: '2024-01-15T10:30:00.000Z',
    },
  })
  database: ServiceHealth;

  @ApiProperty({
    description: 'Redis connection health status',
    example: {
      status: 'healthy',
      responseTime: 12,
      lastChecked: '2024-01-15T10:30:00.000Z',
    },
  })
  redis: ServiceHealth;

  @ApiProperty({
    description: 'MongoDB connection health status',
    example: {
      status: 'healthy',
      responseTime: 28,
      lastChecked: '2024-01-15T10:30:00.000Z',
    },
  })
  mongodb: ServiceHealth;

  @ApiProperty({
    description: 'System resource usage metrics',
    example: {
      cpuUsage: 45.2,
      memoryUsage: 68.1,
      diskUsage: 23.7,
      lastChecked: '2024-01-15T10:30:00.000Z',
    },
  })
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    lastChecked: string;
  };
}
