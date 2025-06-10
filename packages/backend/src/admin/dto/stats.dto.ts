import { ApiProperty } from '@nestjs/swagger';
import { AdminStats } from '@scaffold/types';

export class AdminStatsResponseDto implements AdminStats {
  @ApiProperty({
    example: 1250,
    description: 'Total number of registered users',
  })
  totalUsers: number;

  @ApiProperty({
    example: 42,
    description:
      'Number of unique users who logged in within the last 24 hours',
  })
  activeUsers24h: number;

  @ApiProperty({
    example: 3,
    description: 'Number of failed login attempts in the last 24 hours',
  })
  failedLogins24h: number;

  @ApiProperty({
    example: 156,
    description: 'Number of currently active sessions',
  })
  totalSessions: number;
}
