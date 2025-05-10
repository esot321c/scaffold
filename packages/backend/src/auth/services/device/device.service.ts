import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { DeviceInfoDto } from '../../dto/mobile-auth.dto';

@Injectable()
export class DeviceService {
  constructor(private prisma: PrismaService) {}

  async registerDevice(userId: string, deviceInfo: DeviceInfoDto) {
    const deviceName =
      `${deviceInfo.platform} ${deviceInfo.osVersion || ''}`.trim();

    return this.prisma.device.upsert({
      where: {
        userId_deviceId: {
          userId,
          deviceId: deviceInfo.deviceId,
        },
      },
      update: {
        platform: deviceInfo.platform,
        lastUsedAt: new Date(),
      },
      create: {
        userId,
        deviceId: deviceInfo.deviceId,
        name: deviceName,
        platform: deviceInfo.platform,
      },
    });
  }

  async trustDevice(userId: string, deviceId: string) {
    return this.prisma.device.update({
      where: {
        userId_deviceId: {
          userId,
          deviceId,
        },
      },
      data: {
        isTrusted: true,
      },
    });
  }

  async getUserDevices(userId: string) {
    return this.prisma.device.findMany({
      where: {
        userId,
      },
      orderBy: {
        lastUsedAt: 'desc',
      },
    });
  }

  async removeDevice(userId: string, deviceId: string) {
    return this.prisma.device.delete({
      where: {
        userId_deviceId: {
          userId,
          deviceId,
        },
      },
    });
  }
}
