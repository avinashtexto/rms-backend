import { Prisma, WorkflowAction } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export type AuditEntityType =
  | 'BOX'
  | 'FILE_RECORD'
  | 'LOCATION'
  | 'WAREHOUSE'
  | 'BRANCH'
  | 'SITE'
  | 'ROOM'
  | 'RACK'
  | 'SHELF'
  | 'CLIENT'
  | 'DEPARTMENT'
  | 'USER'
  | 'DEVICE'
  | 'BARCODE'
  | 'WORK_ORDER'
  | 'SERVICE_REQUEST'
  | 'RACK_TEMPLATE'
  | 'TRANSFER'
  | 'SEGREGATION'
  | 'MERGE'
  | 'INVENTORY'
  | 'OTHER';

export interface RecordAuditLogParams {
  companyId: string;
  userId: string;
  action: WorkflowAction;
  entityType?: AuditEntityType | string;
  entityId?: string | null;
  boxId?: string | null;
  fileRecordId?: string | null;
  locationId?: string | null;
  warehouseId?: string | null;
  branchId?: string | null;
  deviceId?: string | null;
  reasonCodeId?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  previousState?: any;
  newState?: any;
  tx?: Prisma.TransactionClient;
}

function resolveEntityTypeAndId(log: {
  action: WorkflowAction | string;
  boxId?: string | null;
  fileRecordId?: string | null;
  locationId?: string | null;
  warehouseId?: string | null;
  branchId?: string | null;
  deviceId?: string | null;
  box?: { id: string; barcode?: string | null } | null;
  fileRecord?: { id: string; barcode?: string | null; title?: string | null } | null;
  location?: { id: string; barcode?: string | null; name?: string | null } | null;
  previousState?: any;
  newState?: any;
}): { entityType: string; entityId: string | null } {
  // 1. Direct foreign keys from AuditLog schema
  if (log.boxId || log.box?.id) {
    return { entityType: 'BOX', entityId: log.boxId ?? log.box?.id ?? null };
  }
  if (log.fileRecordId || log.fileRecord?.id) {
    return { entityType: 'FILE_RECORD', entityId: log.fileRecordId ?? log.fileRecord?.id ?? null };
  }
  if (log.locationId || log.location?.id) {
    return { entityType: 'LOCATION', entityId: log.locationId ?? log.location?.id ?? null };
  }
  if (log.warehouseId && log.action.toString().includes('WAREHOUSE')) {
    return { entityType: 'WAREHOUSE', entityId: log.warehouseId };
  }
  if (log.branchId && log.action.toString().includes('BRANCH')) {
    return { entityType: 'BRANCH', entityId: log.branchId };
  }
  if (log.deviceId && log.action.toString().includes('DEVICE')) {
    return { entityType: 'DEVICE', entityId: log.deviceId };
  }

  // 2. Extract from newState or previousState JSON
  const state: any =
    (log.newState && typeof log.newState === 'object' ? log.newState : null) ??
    (log.previousState && typeof log.previousState === 'object' ? log.previousState : null);

  const candidateId =
    state?.entityId ??
    state?.id ??
    state?.targetUserId ??
    state?.boxId ??
    state?.fileRecordId ??
    state?.fileId ??
    state?.locationId ??
    state?.warehouseId ??
    state?.branchId ??
    state?.siteId ??
    state?.roomId ??
    state?.rackId ??
    state?.shelfId ??
    state?.clientId ??
    state?.departmentId ??
    state?.deviceId ??
    state?.workOrderId ??
    state?.templateId ??
    null;

  const actionStr = String(log.action);
  let entityType = 'OTHER';

  if (actionStr.includes('BOX')) entityType = 'BOX';
  else if (actionStr.includes('FILE') || actionStr.includes('REFILE')) entityType = 'FILE_RECORD';
  else if (actionStr.includes('LOCATION')) entityType = 'LOCATION';
  else if (actionStr.includes('WAREHOUSE')) entityType = 'WAREHOUSE';
  else if (actionStr.includes('BRANCH')) entityType = 'BRANCH';
  else if (actionStr.includes('SITE')) entityType = 'SITE';
  else if (actionStr.includes('ROOM')) entityType = 'ROOM';
  else if (actionStr.includes('RACK_TEMPLATE')) entityType = 'RACK_TEMPLATE';
  else if (actionStr.includes('RACK')) entityType = 'RACK';
  else if (actionStr.includes('SHELF')) entityType = 'SHELF';
  else if (actionStr.includes('CLIENT')) entityType = 'CLIENT';
  else if (actionStr.includes('DEPARTMENT')) entityType = 'DEPARTMENT';
  else if (actionStr.includes('USER') || actionStr.startsWith('AUTH_')) entityType = 'USER';
  else if (actionStr.includes('DEVICE')) entityType = 'DEVICE';
  else if (actionStr.includes('BARCODE')) entityType = 'BARCODE';
  else if (actionStr.includes('WORK_ORDER')) entityType = 'WORK_ORDER';
  else if (actionStr.includes('SERVICE_REQUEST')) entityType = 'SERVICE_REQUEST';
  else if (actionStr.includes('TRANSFER')) entityType = 'TRANSFER';
  else if (actionStr.includes('SEGREGATION')) entityType = 'SEGREGATION';
  else if (actionStr.includes('MERGE')) entityType = 'MERGE';
  else if (actionStr.includes('INVENTORY')) entityType = 'INVENTORY';

  let finalEntityId = candidateId;
  if (!finalEntityId && (actionStr.startsWith('AUTH_') || entityType === 'USER')) {
    finalEntityId = state?.userId ?? null;
  }

  return {
    entityType,
    entityId: finalEntityId ? String(finalEntityId) : null
  };
}

function mapDeviceOutput(log: {
  deviceId?: string | null;
  device?: { id: string; serialNumber: string; model: string; label?: string | null } | null;
}) {
  if (log.device) {
    const name =
      (log.device.label && log.device.label.trim().length > 0)
        ? log.device.label
        : (log.device.model && log.device.model.trim().length > 0)
          ? log.device.model
          : log.device.serialNumber;
    return {
      id: log.device.id,
      name,
      serialNumber: log.device.serialNumber,
      model: log.device.model,
      label: log.device.label ?? null
    };
  }
  if (log.deviceId) {
    return {
      id: log.deviceId,
      name: log.deviceId,
      serialNumber: log.deviceId,
      model: null,
      label: null
    };
  }
  return null;
}

export class AuditService {
  static async recordAuditLog(params: RecordAuditLogParams) {
    try {
      const client = params.tx ?? prisma;

      let finalNewState = params.newState ? JSON.parse(JSON.stringify(params.newState)) : null;
      let finalPrevState = params.previousState ? JSON.parse(JSON.stringify(params.previousState)) : null;

      if (params.entityId) {
        if (finalNewState && typeof finalNewState === 'object' && !finalNewState.id && !finalNewState.entityId) {
          finalNewState.id = params.entityId;
        }
        if (finalPrevState && typeof finalPrevState === 'object' && !finalPrevState.id && !finalPrevState.entityId) {
          finalPrevState.id = params.entityId;
        }
      }

      let resolvedDeviceId: string | null = null;
      if (params.deviceId) {
        const dev = await prisma.device.findFirst({
          where: {
            OR: [{ id: params.deviceId }, { serialNumber: params.deviceId }]
          },
          select: { id: true }
        });
        if (dev) {
          resolvedDeviceId = dev.id;
        }
      }

      await client.auditLog.create({
        data: {
          companyId: params.companyId,
          userId: params.userId,
          action: params.action,
          deviceId: resolvedDeviceId,
          warehouseId: params.warehouseId ?? undefined,
          branchId: params.branchId ?? undefined,
          locationId: params.locationId ?? undefined,
          boxId: params.boxId ?? undefined,
          fileRecordId: params.fileRecordId ?? undefined,
          reasonCodeId: params.reasonCodeId ?? undefined,
          gpsLat: params.gpsLat ?? undefined,
          gpsLng: params.gpsLng ?? undefined,
          previousState: finalPrevState as Prisma.InputJsonValue,
          newState: finalNewState as Prisma.InputJsonValue
        }
      });
    } catch (err) {
      console.error('Failed to record audit log:', err);
    }
  }

  private static async resolveEntityFilter(
    companyId: string,
    entityType?: AuditEntityType | string,
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

    const [box, file, location, user, device] = await Promise.all([
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
      }),
      prisma.user.findFirst({
        where: { companyId, OR: [{ id: entityId }, { employeeCode: entityId }, { email: entityId }] },
        select: { id: true }
      }),
      prisma.device.findFirst({
        where: { companyId, OR: [{ id: entityId }, { serialNumber: entityId }] },
        select: { id: true }
      })
    ]);

    if (box || file || location || user || device) {
      return {
        OR: [
          ...(box ? [{ boxId: box.id }] : []),
          ...(file ? [{ fileRecordId: file.id }] : []),
          ...(location ? [{ locationId: location.id }] : []),
          ...(user ? [{ userId: user.id }] : []),
          ...(device ? [{ deviceId: device.id }] : [])
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
      entityType?: AuditEntityType | string;
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
          device: { select: { id: true, serialNumber: true, model: true, label: true } },
          box: { select: { id: true, barcode: true, description: true } },
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
      data: logs.map((log) => {
        const { entityType, entityId } = resolveEntityTypeAndId(log);
        return {
          id: log.id,
          action: log.action,
          entityType,
          entityId,
          previousState: log.previousState,
          newState: log.newState,
          user: log.user,
          device: mapDeviceOutput(log),
          createdAt: log.createdAt
        };
      }),
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
        device: { select: { id: true, serialNumber: true, model: true, label: true } },
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

    const { entityType, entityId } = resolveEntityTypeAndId(log);

    return {
      id: log.id,
      action: log.action,
      entityType,
      entityId,
      previousState: log.previousState,
      newState: log.newState,
      user: log.user,
      device: mapDeviceOutput(log),
      box: log.box,
      fileRecord: log.fileRecord,
      location: log.location,
      createdAt: log.createdAt
    };
  }
}
