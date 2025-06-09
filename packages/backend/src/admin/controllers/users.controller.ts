import {
  Controller,
  Get,
  Put,
  Param,
  UseGuards,
  Body,
  Query,
  BadRequestException,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { LoggingService } from '@/logging/services/logging.service';
import { AdminGuard } from '@/admin/guards/admin.guard';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { PrismaService } from '@/prisma/prisma.service';
import { AdminUser, OffsetPaginatedResponse, UserRole } from '@scaffold/types';
import {
  AdminUsersResponseDto,
  UpdateUserRoleResponseDto,
} from '../dto/users.dto';

@ApiTags('admin')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT')
export class AdminUsersController {
  constructor(
    private prisma: PrismaService,
    private loggingService: LoggingService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all users with basic stats' })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    type: AdminUsersResponseDto,
  })
  async getAllUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<OffsetPaginatedResponse<AdminUser>> {
    const skip = (page - 1) * limit;

    // Get total count and users with session count in parallel
    const [totalUsers, users] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              sessions: {
                where: {
                  isValid: true,
                  expiresAt: {
                    gt: new Date(),
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
    ]);

    // Transform to AdminUser format
    const formattedUsers: AdminUser[] = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole, // Type assertion for enum
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      sessionCount: user._count.sessions,
    }));

    return {
      data: formattedUsers,
      pagination: {
        type: 'offset',
        total: totalUsers,
        page,
        limit,
        pages: Math.ceil(totalUsers / limit),
      },
    };
  }

  @Put(':id/role')
  @ApiOperation({ summary: 'Update user role' })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully',
    type: UpdateUserRoleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid role or cannot change super admin role',
  })
  async updateUserRole(
    @Param('id') id: string,
    @Body() data: { role: UserRole },
  ) {
    // Don't allow changing SUPER_ADMIN users
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Cannot change super admin role');
    }

    // Only allow changing to USER or ADMIN roles
    if (data.role !== UserRole.USER && data.role !== UserRole.ADMIN) {
      throw new BadRequestException('Invalid role');
    }

    return this.prisma.user.update({
      where: { id },
      data: { role: data.role },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });
  }
}
