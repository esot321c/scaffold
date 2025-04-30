import {
  Controller,
  Get,
  Put,
  Param,
  UseGuards,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin/admin.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '../../generated/prisma';

@ApiTags('admin')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT')
export class AdminUsersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users with basic stats' })
  async getAllUsers() {
    // Find all users with session count and last login
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
        // Get last login from auth activities
        authActivities: {
          where: {
            event: 'login',
            successful: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform the data into the expected format
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.authActivities[0]?.createdAt || null,
      sessionCount: user._count.sessions,
    }));
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
