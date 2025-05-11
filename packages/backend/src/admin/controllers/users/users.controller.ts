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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LoggingService } from '@/logging/services/logging/logging.service';
import { AdminUser, PaginatedResponse } from '@scaffold/types';
import { AdminGuard } from '@/admin/guards/admin/admin.guard';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { UserRole } from '@/generated/prisma';
import { PrismaService } from '@/prisma/prisma.service';

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
  async getAllUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<PaginatedResponse<AdminUser>> {
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalUsers = await this.prisma.user.count();

    // Find users with pagination
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
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
    });

    // Get all user IDs
    const userIds = users.map((user) => user.id);

    // Get last login for each user using the optimized method
    const lastLoginMap = await this.loggingService.getLastLoginByUsers(userIds);

    // Transform the data into the expected format with ISO string dates
    const formattedUsers: AdminUser[] = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'USER' | 'ADMIN' | 'SUPER_ADMIN', // Cast to shared type enum
      createdAt: user.createdAt.toISOString(), // Convert Date to ISO string
      lastLoginAt: lastLoginMap.get(user.id)
        ? lastLoginMap.get(user.id)!.toISOString()
        : null,
      sessionCount: user._count.sessions,
    }));

    // Return with pagination info using the shared type
    return {
      data: formattedUsers,
      pagination: {
        total: totalUsers,
        page,
        limit,
        pages: Math.ceil(totalUsers / limit),
      },
    };
  }

  @Put(':id/role')
  @ApiOperation({ summary: 'Update user role' })
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
