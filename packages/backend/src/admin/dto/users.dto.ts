import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AdminUser, OffsetPaginatedResponse, UserRole } from '@scaffold/types';

// Input DTOs
export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'New user role',
    example: 'ADMIN',
    enum: UserRole,
  })
  @IsEnum(UserRole, { message: 'Role must be USER or ADMIN' })
  role: UserRole;
}

// Response DTOs
export class AdminUserResponseDto implements AdminUser {
  @ApiProperty({ example: 'user-123' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'John Doe', nullable: true })
  name: string | null;

  @ApiProperty({ example: 'USER', enum: UserRole })
  role: UserRole;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z', nullable: true })
  lastLoginAt: string | null;

  @ApiProperty({ example: 2, description: 'Number of active sessions' })
  sessionCount: number;
}

export class AdminUsersResponseDto
  implements OffsetPaginatedResponse<AdminUser>
{
  @ApiProperty({
    type: [AdminUserResponseDto],
    description: 'Array of admin users',
  })
  data: AdminUserResponseDto[];

  @ApiProperty({
    example: {
      type: 'offset',
      total: 25,
      page: 1,
      limit: 20,
      pages: 2,
    },
    description: 'Pagination information',
  })
  pagination: {
    type: 'offset';
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export class UpdateUserRoleResponseDto {
  @ApiProperty({ example: 'user-123' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'ADMIN', enum: UserRole })
  role: UserRole;
}
