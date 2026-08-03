import { DeviceStatus, Prisma, WorkflowAction } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { AccessActor } from './users.types';
import { RoleName } from '@prisma/client';

function mapDevice(device: {
  id: string;
  companyId: string;
  serialNumber: string;
  model: string;
  label: string | null;
  appVersion: string | null;
  isActive: boolean;
  status: DeviceStatus;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assignedUser: {
    id: string;
    fullName: string;
    email: string;
    employeeCode: string;
  } | null;
}) {
  return {
    id: device.id,
    companyId: device.companyId,
    serialNumber: device.serialNumber,
    model: device.model,
    label: device.label,
    appVersion: device.appVersion,
    isActive: device.isActive,
    status: device.status,
    lastSeenAt: device.lastSeenAt,
    lastUser: device.assignedUser
      ? {
          id: device.assignedUser.id,
          username: device.assignedUser.employeeCode,
          fullName: device.assignedUser.fullName,
          email: device.assignedUser.email
        }
      : null,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt
  };
}

export class DevicesManagementService {
  private static resolveCompanyScope(actor: AccessActor, companyId?: string): string | undefined {
    if (actor.roleName === RoleName.SUPER_ADMIN) {
      return companyId;
    }
    return actor.companyId;
  }

  static async list(
    query: {
      page: number;
      limit: number;
      search?: string;
      model?: string;
      isActive?: boolean;
      companyId?: string;
    },
    actor: AccessActor
  ) {
    const scopedCompanyId = DevicesManagementService.resolveCompanyScope(actor, query.companyId);
    const skip = (query.page - 1) * query.limit;

    const where: Prisma.DeviceWhereInput = {
      ...(scopedCompanyId && { companyId: scopedCompanyId }),
      ...(query.model && { model: { contains: query.model, mode: 'insensitive' } }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.search && {
        serialNumber: { contains: query.search, mode: 'insensitive' }
      })
    };

    const [devices, total] = await prisma.$transaction([
      prisma.device.findMany({
        where,
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
        orderBy: { lastSeenAt: 'desc' },
        skip,
        take: query.limit
      }),
      prisma.device.count({ where })
    ]);

    return {
      data: devices.map(mapDevice),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    };
  }

  static async get(deviceId: string, actor: AccessActor) {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
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
      const error: AppError = new Error('Device not found');
      error.statusCode = 404;
      error.code = ErrorCode.DEVICE_NOT_FOUND;
      throw error;
    }

    if (actor.roleName !== RoleName.SUPER_ADMIN && device.companyId !== actor.companyId) {
      const error: AppError = new Error('Device not found');
      error.statusCode = 404;
      error.code = ErrorCode.DEVICE_NOT_FOUND;
      throw error;
    }

    return mapDevice(device);
  }

  static async update(
    deviceId: string,
    data: { isActive?: boolean; label?: string | null },
    actor: AccessActor
  ) {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });

    if (!device) {
      const error: AppError = new Error('Device not found');
      error.statusCode = 404;
      error.code = ErrorCode.DEVICE_NOT_FOUND;
      throw error;
    }

    if (actor.roleName !== RoleName.SUPER_ADMIN && device.companyId !== actor.companyId) {
      const error: AppError = new Error('Device not found');
      error.statusCode = 404;
      error.code = ErrorCode.DEVICE_NOT_FOUND;
      throw error;
    }

    const updated = await prisma.device.update({
      where: { id: deviceId },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.isActive !== undefined && {
          isActive: data.isActive,
          status: data.isActive ? DeviceStatus.APPROVED : DeviceStatus.BLOCKED
        })
      },
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

    await prisma.auditLog.create({
      data: {
        companyId: updated.companyId,
        userId: actor.id,
        deviceId: updated.id,
        action: WorkflowAction.DEVICE_UPDATED,
        previousState: {
          isActive: device.isActive,
          label: device.label,
          status: device.status
        },
        newState: {
          isActive: updated.isActive,
          label: updated.label,
          status: updated.status
        }
      }
    });

    return mapDevice(updated);
  }
}
