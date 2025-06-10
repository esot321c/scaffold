import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class InvalidateSessionDto {
  @ApiProperty({
    description: 'Session ID to invalidate',
    example: 'session-123-456-789',
  })
  @IsString({ message: 'Session ID must be a string' })
  @IsNotEmpty({ message: 'Session ID is required' })
  @IsUUID(4, { message: 'Session ID must be a valid UUID' })
  sessionId: string;
}

export class UserSessionResponseDto {
  @ApiProperty({ example: 'session-123' })
  id: string;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2024-01-20T10:30:00.000Z' })
  expiresAt: string;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  lastActiveAt: string;

  @ApiProperty({ example: '192.168.1.1', nullable: true })
  ipAddress: string | null;

  @ApiProperty({ example: 'Mozilla/5.0', nullable: true })
  userAgent: string | null;
}
