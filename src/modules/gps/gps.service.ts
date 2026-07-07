import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class GpsService {
  static async trackGps(
    userId: string,
    data: {
      latitude: number;
      longitude: number;
      deviceId?: string | null;
      warehouseId?: string | null;
    }
  ) {
    return prisma.gpsTrack.create({
      data: {
        userId,
        deviceId: data.deviceId,
        warehouseId: data.warehouseId,
        latitude: data.latitude,
        longitude: data.longitude
      }
    });
  }

  static async getLastKnownLocation(companyId: string, userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId }
    });

    if (!user) {
      const error: AppError = new Error('User not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.gpsTrack.findFirst({
      where: { userId },
      orderBy: { capturedAt: 'desc' }
    });
  }

  static async getHistory(companyId: string, userId: string, start: Date, end: Date) {
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId }
    });

    if (!user) {
      const error: AppError = new Error('User not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.gpsTrack.findMany({
      where: {
        userId,
        capturedAt: {
          gte: start,
          lte: end
        }
      },
      orderBy: { capturedAt: 'asc' }
    });
  }

  static async getLiveWarehouseUsers(companyId: string, warehouseId: string) {
    // Verify warehouse belongs to company
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId }
    });

    if (!warehouse) {
      const error: AppError = new Error('Warehouse not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    // Fetch all active users of this company
    const users = await prisma.user.findMany({
      where: { companyId, status: 'ACTIVE' },
      select: {
        id: true,
        fullName: true,
        email: true,
        employeeCode: true
      }
    });

    const liveTracks = [];

    // For each user, get their last known GPS track in this warehouse
    for (const user of users) {
      const track = await prisma.gpsTrack.findFirst({
        where: {
          userId: user.id,
          warehouseId
        },
        orderBy: { capturedAt: 'desc' }
      });

      if (track) {
        liveTracks.push({
          user,
          track
        });
      }
    }

    return liveTracks;
  }
}
