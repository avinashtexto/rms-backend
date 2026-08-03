import { Response, NextFunction } from 'express';
import { AuditService } from './audit.service';
import { listAuditLogsQuerySchema } from './audit.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class AuditController {
  static async listAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const query = listAuditLogsQuerySchema.parse(req.query);
      const limit = query.limit ?? query.pageSize ?? 20;
      const from = query.from ? new Date(query.from) : query.start ? new Date(query.start) : undefined;
      const to = query.to ? new Date(query.to) : query.end ? new Date(query.end) : undefined;

      const result = await AuditService.listAuditLogs(
        companyId,
        {
          userId: query.userId,
          warehouseId: query.warehouseId,
          boxId: query.boxId,
          fileRecordId: query.fileRecordId,
          action: query.action,
          entityType: query.entityType,
          entityId: query.entityId,
          from,
          to
        },
        query.page,
        limit
      );
      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAuditLogById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const auditLogId = (req.params.id ?? req.params.auditLogId) as string;
      const log = await AuditService.getAuditLogById(companyId, auditLogId);
      res.status(200).json({ success: true, data: log });
    } catch (error) {
      next(error);
    }
  }
}
