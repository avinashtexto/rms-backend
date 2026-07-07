import { Response, NextFunction } from 'express';
import { AuditService } from './audit.service';
import { listAuditLogsQuerySchema } from './audit.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class AuditController {
  static async listAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const query = listAuditLogsQuerySchema.parse(req.query);
      const result = await AuditService.listAuditLogs(
        companyId,
        {
          userId: query.userId,
          warehouseId: query.warehouseId,
          boxId: query.boxId,
          fileRecordId: query.fileRecordId,
          action: query.action,
          start: query.start,
          end: query.end
        },
        query.page,
        query.pageSize
      );
      res.status(200).json({
        success: true,
        data: result.logs,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAuditLogById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const auditLogId = req.params.auditLogId as string;
      const log = await AuditService.getAuditLogById(companyId, auditLogId);
      res.status(200).json({ success: true, data: log });
    } catch (error) {
      next(error);
    }
  }
}
