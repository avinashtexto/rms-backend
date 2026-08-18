import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { DeviceStatus, WorkflowAction } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

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

  static async registerDevice(companyId: string, serialNumber: string, model: string, actor?: { id: string; deviceId?: string | null }) {
    const existing = await prisma.device.findUnique({
      where: { serialNumber }
    });

    if (existing) {
      const error: AppError = new Error(`Device with serial number '${serialNumber}' already registered`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    const device = await prisma.device.create({
      data: {
        companyId,
        serialNumber,
        model,
        status: 'PENDING'
      }
    });

    if (actor) {
      await AuditService.recordAuditLog({
        companyId,
        userId: actor.id,
        action: WorkflowAction.DEVICE_CREATED,
        deviceId: device.id,
        entityId: device.id,
        newState: device
      });
    }

    return device;
  }

  static async approveDevice(companyId: string, deviceId: string, actor?: { id: string; deviceId?: string | null }) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, companyId }
    });

    if (!device) {
      const error: AppError = new Error('Device not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    const updated = await prisma.device.update({
      where: { id: deviceId },
      data: { status: 'APPROVED' }
    });

    if (actor) {
      await AuditService.recordAuditLog({
        companyId,
        userId: actor.id,
        action: WorkflowAction.DEVICE_UPDATED,
        deviceId: device.id,
        entityId: device.id,
        previousState: device,
        newState: updated
      });
    }

    return updated;
  }

  static async updateDeviceStatus(companyId: string, deviceId: string, status: DeviceStatus, actor?: { id: string; deviceId?: string | null }) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, companyId }
    });

    if (!device) {
      const error: AppError = new Error('Device not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    const updated = await prisma.device.update({
      where: { id: deviceId },
      data: { status }
    });

    if (actor) {
      await AuditService.recordAuditLog({
        companyId,
        userId: actor.id,
        action: WorkflowAction.DEVICE_UPDATED,
        deviceId: device.id,
        entityId: device.id,
        previousState: device,
        newState: updated
      });
    }

    return updated;
  }

  static async assignDevice(companyId: string, deviceId: string, assignedUserId?: string | null, actor?: { id: string; deviceId?: string | null }) {
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

    const updated = await prisma.device.update({
      where: { id: deviceId },
      data: { assignedUserId }
    });

    if (actor) {
      await AuditService.recordAuditLog({
        companyId,
        userId: actor.id,
        action: WorkflowAction.DEVICE_UPDATED,
        deviceId: device.id,
        entityId: device.id,
        previousState: device,
        newState: updated
      });
    }

    return updated;
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

  static async deleteDevice(companyId: string, deviceId: string, actor?: { id: string; deviceId?: string | null }) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, companyId }
    });

    if (!device) {
      const error: AppError = new Error('Device not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    const deleted = await prisma.device.delete({
      where: { id: deviceId }
    });

    if (actor) {
      await AuditService.recordAuditLog({
        companyId,
        userId: actor.id,
        action: WorkflowAction.DEVICE_DELETED,
        deviceId: device.id,
        entityId: device.id,
        previousState: device,
        newState: null
      });
    }

    return deleted;
  }

  static async updateDevice(
    companyId: string,
    deviceId: string,
    data: { serialNumber?: string; model?: string; status?: DeviceStatus; assignedUserId?: string | null },
    actor?: { id: string; deviceId?: string | null }
  ) {
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

    const updated = await prisma.device.update({
      where: { id: deviceId },
      data: {
        serialNumber: data.serialNumber,
        model: data.model,
        status: data.status,
        assignedUserId: data.assignedUserId
      }
    });

    if (actor) {
      await AuditService.recordAuditLog({
        companyId,
        userId: actor.id,
        action: WorkflowAction.DEVICE_UPDATED,
        deviceId: device.id,
        entityId: device.id,
        previousState: device,
        newState: updated
      });
    }

    return updated;
  }
}
