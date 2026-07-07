import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { DeviceStatus } from '@prisma/client';

export class DeviceService {
  static async listDevices(companyId: string) {
    return prisma.device.findMany({
      where: { companyId },
      include: {
        assignedUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            employeeCode: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async registerDevice(companyId: string, serialNumber: string, model: string) {
    const existing = await prisma.device.findUnique({
      where: { serialNumber }
    });

    if (existing) {
      const error: AppError = new Error(`Device with serial number '${serialNumber}' already registered`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.device.create({
      data: {
        companyId,
        serialNumber,
        model,
        status: 'PENDING'
      }
    });
  }

  static async approveDevice(companyId: string, deviceId: string) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, companyId }
    });

    if (!device) {
      const error: AppError = new Error('Device not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.device.update({
      where: { id: deviceId },
      data: { status: 'APPROVED' }
    });
  }

  static async updateDeviceStatus(companyId: string, deviceId: string, status: DeviceStatus) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, companyId }
    });

    if (!device) {
      const error: AppError = new Error('Device not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.device.update({
      where: { id: deviceId },
      data: { status }
    });
  }

  static async assignDevice(companyId: string, deviceId: string, assignedUserId?: string | null) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, companyId }
    });

    if (!device) {
      const error: AppError = new Error('Device not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    // If assigning, verify user belongs to same company
    if (assignedUserId) {
      const user = await prisma.user.findFirst({
        where: { id: assignedUserId, companyId }
      });
      if (!user) {
        const error: AppError = new Error('User not found in this company');
        error.statusCode = 404;
        error.code = ErrorCode.NOT_FOUND;
        throw error;
      }
    }

    return prisma.device.update({
      where: { id: deviceId },
      data: { assignedUserId }
    });
  }
}
