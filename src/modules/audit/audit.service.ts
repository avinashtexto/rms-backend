import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { WorkflowAction } from '@prisma/client';

export class AuditService {
  static async listAuditLogs(
    companyId: string,
    filters: {
      userId?: string;
      warehouseId?: string;
      boxId?: string;
      fileRecordId?: string;
      action?: WorkflowAction;
      start?: Date;
      end?: Date;
    },
    page: number = 1,
    pageSize: number = 20
  ) {
    const skip = (page - 1) * pageSize;

    const where: any = {
      companyId,
      ...(filters.userId && { userId: filters.userId }),
      ...(filters.warehouseId && { warehouseId: filters.warehouseId }),
      ...(filters.boxId && { boxId: filters.boxId }),
      ...(filters.fileRecordId && { fileRecordId: filters.fileRecordId }),
      ...(filters.action && { action: filters.action }),
      ...((filters.start || filters.end) && {
        createdAt: {
          ...(filters.start && { gte: filters.start }),
          ...(filters.end && { lte: filters.end })
        }
      })
    };

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          device: { select: { id: true, serialNumber: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.auditLog.count({ where })
    ]);

    return {
      logs,
      meta: { page, pageSize, total }
    };
  }

  static async getAuditLogById(companyId: string, auditLogId: string) {
    const log = await prisma.auditLog.findFirst({
      where: { id: auditLogId, companyId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        device: { select: { id: true, serialNumber: true } }
      }
    });

    if (!log) {
      const error: AppError = new Error('Audit log entry not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return log;
  }
}
