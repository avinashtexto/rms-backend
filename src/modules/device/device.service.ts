import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { DeviceStatus } from '@prisma/client';

export class DeviceService {
  static async listDevices(companyId: string, page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;
    const [devices, total] = await Promise.all([
      prisma.device.findMany({
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.device.count({ where: { companyId } })
    ]);

    return {
      data: devices,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    };
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

  static async getDeviceById(companyId: string, deviceId: string) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, companyId },
      include: {
        assignedUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            employeeCode: true
          }
        }
      }
    });

    if (!device) {
      const error: AppError = new Error('Device not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return device;
  }

  static async deleteDevice(companyId: string, deviceId: string) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, companyId }
    });

    if (!device) {
      const error: AppError = new Error('Device not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.device.delete({
      where: { id: deviceId }
    });
  }

  static async updateDevice(companyId: string, deviceId: string, data: { serialNumber?: string; model?: string; status?: DeviceStatus; assignedUserId?: string | null }) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, companyId }
    });

    if (!device) {
      const error: AppError = new Error('Device not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    if (data.serialNumber && data.serialNumber !== device.serialNumber) {
      const existing = await prisma.device.findUnique({
        where: { serialNumber: data.serialNumber }
      });
      if (existing) {
        const error: AppError = new Error(`Device with serial number '${data.serialNumber}' already registered`);
        error.statusCode = 400;
        error.code = ErrorCode.DUPLICATE_CODE;
        throw error;
      }
    }

    if (data.assignedUserId) {
      const user = await prisma.user.findFirst({
        where: { id: data.assignedUserId, companyId }
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
      data: {
        serialNumber: data.serialNumber,
        model: data.model,
        status: data.status,
        assignedUserId: data.assignedUserId
      }
    });
  }
}
