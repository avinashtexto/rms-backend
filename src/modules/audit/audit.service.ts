import { Prisma, WorkflowAction } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

type AuditEntityType = 'BOX' | 'FILE_RECORD' | 'LOCATION' | 'USER' | 'DEVICE';

function auditEntityBarcode(log: {
  box?: { barcode: string } | null;
  fileRecord?: { barcode: string } | null;
  location?: { barcode: string } | null;
  boxId?: string | null;
  fileRecordId?: string | null;
}): string | null {
  return (
    log.box?.barcode ??
    log.fileRecord?.barcode ??
    log.location?.barcode ??
    log.boxId ??
    log.fileRecordId ??
    null
  );
}

export class AuditService {
  private static async resolveEntityFilter(
    companyId: string,
    entityType?: AuditEntityType,
    entityId?: string
  ): Promise<Partial<Prisma.AuditLogWhereInput>> {
    if (!entityId) {
      return {};
    }

    if (entityType === 'BOX') {
      const box = await prisma.box.findFirst({
        where: {
          companyId,
          OR: [{ id: entityId }, { barcode: entityId }]
        },
        select: { id: true }
      });
      return box ? { boxId: box.id } : { boxId: '__none__' };
    }

    if (entityType === 'FILE_RECORD') {
      const file = await prisma.fileRecord.findFirst({
        where: {
          companyId,
          OR: [{ id: entityId }, { barcode: entityId }]
        },
        select: { id: true }
      });
      return file ? { fileRecordId: file.id } : { fileRecordId: '__none__' };
    }

    if (entityType === 'LOCATION') {
      const location = await prisma.location.findFirst({
        where: {
          OR: [{ id: entityId }, { barcode: entityId }],
          shelf: {
            rack: {
              room: {
                warehouse: { companyId }
              }
            }
          }
        },
        select: { id: true }
      });
      return location ? { locationId: location.id } : { locationId: '__none__' };
    }

    if (entityType === 'USER') {
      const user = await prisma.user.findFirst({
        where: {
          companyId,
          OR: [{ id: entityId }, { employeeCode: entityId }, { email: entityId }]
        },
        select: { id: true }
      });
      return user ? { userId: user.id } : { userId: '__none__' };
    }

    if (entityType === 'DEVICE') {
      const device = await prisma.device.findFirst({
        where: {
          companyId,
          OR: [{ id: entityId }, { serialNumber: entityId }]
        },
        select: { id: true }
      });
      return device ? { deviceId: device.id } : { deviceId: '__none__' };
    }

    const [box, file, location] = await Promise.all([
      prisma.box.findFirst({
        where: { companyId, OR: [{ id: entityId }, { barcode: entityId }] },
        select: { id: true }
      }),
      prisma.fileRecord.findFirst({
        where: { companyId, OR: [{ id: entityId }, { barcode: entityId }] },
        select: { id: true }
      }),
      prisma.location.findFirst({
        where: {
          OR: [{ id: entityId }, { barcode: entityId }],
          shelf: { rack: { room: { warehouse: { companyId } } } }
        },
        select: { id: true }
      })
    ]);

    if (box || file || location) {
      return {
        OR: [
          ...(box ? [{ boxId: box.id }] : []),
          ...(file ? [{ fileRecordId: file.id }] : []),
          ...(location ? [{ locationId: location.id }] : [])
        ]
      };
    }

    return { id: '__none__' };
  }

  static async listAuditLogs(
    companyId: string,
    filters: {
      userId?: string;
      warehouseId?: string;
      boxId?: string;
      fileRecordId?: string;
      action?: WorkflowAction;
      entityType?: AuditEntityType;
      entityId?: string;
      from?: Date;
      to?: Date;
    },
    page: number = 1,
    pageSize: number = 20
  ) {
    const skip = (page - 1) * pageSize;
    const entityFilter = await AuditService.resolveEntityFilter(
      companyId,
      filters.entityType,
      filters.entityId
    );

    const where: Prisma.AuditLogWhereInput = {
      companyId,
      ...(filters.userId && { userId: filters.userId }),
      ...(filters.warehouseId && { warehouseId: filters.warehouseId }),
      ...(filters.boxId && { boxId: filters.boxId }),
      ...(filters.fileRecordId && { fileRecordId: filters.fileRecordId }),
      ...(filters.action && { action: filters.action }),
      ...entityFilter,
      ...((filters.from || filters.to) && {
        createdAt: {
          ...(filters.from && { gte: filters.from }),
          ...(filters.to && { lte: filters.to })
        }
      })
    };

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          device: { select: { id: true, serialNumber: true, model: true } },
          box: { select: { id: true, barcode: true } },
          fileRecord: { select: { id: true, barcode: true, title: true } },
          location: { select: { id: true, barcode: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.auditLog.count({ where })
    ]);

    return {
      data: logs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.boxId
          ? 'BOX'
          : log.fileRecordId
            ? 'FILE_RECORD'
            : log.locationId
              ? 'LOCATION'
              : 'OTHER',
        entityId: auditEntityBarcode(log),
        previousState: log.previousState,
        newState: log.newState,
        user: log.user,
        device: log.device,
        createdAt: log.createdAt
      })),
      meta: {
        page,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  static async getAuditLogById(companyId: string, auditLogId: string) {
    const log = await prisma.auditLog.findFirst({
      where: { id: auditLogId, companyId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        device: { select: { id: true, serialNumber: true, model: true } },
        box: { select: { id: true, barcode: true, description: true } },
        fileRecord: { select: { id: true, barcode: true, title: true } },
        location: { select: { id: true, barcode: true, name: true } }
      }
    });

    if (!log) {
      const error: AppError = new Error('Audit log entry not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return {
      id: log.id,
      action: log.action,
      entityType: log.boxId
        ? 'BOX'
        : log.fileRecordId
          ? 'FILE_RECORD'
          : log.locationId
            ? 'LOCATION'
            : 'OTHER',
      entityId: auditEntityBarcode(log),
      previousState: log.previousState,
      newState: log.newState,
      user: log.user,
      device: log.device,
      box: log.box,
      fileRecord: log.fileRecord,
      location: log.location,
      createdAt: log.createdAt
    };
  }
}
